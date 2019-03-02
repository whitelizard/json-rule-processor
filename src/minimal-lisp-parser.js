import miniMAL from 'minimal-lisp';
import { get } from 'lodash/fp';
import { set } from 'lodash';
import * as R from 'ramda';
import fetch from 'node-fetch';
import * as dateFns from 'date-fns/fp';
// import { createStore } from 'redux';

export const getOrSet = vars => (path, x) =>
  x === undefined ? get(path, vars) : get(path, set(vars, path, x));

export const minimalLispParser = ({ envExtra = {}, keepJsEval = false, vars = {} } = {}) => {
  const parser = miniMAL({
    undefined,
    typeof: a => typeof a, // renaming of miniMAL's 'type'
    '>': (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '>=': (a, b) => a >= b,
    '===': (a, b) => a === b,
    '!==': (a, b) => a !== b,
    '%': (a, b) => a % b,
    var: getOrSet(vars),
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
  });
  if (!keepJsEval) {
    parser.js = () => {
      throw new Error('Permission denied');
    };
  }
  parser.evalWithLog = (...a) => {
    console.log('miniMAL.eval:', ...a);
    return parser.eval(...a);
  };
  return parser;
};

export const functionalParser = (...args) => {
  const parser = minimalLispParser(...args);
  R.forEachObjIndexed((func, name) => {
    if (name !== 'default') parser[name] = func;
    // if (name !== 'default') parser[`R.${name}`] = func;
  }, R);
  R.forEachObjIndexed((func, name) => {
    if (name !== 'default') parser[name] = func;
    // if (name !== 'default') parser[`R.${name}`] = func;
  }, dateFns);
  return parser;
};

export const asyncBlockEvaluator = (parser, patchParser) => (block = []) =>
  Promise.all(
    block.map(async cmd => {
      if (typeof cmd === 'object' && !Array.isArray(cmd)) {
        const promises = [];
        const promiseKeys = [];
        const values = [];
        const valueKeys = [];
        R.mapObjIndexed((val, key) => {
          console.log(key, val);
          if (patchParser) patchParser(parser, key);
          const result = parser.evalWithLog(val);
          console.log('RESULT:', result);
          if (result && typeof result.then === 'function') {
            promises.push(result);
            promiseKeys.push(key);
          } else {
            values.push(result);
            valueKeys.push(key);
          }
        })(cmd);
        const allValues = [...values, ...(await promises)];
        const allKeys = [...valueKeys, ...promiseKeys];
        R.addIndex(R.forEach)((key, ix) => parser.var(key, allValues[ix]))(allKeys);
        return R.zipObj(allKeys, allValues);
      }
      return parser.evalWithLog(cmd);
    }),
  );

// console.log(Number.isNaN('i'));
// console.log(parser.eval(['if', ['=', 5, 5], 7, 8]));
// console.log(parser.eval(['.', 'Number', ['`', 'isNaN'], 0]));

// const parser1 = extendedParser({});
// const data = [
//   ['R.compose', ['get', ['`', 'pl[0]'], '']],
//   ['propOr', {}, 'msg'],
//   ['var', 'conf', ['read', '{ "test": [1,2,3] }']],
//   { weather: ['rpc', 'weather/read', { pos: [58.2, 15.9] }] },
//   { lastTemp: ['var', 'temperature[0].pl[0]'] },
//   { initTemp: ['var', 'asset[0].params.initTemperature'] },
//   {
//     normalizedPressure: [
//       '-',
//       ['var', 'msg.pl[1]'],
//       ['*', 0.003, ['-', ['var', 'lastTemp'], ['var', 'initTemp']]],
//     ],
//   },
// ];
// asyncBlockEval(parser1, data).then(console.log);
