import 'airbnb-js-shims';
// import getTransformer, { builtInTransforms } from 'json-transformer-js';
import miniMAL from 'minimal-lisp';
import _ from 'lodash/fp';
import { isBefore, addSeconds, addYears } from 'date-fns/fp';
import * as R from 'ramda';
// import { createStore } from 'redux';
import { functionalParser, asyncBlockEvaluator } from './minimal-lisp-parser';

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
  // lastFired
  // ttl
  // onExpired
};

export const loadRule = async (
  ruleConf,
  { envExtra, idKey = 'id', patchParser, onExpired, vars = {} } = {},
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
  const parser = functionalParser({ envExtra, vars });
  if (triggers) await asyncBlockEvaluator(parser, patchParser)(triggers);
  else console.warn('Rule has no triggers:', id);
};

const checkRule = id => {
  const { active, lastFired, flipped, conf, ttl, onExpired } = ruleStore[id];
  if (!active) return true;
  const now = new Date();
  const { cooldown = 0, resetCondition } = conf;
  if (isBefore(now)(ttl)) {
    // rule has expired
    ruleStore[id] = { ...ruleStore[id], active: false };
    if (onExpired) onExpired(id);
    return true;
  }
  const cooledDown = isBefore(addSeconds(cooldown)(lastFired))(now);
  if (flipped && !resetCondition && !cooledDown) return true;
  return false; // continue
};

export const processRule = async (id, parserOptions = {}) => {
  const { conf, flipped } = ruleStore[id];
  if (checkRule(id)) return;
  const { process } = conf;
  const parser = functionalParser(parserOptions);
  if (process) await asyncBlockEvaluator(parser)(process);

  // if (flipped && resetCondition) {
  //   const conditionsMet = conditionTransform(resetCondition, context);
  //   if (conditionsMet) {
  //     // setFlipped(rule, false);
  //     return runActions(rule, context, true);
  //   }
  //   return undefined;
  // }
  // if (flipped || !cooledDown) return undefined;
  // const conditionsMet = conditionTransform(rule.condition, context);
  // if (conditionsMet) {
  //   setFlipped(rule, true);
  //   return runActions(rule, context);
  // }
};
