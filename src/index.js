import 'airbnb-js-shims';
import { isBefore, addSeconds, addYears } from 'date-fns/fp';
import { functionalParserWithVars, asyncBlockEvaluator } from './minimal-lisp-parser';

export const initialState = {
  active: false,
  flipped: false, // only connected to resetCondition
  onCooldown: false, // only connected to cooldown
  lastFired: addYears(-100)(new Date()),
  // ttl
  // onExpired
};

const check = (conf, state, onExpired) => {
  if (!state) return [true, state];
  const { active, lastFired, onCooldown, ttl } = state;
  if (!active) return [true, state];
  const now = new Date();
  const { cooldown } = conf;
  if (isBefore(now)(ttl)) {
    // rule has expired
    if (onExpired) onExpired();
    return [true, { ...state, active: false }];
  }
  if (onCooldown && !!cooldown) {
    const cooledDown = isBefore(now)(addSeconds(cooldown)(lastFired));
    if (cooledDown) return [false, { ...state, onCooldown: false }]; // continue
  }
  return [false, state]; // continue
};

export const statelessLoad = async (
  conf = {},
  { customParser, parserOptions: pOptions = {}, parserPatcher, vars: vs = {} } = {},
) => {
  const { onLoad, active = false, ttl: ttlStr = null } = conf;
  const ttl = ttlStr ? new Date(ttlStr) : addYears(100)(new Date());
  const beginState = { ...initialState, active, ttl };
  let parser;
  if (active) {
    parser = customParser || functionalParserWithVars(vs, pOptions);
    if (onLoad) await asyncBlockEvaluator(parser, onLoad, parserPatcher);
    else console.warn('Rule has no onLoad:', conf.id || conf.rid || conf.name || 'Noname');
  }

  const run = async (
    state = {},
    { reuseParser = false, parserOptions = {}, vars = {}, onExpired } = {},
  ) => {
    // console.log('run:', id, vars, parserOptions, state);
    const [done, maybeNewState] = check(conf, state, onExpired);
    if (done) return [maybeNewState, undefined];
    let states = maybeNewState;
    const { process, resetCondition, condition, resetActions, actions, cooldown } = conf;
    const runParser =
      reuseParser && parser ? parser : functionalParserWithVars(vars, parserOptions);
    if (process) await asyncBlockEvaluator(runParser, process);

    if (states.flipped && !!resetCondition) {
      const conditionsMet = runParser.evaluate(resetCondition);
      if (conditionsMet) {
        states = { ...states, flipped: false };
        return [
          states,
          await (resetActions ? asyncBlockEvaluator(runParser, resetActions) : undefined),
        ];
      }
      return [states, undefined];
    }
    const { flipped, onCooldown } = states;
    if (flipped || onCooldown) return [states, undefined];

    const conditionsMet = condition === undefined ? true : runParser.evaluate(condition);
    if (conditionsMet) {
      states = {
        ...states,
        flipped: !!resetCondition,
        onCooldown: !!cooldown,
        lastFired: new Date(),
      };
      return [states, await (actions ? asyncBlockEvaluator(runParser, actions) : undefined)];
    }
    return [states, undefined];
  };
  return [beginState, run];
};

export const load = async (...a) => {
  let state = {};
  const loaded = await statelessLoad(...a);
  [state] = loaded;
  return async (...b) => {
    const runned = await loaded[1](state, ...b);
    [state] = runned;
    return runned[1];
  };
};
