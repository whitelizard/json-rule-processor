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

const initialEnv = {
  undefined,
  typeof: a => typeof a, // renaming of miniMAL's 'type'
  '>': (a, b) => a > b,
  '<=': (a, b) => a <= b,
  '>=': (a, b) => a >= b,
  '==': (a, b) => a == b,
  '!=': (a, b) => a != b,
  '===': (a, b) => a === b,
  '!==': (a, b) => a !== b,
  '%': (a, b) => a % b,
  '**': (a, b) => a ** b,
};

const basicEnv = {
  get,
  Array,
  Object,
  String,
  Number,
  Date,
  Math,
  parseInt,
  parseFloat,
  Set,
  Map,
  RegExp,
  console,
  log: console.log,
};

const asyncEnv = {
  Promise,
  setInterval,
  setTimeout,
  fetch,
};

const patchParser = ({ doLog, keepJsEval }, parser) => {
  if (!keepJsEval) {
    parser.js = () => {
      throw new Error('Permission denied');
    };
  }
  parser.evalWithLog = (...a) => {
    // DEPRECATED!
    console.log(
      'evalWithLog is deprecated. Use evaluate and control logging with doLog parameter.',
    );
    const result = parser.eval(...a);
    // console.log('[miniMAL parser].eval out:', result);
    return result;
  };
  parser.evaluate = (...a) => {
    if (doLog) console.log('[miniMAL parser].eval in:', ...a);
    const result = parser.eval(...a);
    if (doLog) console.log('[miniMAL parser].eval out:', result);
    return result;
  };
  return parser;
};

export const minimalLispParser = ({ env, envExtra = {}, doLog, keepJsEval } = {}) => {
  const parser = miniMAL({
    ...initialEnv,
    ...(env || {}),
    ...(!env ? { ...basicEnv, ...asyncEnv, ...envExtra } : {}),
  });
  patchParser({ doLog, keepJsEval }, parser);
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
      // const result = parser.evaluate(val);
      return new Promise(r => r(parser.evaluate(val))).catch(err => {
        console.warn('[miniMAL block parser]', val, '->', err);
        return undefined;
      });
      // if (result && typeof result.then === 'function') {
      //   return result.catch(err => {
      //     console.warn('[miniMAL block parser]', val, '->', err);
      //     return undefined;
      //   });
      // }
      // return Promise.resolve(result);
    })(cmd);
    const orderedPairs = R.toPairs(promiseMap);
    const keys = R.map(R.prop(0))(orderedPairs);
    const vals = R.map(R.prop(1))(orderedPairs);
    const resolvedValues = await Promise.all(vals);
    R.addIndex(R.forEach)((key, ix) => parser.var(key, resolvedValues[ix]))(keys);
    return R.zipObj(keys, resolvedValues);
  }
  const result = parser.evaluate(cmd);
  if (result && typeof result.then === 'function') {
    return result.catch(err => {
      console.warn('[miniMAL block parser]', cmd, '->', err);
      return undefined;
    });
  }
  return result;
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
