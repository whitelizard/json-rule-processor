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
  onCooldown: false,
  lastFired: addYears(-100)(new Date()),
  // ttl
  // onExpired
};

const setRuleState = (id, updates, init) => {
  ruleStore[id] = { ...(init ? initialRuleState : {}), ...(ruleStore[id] || {}), ...updates };
};

export const loadRule = async (
  ruleConf,
  { parserOptions = {}, idKey = 'id', patchParser, onExpired, vars = {} } = {},
) => {
  const { [idKey]: id, triggers, actuator = 'backend', active, ttl: ttlStr = null } = ruleConf;
  if (!id) throw new Error(`No ${idKey} found in rule`);
  if (actuator !== 'backend' || !active) return;
  const ttl = ttlStr ? new Date(ttlStr) : addYears(100)(new Date());
  setRuleState(id, { conf: ruleConf, active, ttl, onExpired }, true);
  // ruleStore[id] = {
  //   ...initialRuleState,
  //   ...(ruleStore[id] || {}),
  //   conf: ruleConf,
  //   active,
  //   ttl,
  //   onExpired,
  // };
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
  const { active, lastFired, onCooldown, conf, ttl, onExpired } = ruleStore[id];
  if (!active) return true;
  const now = new Date();
  const { cooldown = 0 } = conf;
  if (isBefore(now)(ttl)) {
    // rule has expired
    setRuleState(id, { active: false });
    // ruleStore[id] = { ...ruleStore[id], active: false };
    if (onExpired) onExpired(id);
    return true;
  }
  if (onCooldown) {
    const cooledDown = isBefore(now)(addSeconds(cooldown)(lastFired));
    if (cooledDown) setRuleState(id, { onCooldown: false });
    // ruleStore[id] = { ...ruleStore[id], onCooldown: false };
  }
  return false; // continue
};

export const runRule = async (id, vars = {}, parserOptions = {}) => {
  // console.log('runRule:', id, vars, parserOptions, ruleStore[id]);
  const done = checkRule(id);
  if (done) return undefined;
  const {
    conf: { process, resetCondition, condition, resetActions, actions, cooldown },
    flipped,
    onCooldown,
  } = ruleStore[id];
  const parser = functionalParserWithVars(vars, parserOptions);
  if (process) await asyncBlockEvaluator(parser, process);

  if (flipped && resetCondition) {
    const conditionsMet = parser.evalWithLog(resetCondition);
    if (conditionsMet) {
      setRuleState(id, { flipped: false });
      // ruleStore[id] = { ...ruleStore[id], flipped: false };
      return asyncBlockEvaluator(parser, resetActions);
    }
    return undefined;
  }
  // console.log('Last check:', flipped, cooledDown);
  if (flipped || onCooldown) return undefined;

  // console.log('Will run condition:', condition, actions);
  const conditionsMet = parser.evalWithLog(condition);
  // console.log('conditionsMet:', conditionsMet);
  if (conditionsMet) {
    setRuleState(id, { flipped: true, onCooldown: !!cooldown, lastFired: new Date() });
    // console.log('Flipped.', actions, ruleStore[id]);
    // ruleStore[id] = {
    //   ...ruleStore[id],
    //   flipped: true,
    //   onCooldown: !!cooldown,
    //   lastFired: new Date(),
    // };
    return asyncBlockEvaluator(parser, actions);
  }
  return undefined;
};
