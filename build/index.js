"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.runRule = exports.unloadRule = exports.loadRule = void 0;

require("airbnb-js-shims");

var _fp = require("date-fns/fp");

var R = _interopRequireWildcard(require("ramda"));

var _minimalLispParser = require("./minimal-lisp-parser");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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
var ruleStore = {// <id>: { conf: <ruleConf>, active, flipped, lastFired }
};
var initialRuleState = {
  active: false,
  flipped: false,
  onCooldown: false,
  lastFired: (0, _fp.addYears)(-100)(new Date()) // ttl
  // onExpired

};

var setRuleState = function setRuleState(id, updates, init) {
  ruleStore[id] = _objectSpread({}, init ? initialRuleState : {}, ruleStore[id] || {}, updates);
};

var loadRule =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee(ruleConf) {
    var _ref2,
        _ref2$parserOptions,
        parserOptions,
        _ref2$idKey,
        idKey,
        patchParser,
        onExpired,
        _ref2$vars,
        vars,
        id,
        triggers,
        _ruleConf$actuator,
        actuator,
        active,
        _ruleConf$ttl,
        ttlStr,
        ttl,
        parser,
        _args = arguments;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _ref2 = _args.length > 1 && _args[1] !== undefined ? _args[1] : {}, _ref2$parserOptions = _ref2.parserOptions, parserOptions = _ref2$parserOptions === void 0 ? {} : _ref2$parserOptions, _ref2$idKey = _ref2.idKey, idKey = _ref2$idKey === void 0 ? 'id' : _ref2$idKey, patchParser = _ref2.patchParser, onExpired = _ref2.onExpired, _ref2$vars = _ref2.vars, vars = _ref2$vars === void 0 ? {} : _ref2$vars;
            id = ruleConf[idKey], triggers = ruleConf.triggers, _ruleConf$actuator = ruleConf.actuator, actuator = _ruleConf$actuator === void 0 ? 'backend' : _ruleConf$actuator, active = ruleConf.active, _ruleConf$ttl = ruleConf.ttl, ttlStr = _ruleConf$ttl === void 0 ? null : _ruleConf$ttl;

            if (id) {
              _context.next = 4;
              break;
            }

            throw new Error("No ".concat(idKey, " found in rule"));

          case 4:
            if (!(actuator !== 'backend' || !active)) {
              _context.next = 6;
              break;
            }

            return _context.abrupt("return");

          case 6:
            ttl = ttlStr ? new Date(ttlStr) : (0, _fp.addYears)(100)(new Date());
            setRuleState(id, {
              conf: ruleConf,
              active: active,
              ttl: ttl,
              onExpired: onExpired
            }, true);
            parser = (0, _minimalLispParser.functionalParserWithVars)(vars, parserOptions);

            if (!triggers) {
              _context.next = 14;
              break;
            }

            _context.next = 12;
            return (0, _minimalLispParser.asyncBlockEvaluator)(parser, triggers, patchParser);

          case 12:
            _context.next = 15;
            break;

          case 14:
            console.warn('Rule has no triggers:', id);

          case 15:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function loadRule(_x) {
    return _ref.apply(this, arguments);
  };
}();

exports.loadRule = loadRule;

var unloadRule = function unloadRule(id) {// TODO: ?????????????????????????????????????
  // ruleStore = R.dissoc(id);
};

exports.unloadRule = unloadRule;

var checkRule = function checkRule(id) {
  var _ruleStore$id = ruleStore[id],
      active = _ruleStore$id.active,
      lastFired = _ruleStore$id.lastFired,
      onCooldown = _ruleStore$id.onCooldown,
      conf = _ruleStore$id.conf,
      ttl = _ruleStore$id.ttl,
      onExpired = _ruleStore$id.onExpired;
  if (!active) return true;
  var now = new Date();
  var _conf$cooldown = conf.cooldown,
      cooldown = _conf$cooldown === void 0 ? 0 : _conf$cooldown;

  if ((0, _fp.isBefore)(now)(ttl)) {
    // rule has expired
    setRuleState(id, {
      active: false
    });
    if (onExpired) onExpired(id);
    return true;
  }

  if (onCooldown) {
    var cooledDown = (0, _fp.isBefore)(now)((0, _fp.addSeconds)(cooldown)(lastFired));
    if (cooledDown) setRuleState(id, {
      onCooldown: false
    });
  }

  return false; // continue
};

var runRule =
/*#__PURE__*/
function () {
  var _ref3 = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee2(id) {
    var vars,
        parserOptions,
        done,
        _ruleStore$id2,
        _ruleStore$id2$conf,
        process,
        resetCondition,
        condition,
        resetActions,
        actions,
        cooldown,
        flipped,
        onCooldown,
        parser,
        _conditionsMet,
        conditionsMet,
        _args2 = arguments;

    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            vars = _args2.length > 1 && _args2[1] !== undefined ? _args2[1] : {};
            parserOptions = _args2.length > 2 && _args2[2] !== undefined ? _args2[2] : {};
            // console.log('runRule:', id, vars, parserOptions, ruleStore[id]);
            done = checkRule(id);

            if (!done) {
              _context2.next = 5;
              break;
            }

            return _context2.abrupt("return", undefined);

          case 5:
            _ruleStore$id2 = ruleStore[id], _ruleStore$id2$conf = _ruleStore$id2.conf, process = _ruleStore$id2$conf.process, resetCondition = _ruleStore$id2$conf.resetCondition, condition = _ruleStore$id2$conf.condition, resetActions = _ruleStore$id2$conf.resetActions, actions = _ruleStore$id2$conf.actions, cooldown = _ruleStore$id2$conf.cooldown, flipped = _ruleStore$id2.flipped, onCooldown = _ruleStore$id2.onCooldown;
            parser = (0, _minimalLispParser.functionalParserWithVars)(vars, parserOptions);

            if (!process) {
              _context2.next = 10;
              break;
            }

            _context2.next = 10;
            return (0, _minimalLispParser.asyncBlockEvaluator)(parser, process);

          case 10:
            if (!(flipped && resetCondition)) {
              _context2.next = 16;
              break;
            }

            _conditionsMet = parser.evalWithLog(resetCondition);

            if (!_conditionsMet) {
              _context2.next = 15;
              break;
            }

            setRuleState(id, {
              flipped: false
            });
            return _context2.abrupt("return", (0, _minimalLispParser.asyncBlockEvaluator)(parser, resetActions));

          case 15:
            return _context2.abrupt("return", undefined);

          case 16:
            if (!(flipped || onCooldown)) {
              _context2.next = 18;
              break;
            }

            return _context2.abrupt("return", undefined);

          case 18:
            conditionsMet = parser.evalWithLog(condition);

            if (!conditionsMet) {
              _context2.next = 22;
              break;
            }

            setRuleState(id, {
              flipped: true,
              onCooldown: !!cooldown,
              lastFired: new Date()
            });
            return _context2.abrupt("return", (0, _minimalLispParser.asyncBlockEvaluator)(parser, actions));

          case 22:
            return _context2.abrupt("return", undefined);

          case 23:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  return function runRule(_x2) {
    return _ref3.apply(this, arguments);
  };
}();

exports.runRule = runRule;