import 'airbnb-js-shims';
// import getTransformer, { builtInTransforms } from 'json-transformer-js';
import miniMAL from 'minimal-lisp';
import _ from 'lodash/fp';
import * as R from 'ramda';
// import { createStore } from 'redux';
import { minimalLispParser } from './minimal-lisp-parser';

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
  // vars: {},
};

export const loadRule = (ruleConf, envExtra, idKey = 'id', patchParser) => {
  const { [idKey]: id, triggers = [], actuator = 'backend', active } = ruleConf;
  if (actuator !== 'backend') return;
  ruleStore[id] = { ...initialRuleState, ...(ruleStore[id] || {}), conf: ruleConf, active };
  // const { vars } = ruleStore[id];
  const vars = {};
  const parser = minimalLispParser({ envExtra }, vars);
  triggers.forEach(trigger => {
    if (typeof trigger === 'object' && !Array.isArray(trigger)) {
      trigger.entries().forEach(([key, val]) => {
        if (patchParser) patchParser(parser, vars, key);
        parser.eval(val);
      });
    } else {
      if (patchParser) patchParser(parser, vars);
      parser.eval(trigger);
    }
  });
};

const checkRule = id => {
  const { active, lastFired, flipped, conf } = ruleStore[id];
  if (!active) return true;
  const now = Date.now();
  const { cooldown = 0, resetCondition, ttl = Infinity } = conf;
  if (ttl && ttl < now) {
    ruleStore[id] = { ...(ruleStore[id] || {}), active: false };
    return true;
  }
  const cooledDown = now >= lastFired + cooldown;
  if (flipped && !resetCondition && !cooledDown) return true;
  return false; // continue
};

const handleAsyncs = async (parser, result, asyncConf = []) => {
  if (R.isEmpty(asyncConf)) return result;
  const [nextAsync, ...rest] = asyncConf;
  if (typeof nextAsync === 'object' && !Array.isArray(nextAsync)) {
    const keyPromisePairs = Object.entries(nextAsync);
    const results = await Promise.all(keyPromisePairs.map(([x, val]) => parser.eval(val)));
    results.forEach((data, ix) => {
      result[keyPromisePairs[ix][0]] = data;
    });
  } else {
    await parser.eval(nextAsync);
    return handleAsyncs(parser, result, rest);
  }
};

export const processRule = async (id, vars) => {
  const { conf, flipped } = ruleStore[id];
  if (checkRule(id)) return;
  const { asyncs, process } = conf;
  const parser = minimalLispParser({ envExtra }, vars);
  await handleAsyncs(parser, vars, asyncs);
  // const fetched = preFetch(fetcher, preFetches);

  const vars = Array.isArray(process) ? 1 : parser.eval(rule.process, ctx);

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
