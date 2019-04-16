"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.asyncBlockEvaluator = exports.createAsyncEvaluator = exports.functionalParserWithVars = exports.withFunctional = exports.withVars = exports.minimalLispParser = exports.getOrSet = void 0;

var _minimalLisp = _interopRequireDefault(require("minimal-lisp"));

var _fp = require("lodash/fp");

var _lodash = require("lodash");

var R = _interopRequireWildcard(require("ramda"));

var _nodeFetch = _interopRequireDefault(require("node-fetch"));

var dateFns = _interopRequireWildcard(require("date-fns/fp"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _typeof2(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof2 = function _typeof2(obj) { return typeof obj; }; } else { _typeof2 = function _typeof2(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof2(obj); }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// import { createStore } from 'redux';
var getOrSet = function getOrSet(vars) {
  return function (path, x) {
    return x === undefined ? (0, _fp.get)(path, vars) : (0, _fp.get)(path, (0, _lodash.set)(vars, path, x));
  };
};

exports.getOrSet = getOrSet;

var minimalLispParser = function minimalLispParser() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$envExtra = _ref.envExtra,
      envExtra = _ref$envExtra === void 0 ? {} : _ref$envExtra,
      _ref$keepJsEval = _ref.keepJsEval,
      keepJsEval = _ref$keepJsEval === void 0 ? false : _ref$keepJsEval;

  var parser = (0, _minimalLisp.default)(_objectSpread({
    undefined: undefined,
    typeof: function _typeof(a) {
      return _typeof2(a);
    },
    // renaming of miniMAL's 'type'
    '>': function _(a, b) {
      return a > b;
    },
    '<=': function _(a, b) {
      return a <= b;
    },
    '>=': function _(a, b) {
      return a >= b;
    },
    '===': function _(a, b) {
      return a === b;
    },
    '!==': function _(a, b) {
      return a !== b;
    },
    '%': function _(a, b) {
      return a % b;
    },
    // var: getOrSet(vars),
    get: _fp.get,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Promise: Promise,
    Date: Date,
    Math: Math,
    setInterval: setInterval,
    setTimeout: setTimeout,
    parseInt: parseInt,
    parseFloat: parseFloat,
    Set: Set,
    Map: Map,
    RegExp: RegExp,
    fetch: _nodeFetch.default,
    console: console,
    log: console.log
  }, envExtra));

  if (!keepJsEval) {
    parser.js = function () {
      throw new Error('Permission denied');
    };
  }

  parser.evalWithLog = function () {
    var _console;

    for (var _len = arguments.length, a = new Array(_len), _key = 0; _key < _len; _key++) {
      a[_key] = arguments[_key];
    }

    (_console = console).log.apply(_console, ['miniMAL.eval:'].concat(a));

    return parser.eval.apply(parser, a);
  };

  return parser;
};

exports.minimalLispParser = minimalLispParser;

var withVars = function withVars() {
  var vars = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return function (parser) {
    parser.var = getOrSet(vars);
    return parser;
  };
};

exports.withVars = withVars;

var withFunctional = function withFunctional(parser) {
  // const parser = minimalLispParser(...args);
  R.forEachObjIndexed(function (func, name) {
    if (name !== 'default') parser[name] = func; // if (name !== 'default') parser[`R.${name}`] = func;
  }, R);
  R.forEachObjIndexed(function (func, name) {
    parser["D.".concat(name)] = func;
  }, dateFns);
  return parser;
};

exports.withFunctional = withFunctional;

var functionalParserWithVars = function functionalParserWithVars() {
  var vars = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var parserOptions = arguments.length > 1 ? arguments[1] : undefined;
  return R.compose(withFunctional, withVars(vars), minimalLispParser)(parserOptions);
};

exports.functionalParserWithVars = functionalParserWithVars;

var createAsyncEvaluator = function createAsyncEvaluator(parser, patchParser) {
  return (
    /*#__PURE__*/
    function () {
      var _ref2 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee(cmd) {
        var promises, promiseKeys, values, valueKeys, promiseValues, allValues, allKeys;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (!(_typeof2(cmd) === 'object' && !Array.isArray(cmd))) {
                  _context.next = 13;
                  break;
                }

                promises = [];
                promiseKeys = [];
                values = [];
                valueKeys = [];
                R.mapObjIndexed(function (val, key) {
                  if (patchParser) patchParser(parser, key);
                  var result = parser.evalWithLog(val); // console.log('RESULT:', result);

                  if (result && typeof result.then === 'function') {
                    promises.push(result);
                    promiseKeys.push(key);
                  } else {
                    values.push(result);
                    valueKeys.push(key);
                  }
                })(cmd); // console.log('RESULTS 1:', promiseKeys, promises, valueKeys, values);

                _context.next = 8;
                return Promise.all(promises);

              case 8:
                promiseValues = _context.sent;
                allValues = [].concat(values, _toConsumableArray(promiseValues));
                allKeys = [].concat(valueKeys, promiseKeys); // console.log('RESULTS 2:', allKeys, allValues);

                R.addIndex(R.forEach)(function (key, ix) {
                  return parser.var(key, allValues[ix]);
                })(allKeys);
                return _context.abrupt("return", R.zipObj(allKeys, allValues));

              case 13:
                return _context.abrupt("return", parser.evalWithLog(cmd));

              case 14:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      return function (_x) {
        return _ref2.apply(this, arguments);
      };
    }()
  );
};

exports.createAsyncEvaluator = createAsyncEvaluator;

var asyncBlockEvaluator =
/*#__PURE__*/
function () {
  var _ref3 = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee3(parser) {
    var block,
        patchParser,
        asyncEval,
        recurser,
        _args3 = arguments;
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            block = _args3.length > 1 && _args3[1] !== undefined ? _args3[1] : [];
            patchParser = _args3.length > 2 ? _args3[2] : undefined;
            asyncEval = createAsyncEvaluator(parser, patchParser);

            recurser =
            /*#__PURE__*/
            function () {
              var _ref4 = _asyncToGenerator(
              /*#__PURE__*/
              regeneratorRuntime.mark(function _callee2() {
                var items,
                    result,
                    evaluated,
                    _args2 = arguments;
                return regeneratorRuntime.wrap(function _callee2$(_context2) {
                  while (1) {
                    switch (_context2.prev = _context2.next) {
                      case 0:
                        items = _args2.length > 0 && _args2[0] !== undefined ? _args2[0] : [];
                        result = _args2.length > 1 && _args2[1] !== undefined ? _args2[1] : [];

                        if (!R.isEmpty(items)) {
                          _context2.next = 4;
                          break;
                        }

                        return _context2.abrupt("return", result);

                      case 4:
                        _context2.next = 6;
                        return asyncEval(items[0]);

                      case 6:
                        evaluated = _context2.sent;
                        return _context2.abrupt("return", recurser(R.tail(items), R.append(evaluated)(result)));

                      case 8:
                      case "end":
                        return _context2.stop();
                    }
                  }
                }, _callee2, this);
              }));

              return function recurser() {
                return _ref4.apply(this, arguments);
              };
            }();

            return _context3.abrupt("return", recurser(block));

          case 5:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  return function asyncBlockEvaluator(_x2) {
    return _ref3.apply(this, arguments);
  };
}();

exports.asyncBlockEvaluator = asyncBlockEvaluator;