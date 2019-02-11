import 'airbnb-js-shims';
// import getTransformer, { builtInTransforms } from 'json-transformer-js';
import miniMAL from 'minimal-lisp';
import _ from 'lodash';
import * as R from 'ramda';
// import { createStore } from 'redux';

export const mlParser = ({ envExtra, keepJsEval = false }, vars) => {
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

export const loadRules = (newRules, envExtra, idKey = 'id') => {
  newRules.forEach(ruleConf => {
    const { [idKey]: id, triggers, actuator = 'backend', active } = ruleConf;
    if (actuator !== 'backend') return;
    ruleStore[id] = { ...initialRuleState, ...(ruleStore[id] || {}), conf: ruleConf, active };
    const { vars } = ruleStore[id];
    const ml = mlParser({ envExtra }, vars);
    triggers.forEach(trigger => {
      ml.eval(trigger);
    });
  });
};

export const createRuleProcessor = ({}) => {};

const checkRule = (rule, ruleState) => {
  const { active, lastFired, flipped } = ruleState;
  if (!active) return ruleState;
  const now = Date.now();
  if (rule.ttl && rule.ttl < now) return { ...ruleState, active: false };

  const { cooldown, resetCondition } = rule;
  const cooledDown = now >= lastFired + cooldown;
  if (flipped && !resetCondition && !cooledDown) return ruleState;
  return undefined; // continue
};

const preFetch = (fetcher, preFetches) =>
  R.compose(
    R.reduce((acc, [id, call]) => ({ ...acc, [id]: fetcher(call) }), {}),
    R.toPairs,
  )(preFetches);

export const createRule = ({ rule }) => {
  const ruleComponent = {
    state: {
      active: false,
      flipped: false,
      lastFired: 0,
    },
  };
  const vars = {};
  const mLisp = miniMAL({
    Math,
    Date,
    _,
    // getVar: k => _.get(vars, k),
    // setVar: (k, v) => _.set(vars, k, v),
    var: (k, v) => (v === undefined ? _.get : _.set)(vars, k, v),
    subscribe: (ch, prop) => client.subscribe(ch, onMsg(prop)),
    // var: (k, v) => (v === undefined ? _.get(vars, k) : _.set(vars, k, v)),
    ...ctx,
  });
  const processRule = ({
    id,
    ctx,
    rule,
    ruleState,
    fetcher,
    transform,
    conditionTransform,
    runActions,
  }) => {
    const newFinalState = checkRule(rule, ruleState);
    if (newFinalState) return newFinalState; // else continue
    const { preFetches, process } = rule;
    // const fetched = preFetch(fetcher, preFetches);

    const vars = Array.isArray(process) ? 1 : transform(rule.process, ctx);

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
};
