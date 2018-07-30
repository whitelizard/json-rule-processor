import 'babel-polyfill';
// import getTransformer, { builtInTransforms } from 'json-transformer-js';
import miniMAL from 'minimal-lisp';
import _ from 'lodash';
import { async } from 'most-subject';
import { map, scan } from 'most';
// import { Map } from 'immutable';

const createStream = async;
const createDispatch = action$ => action => action$.next(action);
const initialState = {};
const evolveId = (id, state, update) => R.evolve({ [id]: update });
const handlers = {
  flip: (state, action) => {
    const { payload: { id, value } } = action;
    return evolveId(
      id,
      state,
      R.evolve({
        flip: R.when(R.isNil(value), R.not, R.always(value)),
        flippedTime: '...',
      }),
    );
  },
};
const createReducer = (initialState, handlers) => (state = initialState, action) =>
  R.propOr(identity, action.type, handlers)(state, action);

const action$ = createStream();
export const dispatch = createDispatch(action$);
const state$ = scan(reducer, initialState, action$);

function createMLisp(ctx) {
  const vars = {};
  return miniMAL({
    ...ctx,
    Math,
    Date,
    _,
    get: k => _.get(vars, k),
    set: (k, v) => _.set(vars, k, v),
  });
}

// TODO: Need a state manager! most.js?
// TODO: State machine for each rule?
// TODO: How to model state as streams?

const createRulesState = () => {
  const state = {};
  const newRule = id => 5;
  const isOnCooldown = id => 5;
};

function createRule(conf, removeSelf) {
  // const { active, ...rule } = conf;
  let flipped = false;
  let flippedTime = 0;
  function flip(value) {
    flipped = value !== undefined ? value : !flipped;
    if (flipped) flippedTime = Date.now();
  }
  function isOnCooldown() {
    const cooledDown = Date.now() >= flippedTime + conf.cooldown;
    if (flipped && !conf.resetCondition && !cooledDown) {
      return true;
    }
    flip(false);
    return false;
  }
  function shouldReset() {}
  // function
  return Object.freeze({
    flip,
    isOnCooldown,
    conf,
  });
}

export async function processRule({
  rule,
  ctx,
  // setActive,
  setFlipped,
  prepare,
  transform,
  conditionTransform,
  runActions,
}) {
  const now = Date.now();
  if (!rule.active) return;
  const updatedRule = { ...rule };
  if (rule.ttl && rule.ttl < now) {
    updatedRule.active = false;
    // setActive(rule, false);
    return updatedRule;
  }
  const cooledDown = now >= rule.lastFired + rule.cooldown;
  if (rule.flipped && !rule.resetCondition) {
    // No way other than cooldown for rule to reset
    if (!cooledDown) return;
    setFlipped(rule, false);
  }
  const context = {
    ...ctx,
    get: k => _.get(vars, k),
    set: (k, v) => _.set(vars, k, v),
  };
  await prepare(updatedRule, context);
  if (rule.process) transform(rule.process, context);
  if (rule.flipped && rule.resetCondition) {
    const conditionsMet = conditionTransform(rule.resetCondition, context);
    if (conditionsMet) {
      setFlipped(rule, false);
      return runActions(rule, context, true);
    }
    return;
  }
  if (rule.flipped || !cooledDown) return;
  const conditionsMet = conditionTransform(rule.condition, context);
  if (conditionsMet) {
    setFlipped(rule, true);
    return runActions(rule, context);
  }
}
