import miniMAL from 'minimal-lisp';
import get from 'lodash/fp/get';
import set from 'lodash/set';
import * as R from 'ramda';
import * as dateFns from 'date-fns/fp';
import fetch from 'cross-fetch';

// import { createJispParser } from './jisp';

export const getOrSet = vars => (path, x) => {
  const result = x === undefined ? get(path, vars) : get(path, set(vars, path, x));
  console.log(`[miniMAL parser].var ${path}:`, result);
  return result;
};

export const minimalLispParser = ({ env, envExtra = {}, keepJsEval = false } = {}) => {
  const parser = miniMAL(
    env || {
      undefined,
      typeof: a => typeof a, // renaming of miniMAL's 'type'
      '>': (a, b) => a > b,
      '<=': (a, b) => a <= b,
      '>=': (a, b) => a >= b,
      '===': (a, b) => a === b,
      '!==': (a, b) => a !== b,
      '%': (a, b) => a % b,
      get,
      Array,
      Object,
      String,
      Number,
      Promise,
      Date,
      Math,
      setInterval,
      setTimeout,
      parseInt,
      parseFloat,
      Set,
      Map,
      RegExp,
      fetch,
      console,
      log: console.log,
      ...envExtra,
    },
  );
  if (!keepJsEval) {
    parser.js = () => {
      throw new Error('Permission denied');
    };
  }
  parser.evalWithLog = (...a) => {
    console.log('[miniMAL parser].eval in:', ...a);
    const result = parser.eval(...a);
    console.log('[miniMAL parser].eval out:', result);
    return result;
  };
  return parser;
};

export const withVars = (vars = {}) => parser => {
  parser.var = getOrSet(vars);
  // console.log('miniMAL parser:', parser);
  return parser;
};

export const withFunctional = parser => {
  R.forEachObjIndexed((func, name) => {
    // if (name !== 'default') parser[name] = func;
    if (name !== 'default') parser[`R.${name}`] = func;
  }, R);
  R.forEachObjIndexed((func, name) => {
    parser[`D.${name}`] = func;
  }, dateFns);
  return parser;
};

export const functionalParserWithVars = (vars = {}, parserOptions) =>
  R.compose(
    withFunctional,
    withVars(vars),
    minimalLispParser,
  )(parserOptions);

export const createAsyncEvaluator = (parser, parserPatcher) => async cmd => {
  if (typeof cmd === 'object' && !Array.isArray(cmd)) {
    const promiseMap = R.mapObjIndexed((val, key) => {
      if (parserPatcher) parserPatcher(parser, key);
      const result = parser.evalWithLog(val);
      if (result && typeof result.then === 'function') {
        return result;
      }
      return Promise.resolve(result);
    })(cmd);
    const orderedPairs = R.toPairs(promiseMap);
    const keys = R.map(R.prop(0))(orderedPairs);
    const vals = R.map(R.prop(1))(orderedPairs);
    const resolvedValues = await Promise.all(vals);
    R.addIndex(R.forEach)((key, ix) => parser.var(key, resolvedValues[ix]))(keys);
    return R.zipObj(keys, resolvedValues);
  }
  return parser.evalWithLog(cmd);
};

export const asyncBlockEvaluator = async (parser, block = [], parserPatcher) => {
  const asyncEval = createAsyncEvaluator(parser, parserPatcher);
  const recurser = async (items = [], result = []) => {
    if (R.isEmpty(items)) return result;
    const evaluated = await asyncEval(items[0]);
    return recurser(R.tail(items), R.append(evaluated)(result));
  };
  return recurser(block);
};
