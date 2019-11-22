# json-rule-processor

Load and run async "JSON-Lisp" configurations - with triggers, conditions, actions & more.

This package is meant to give a ton of possibilities to what a JSON/JS configuration can do. It will turn a serializable JS object notation into a functional asynchronous programming language, optionally packaged as a "rule configuration".

## miniMAL syntax

The _rule config_ part of this package is the last step in a small staircase of abstractions, where the first step is [`miniMAL`](https://github.com/kanaka/miniMAL) which is an awesome invention by Joel Martin. **Go check out `miniMAL` first**, to get a hunch about the strange "json lisp" syntax that this library uses and will appear in all examples below.

## Extended parser

But as a first abstraction on where miniMAL leaves off, `minimalLispParser` is a bit more real world useful:

```js
import { minimalLispParser } from 'json-rule-processor/dist/minimal-lisp-parser';

const parserOptions = { envExtra: { add5: x => x + 5 } };
const parser = minimalLispParser(parserOptions);

const cmd = ['add5', 3];
parser.evaluate(cmd); // -> 8
```

### `minimalLispParser` - `options`

- **env**: Object of the entire additional set of functions and identifiers to add to the parser. If this is not used, the default set of functionality is added, see below.
- **envExtra = {}**: This is where additional functions can be added to the parser, on top of the default set.
- **keepJsEval = false**: By default, `eval` of JavaScript in strings is turned **off** for security reasons, but can be activated with this flag.
- **doLog**: When using `parser.evaluate`, this tells the parser to log to the console the input and output of the evaluation.

## More extended parser

As a second step, this package offers **functional programming utilities** (ramda & date-fns) to the very basic set of functions offered by miniMAL itself, and it can also add a **controlled scope of variables** that can be used as a bridge to surrounding JavaScript:

```js
import { functionalParserWithVars } from 'json-rule-processor/dist/minimal-lisp-parser';

const vars = { value: 5 };
const parser = functionalParserWithVars(vars, parserOptions); // parserOptions like above

const cmd = ['var', ['`', 'result'], ['D.addSeconds', ['var', ['`', 'value']], ['new', 'Date']]];
parser.evaluate(cmd);
```

**IN PSEUDO:** `vars.result = new Date() + seconds(vars.value)`

`vars.result` will contain a `Date` object representing 5 seconds from now. (The return value of the parse will also be this value).

The functional programming utilities that are added in the `functionalParserWithVars` are [Ramda](https://ramdajs.com/) & [Date-fns/FP](https://date-fns.org/) (select FP in the drop-down in the top right corner of the docs). They are accessed through `R.` & `D.`.

The `var` command gets a variable from the variable scope if it is given _one_ argument. If a value is given after the variable name (2 arguments), it is instead assigned. The first parameter can be written as a path, since it uses [`lodash.get`](https://lodash.com/docs/4.17.15#get).

## miniMAL command blocks (sync/async)

The next abstraction utility that builds on the above is a possibility of running blocks of miniMAL code to be run both synchronously, and asynchronously in parallel:

A block is an Array of miniMAL commands, run in sequence/imperatively: `[['log', true], ['+', 1, 2]]`.

A variant of this is an Array of Objects, where everything in the same object will be run in parallel, and in sequence if commands are in different objects. The keys becomes variables inside `vars` and may be referenced later in the block:

```js
import { asyncBlockEvaluator } from 'json-rule-processor/dist/minimal-lisp-parser';

const parserOptions = {
  envExtra: {
    fetcher: url => /*...*/,
    rpc: (id, args) => /*...*/,
  },
};
const parser = functionalParserWithVars(...[, parserOptions]); // default vars = {}

const cmdBlock = [
  { position: ['fetcher', ['`', '?f=locationData']] },
  {
    weather: [
      'rpc',
      ['`', 'readWeather'],
      ['R.objOf', ['`', 'position'], ['var', ['`', 'position']]],
    ],
    indoorTemp: ['rpc', ['`', 'getTemperature']],
  },
  { tempDiff: ['-', ['var', ['`', 'weather.parameters.temp']], ['var', ['`', 'indoorTemp']]] },
];

await asyncBlockEvaluator(parser, cmdBlock);
```

Basically, a somewhat **corresponding JavaScript** version of above `cmdBlock` would be:

```js
vars.position = await fetcher('?f=locationData');
[vars.weather, vars.indoorTemp] = await Promise.all([
  rpc('readWeather', { position: vars.position }),
  rpc('getTemperature'),
]);
vars.tempDiff = vars.weather.parameters.temp - vars.indoorTemp;
```

Finally we are at the last step of the abstractions staircase, where **"rules"** are possible. These rules are defined by configurations containing a set of keys defined by `rule-dm.js`.

```js
const conf = {
  active: true,
  cooldown: 3,
  onLoad: [{ msg: ['subscribe', ['`', 'temperature']] }],
  process: [
    { position: ['fetcher', ['`', '?f=locationData']] },
    {
      weather: [
        'rpc',
        ['`', 'readWeather'],
        ['R.objOf', ['`', 'position'], ['var', ['`', 'position']]],
      ],
    },
    { tempDiff: ['-', ['var', ['`', 'weather.parameters.temp']], 20] },
    { tooCold: ['<', ['var', ['`', 'tempDiff']], -2] },
    { closeEnough: ['>', ['var', ['`', 'tempDiff']], -0.5] },
  ],
  condition: ['var', ['`', 'tooCold']],
  actions: [['rpc', ['`', 'startHeater']]],
  resetCondition: ['var', ['`', 'closeEnough']],
  resetActions: [['rpc', ['`', 'stopHeater']]],
};

const parserOptions = {
  envExtra: {
    fetcher: url => /*...*/,
    rpc: (id, args) => /*...*/,
  },
};

const runOptions = { parserOptions, reuseParser: true };

const client = { // Example pub/sub client
  sub: (channel, onMsg) => /*...*/,
};
let run;

const loadOptions = {
  // parserPatcher is ONLY needed for the special case of wanting a dynamic value into the object
  // key in the config ('msg' in this case). Normal case would be to put 'subscribe' in envExtra.
  parserPatcher: (parser, triggerKey) => {
    parser.subscribe = channel =>
      client.sub(channel, msg => {
        run({ ...runOptions, ...(triggerKey ? { vars: { [triggerKey]: msg } } : {}) });
      });
  },
  parserOptions,
};
run = await load(conf, loadOptions);
```
