import 'airbnb-js-shims';
// import getTransformer, { builtInTransforms } from 'json-transformer-js';
import miniMAL from 'minimal-lisp';
import _ from 'lodash';
import * as R from 'ramda';
// import { createStore } from 'redux';

export const mlParser = ({ envExtra = {}, keepJsEval = false }, vars) => {
  const parser = miniMAL({
    undefined,
    typeof: a => typeof a, // renaming of miniMAL's 'type'
    '>': (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '>=': (a, b) => a >= b,
    '===': (a, b) => a === b,
    '!==': (a, b) => a !== b,
    '%': (a, b) => a % b,
    var: (path, x) => (x === undefined ? _.get(vars, path) : _.get(_.set(vars, path, x))),
    Array,
    Object,
    String,
    Date,
    Math,
    setInterval,
    setTimeout,
    parseInt,
    parseFloat,
    isNaN,
    Set,
    Map,
    RegExp,
    // fetch,
    log: console.log,
    ...envExtra,
  });
  if (!keepJsEval) {
    parser.js = () => {
      throw new Error('Permission denied');
    };
  }
  return parser;
};

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
  // <id>: { conf: <ruleConf>, active, flipped, lastFired, vars: {} }
};

const initialRuleState = {
  active: false,
  flipped: false,
  lastFired: 0,
  vars: {},
};

export const loadRule = (ruleConf, envExtra, idKey = 'id', triggerHook) => {
  const { [idKey]: id, triggers = [], actuator = 'backend', active } = ruleConf;
  if (actuator !== 'backend') return;
  ruleStore[id] = { ...initialRuleState, ...(ruleStore[id] || {}), conf: ruleConf, active };
  const { vars } = ruleStore[id];
  const ml = mlParser({ envExtra }, vars);
  triggers.forEach(trigger => {
    if (typeof trigger === 'object') {
      trigger.entries().forEach(([key, val]) => {
        if (triggerHook) triggerHook(ml, vars, key);
        ml.eval(val);
      });
    } else {
      if (triggerHook) triggerHook(ml, vars);
      ml.eval(trigger);
    }
  });
};

const checkRule = (ruleConf, active, lastFired, flipped) => {
  if (!active) return {};
  const now = Date.now();
  const { cooldown = 0, resetCondition, ttl = Infinity } = ruleConf;
  if (ttl && ttl < now) return { active: false };

  const cooledDown = now >= lastFired + cooldown;
  if (flipped && !resetCondition && !cooledDown) return {};
  return undefined; // continue
};

const processRule = (id, ml, vars) => {
  const { conf, active, lastFired, flipped } = ruleStore[id];
  const newState = checkRule(conf, active, lastFired, flipped);
  if (newState) {
    ruleStore[id] = { ...(ruleStore[id] || {}), ...newFinalState };
    return;
  } // else continue
  const { asyncs, process } = rule;
  // const fetched = preFetch(fetcher, preFetches);

  const vars = Array.isArray(process) ? 1 : ml.eval(rule.process, ctx);

  if (flipped && resetCondition) {
    const conditionsMet = conditionTransform(resetCondition, context);
    if (conditionsMet) {
      // setFlipped(rule, false);
      return runActions(rule, context, true);
    }
    return undefined;
  }
  if (flipped || !cooledDown) return undefined;
  const conditionsMet = conditionTransform(rule.condition, context);
  if (conditionsMet) {
    setFlipped(rule, true);
    return runActions(rule, context);
  }
};
