import 'airbnb-js-shims';
// import getTransformer, { builtInTransforms } from 'json-transformer-js';
// import miniMAL from 'minimal-lisp';
// import _ from 'lodash/fp';
import { isBefore, addSeconds, addYears } from 'date-fns/fp';
import * as R from 'ramda';
// import { createStore } from 'redux';
import { functionalParserWithVars, asyncBlockEvaluator } from './minimal-lisp-parser';

// TODO: Need a state manager! most.js?
// TODO: State machine for each rule?
// TODO: How to model state as streams?

// ---------- TODO: Future refactor to most?
// const createReducer = (initialState, handlers) => (state = initialState, action) =>
// R.propOr(R.identity, action.type, handlers)(state, action);
// const createDispatch = action$ => action => action$.next(action);
// const action$ = createStream();
// export const dispatch = createDispatch(action$);
// const state$ = scan(reducer, initialState, action$);
// ----------

// const evolveId = (id, update) => R.evolve({ [id]: update });
//
// const ruleHandlers = {
//   updateRule: (state, { id, value }) =>
//     evolveId(
//       id,
//       R.evolve({
//         flip: R.when(R.isNil(value), R.not, R.always(value)),
//         flippedTime: '...',
//       }),
//     )(state),
//   addRule: (state, { id }) => ({ ...state, [id]: initialRuleState }),
// };
//
// const { dispatch, getState, subscribe } = createStore(
//   createReducer(
//     {
//       // <id>: { conf: <ruleConf>, active, flipped, lastFired, vars: {} }
//     },
//     ruleHandlers,
//   ),
// );

const ruleStore = {
  // <id>: { conf: <ruleConf>, active, flipped, lastFired }
};

const initialRuleState = {
  active: false,
  flipped: false,
  lastFired: addYears(-100)(new Date()),
  // ttl
  // onExpired
};

export const loadRule = async (
  ruleConf,
  { parserOptions = {}, idKey = 'id', patchParser, onExpired, vars = {} } = {},
) => {
  const { [idKey]: id, triggers, actuator = 'backend', active, ttl: ttlStr = null } = ruleConf;
  if (!id) throw new Error(`No ${idKey} found in rule`);
  if (actuator !== 'backend' || !active) return;
  const ttl = ttlStr ? new Date(ttlStr) : addYears(100)(new Date());
  ruleStore[id] = {
    ...initialRuleState,
    ...(ruleStore[id] || {}),
    conf: ruleConf,
    active,
    ttl,
    onExpired,
  };
  // console.log('creating functionalParser:', vars);
  const parser = functionalParserWithVars(vars, parserOptions);
  if (triggers) await asyncBlockEvaluator(parser, triggers, patchParser);
  else console.warn('Rule has no triggers:', id);
};

export const unloadRule = id => {
  // TODO: ?????????????????????????????????????
  // ruleStore = R.dissoc(id);
};

const checkRule = id => {
  const { active, lastFired, flipped, conf, ttl, onExpired } = ruleStore[id];
  if (!active) return [true];
  const now = new Date();
  const { cooldown = 0, resetCondition } = conf;
  // console.log('Checking 1:', cooldown, resetCondition);
  if (isBefore(now)(ttl)) {
    // rule has expired
    ruleStore[id] = { ...ruleStore[id], active: false };
    if (onExpired) onExpired(id);
    return [true];
  }
  const cooledDown = isBefore(now)(addSeconds(cooldown)(lastFired));
  // console.log('Checking 2:', cooledDown, lastFired);
  if (!resetCondition) {
    if (flipped && !cooledDown) return [true]; // no point continuing
    if (flipped && cooledDown) {
      ruleStore[id] = { ...ruleStore[id], flipped: false };
    }
  }
  return [false, cooledDown]; // continue
};

export const runRule = async (id, vars = {}, parserOptions = {}) => {
  const [done, cooledDown] = checkRule(id);
  if (done) return undefined;
  const {
    conf: { process, resetCondition, condition, resetActions, actions },
    flipped,
  } = ruleStore[id];
  const parser = functionalParserWithVars(vars, parserOptions);
  if (process) await asyncBlockEvaluator(parser, process);
  // console.log('After process:', vars, flipped, resetCondition, condition);
  if (flipped && resetCondition) {
    const conditionsMet = parser.evalWithLog(resetCondition);
    if (conditionsMet) {
      ruleStore[id] = { ...ruleStore[id], flipped: false };
      return asyncBlockEvaluator(parser, resetActions);
    }
    return undefined;
  }
  // console.log('Last check:', flipped, cooledDown);
  if (flipped || !cooledDown) return undefined;

  // console.log('Will run condition:', condition, actions);
  const conditionsMet = parser.evalWithLog(condition);
  // console.log('conditionsMet:', conditionsMet);
  if (conditionsMet) {
    ruleStore[id] = { ...ruleStore[id], flipped: true };
    return asyncBlockEvaluator(parser, actions);
  }
  return undefined;
};
