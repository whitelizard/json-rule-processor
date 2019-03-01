import miniMAL from 'minimal-lisp';
import _ from 'lodash/fp';
import * as R from 'ramda';
// import { createStore } from 'redux';

export const minimalLispParser = ({ envExtra = {}, keepJsEval = false }, vars) => {
  const parser = miniMAL({
    undefined,
    typeof: a => typeof a, // renaming of miniMAL's 'type'
    '>': (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '>=': (a, b) => a >= b,
    '===': (a, b) => a === b,
    '!==': (a, b) => a !== b,
    '%': (a, b) => a % b,
    var: (path, x) => (x === undefined ? _.get(path, vars) : _.get(path, _.set(path, x, vars))),
    get: _.get,
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
    // fetch,
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
    console.log('miniMAL.eval:', a);
    return parser.eval(...a);
  };
  return parser;
};

export const extendedParser = (...args) => {
  const parser = minimalLispParser(...args);
  R.forEachObjIndexed((func, name) => {
    parser[`R.${name}`] = func;
  }, R);
  return parser;
};

const parser = minimalLispParser({});
console.log(Number.isNaN('i'));
console.log(parser.eval(['if', ['=', 5, 5], 7, 8]));
console.log(parser.eval(['.', 'Number', ['`', 'isNaN'], 0]));

const data = [
  ['R.compose', ['get', ['`', 'pl[0]'], '']],
  ['propOr', {}, 'msg'],
  ['var', 'conf', ['read', '{ "test": [1,2,3] }']],
  { weather: ['rpc', 'weather/read', { pos: [58.2, 15.9] }] },
  { lastTemp: ['var', 'temperature[0].pl[0]'] },
  { initTemp: ['var', 'asset[0].params.initTemperature'] },
  {
    normalizedPressure: [
      '-',
      ['var', 'msg.pl[1]'],
      ['*', 0.003, ['-', ['var', 'lastTemp'], ['var', 'initTemp']]],
    ],
  },
];

console.log(parser.eval(['compose', ['get', 'pl[0]'], ['propOr', {}, 'msg']]));
