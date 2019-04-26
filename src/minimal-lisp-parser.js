import miniMAL from 'minimal-lisp';
import get from 'lodash/fp/get';
import set from 'lodash/set';
import * as R from 'ramda';
import * as dateFns from 'date-fns/fp';
import fetch from 'cross-fetch';

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
  // console.log('miniMAL parser:', parser);
  return parser;
};

export const withVars = (vars = {}) => parser => {
  parser.var = getOrSet(vars);
  return parser;
};

export const withFunctional = parser => {
  // const parser = minimalLispParser(...args);
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
    const promises = [];
    const promiseKeys = [];
    const values = [];
    const valueKeys = [];
    R.mapObjIndexed((val, key) => {
      if (parserPatcher) parserPatcher(parser, key);
      const result = parser.evalWithLog(val);
      // console.log('RESULT:', result);
      if (result && typeof result.then === 'function') {
        promises.push(result);
        promiseKeys.push(key);
      } else {
        values.push(result);
        valueKeys.push(key);
      }
    })(cmd);
    // console.log('RESULTS 1:', promiseKeys, promises, valueKeys, values);
    const promiseValues = await Promise.all(promises);
    const allValues = [...values, ...promiseValues];
    const allKeys = [...valueKeys, ...promiseKeys];
    // console.log('RESULTS 2:', allKeys, allValues);
    R.addIndex(R.forEach)((key, ix) => parser.var(key, allValues[ix]))(allKeys);
    return R.zipObj(allKeys, allValues);
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
