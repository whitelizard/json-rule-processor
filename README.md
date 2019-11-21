# json-rule-processor

Load and run async "JSON-Lisp" configurations - with triggers, conditions, actions & more.

This package is meant to give a ton of possibilities to what a JSON configuration can do. It will turn JSON into a functional asynchronous programming language, but packaged as "rule configurations".

## By example

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
    rpc: (id, args) => /*...*/,
    fetcher: url => /*...*/,
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
