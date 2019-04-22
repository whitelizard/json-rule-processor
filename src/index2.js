import 'airbnb-js-shims';
import { isBefore, addSeconds, addYears } from 'date-fns/fp';
import { functionalParserWithVars, asyncBlockEvaluator } from './minimal-lisp-parser';

export const initialRuleState = {
  active: false,
  flipped: false,
  onCooldown: false,
  lastFired: addYears(-100)(new Date()),
  // ttl
  // onExpired
};

const checkRule = (conf, state, onExpired) => {
  if (!state) return [true, state];
  const { active, lastFired, onCooldown, ttl } = state;
  if (!active) return [true, state];
  const now = new Date();
  const { cooldown = 0 } = conf;
  if (isBefore(now)(ttl)) {
    // rule has expired
    if (onExpired) onExpired();
    return [true, { ...state, active: false }];
  }
  if (onCooldown) {
    const cooledDown = isBefore(now)(addSeconds(cooldown)(lastFired));
    if (cooledDown) return [false, { ...state, onCooldown: false }]; // continue
  }
  return [false, state]; // continue
};

export const load = async (
  conf,
  { parserOptions: pOptions = {}, parserPatcher, vars: vs = {} } = {},
) => {
  const { triggers, active, ttl: ttlStr = null } = conf;
  const ttl = ttlStr ? new Date(ttlStr) : addYears(100)(new Date());
  const initialState = { ...initialRuleState, active, ttl };
  let parser;
  if (active) {
    parser = functionalParserWithVars(vs, pOptions);
    if (triggers) await asyncBlockEvaluator(parser, triggers, parserPatcher);
    else console.warn('Rule has no triggers:', conf.id || conf.rid || conf.name);
  }

  const runRule = async (
    state = {},
    { reuseParser = false, parserOptions = {}, vars = {}, onExpired },
  ) => {
    // console.log('runRule:', id, vars, parserOptions, state);
    const [done, maybeNewState] = checkRule(conf, state, onExpired);
    if (done) return [maybeNewState, undefined];
    let states = maybeNewState;
    const { process, resetCondition, condition, resetActions, actions, cooldown } = conf;
    const runParser = reuseParser ? parser : functionalParserWithVars(vars, parserOptions);
    if (process) await asyncBlockEvaluator(runParser, process);

    if (states.flipped && resetCondition) {
      const conditionsMet = runParser.evalWithLog(resetCondition);
      if (conditionsMet) {
        states = { ...states, flipped: false };
        return [states, resetActions ? asyncBlockEvaluator(runParser, resetActions) : undefined];
      }
      return [states, undefined];
    }
    const { flipped, onCooldown } = states;
    if (flipped || onCooldown) return [states, undefined];

    const conditionsMet = condition === undefined ? true : runParser.evalWithLog(condition);
    if (conditionsMet) {
      states = { ...states, flipped: true, onCooldown: !!cooldown, lastFired: new Date() };
      return [states, actions ? asyncBlockEvaluator(runParser, actions) : undefined];
    }
    return [states, undefined];
  };
  /* eslint-disable consistent-return */
  return [initialState, runRule];
  /* eslint-enable consistent-return */
};