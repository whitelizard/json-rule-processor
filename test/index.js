import { test } from 'tap';
import * as R from 'ramda';
import { load, statelessLoad } from '../src';
import { getOrSet, minimalLispParser, functionalParserWithVars } from '../src/minimal-lisp-parser';
import { Rule } from '../src/rule-dm';

test('Basic parser stuff', async t => {
  const parserOptions = { envExtra: { add5: x => x + 5 } };
  const parser = minimalLispParser(parserOptions);
  const cmd = ['add5', 3];
  t.equals(parser.evaluate(cmd), 8);

  const vars = { value: 5 };
  const parser2 = functionalParserWithVars(vars, parserOptions);
  const cmd2 = ['R.T'];
  t.equals(parser2.evaluate(cmd2), true);
  const cmd3 = ['var', ['`', 'result'], ['D.addSeconds', ['var', ['`', 'value']], ['new', 'Date']]];
  const parsed = parser2.evaluate(cmd3);

  t.equals(parsed, vars.result);
  t.equals(R.startsWith('2')(vars.result.toISOString()), true);
  t.equals(R.endsWith('Z')(vars.result.toISOString()), true);
});

test('Parser "var" should modify vars', async t => {
  const vars = { test: 1 };
  const myVar = getOrSet(vars);
  myVar('test', 2);
  t.equals(vars.test, 2);
  t.equals(myVar('test'), 2);
});

test('Load broken rule config -> validation error', async t => {
  await statelessLoad({ active: 'foo' }).catch(err => {
    t.equals(err.message, '"active" must be a boolean');
  });
  await statelessLoad({ foo: 1 }).catch(err => {
    t.equals(err.message, '"foo" is not allowed');
  });
});

test('Load empty rule -> initial state + function', async t => {
  const [state, run] = await statelessLoad({});
  const { active, flipped, onCooldown, lastFired, ttl } = state;
  t.equals(active || flipped || onCooldown, false);
  t.equals(!!lastFired && !!ttl, true);
  t.equals(typeof run, 'function');
});

test("Shouldn't run rule if not active", async t => {
  const [state, run] = await statelessLoad({});
  const [, result] = await run(state);
  t.equals(result, undefined);
});

test('Should handle ttl expired', async t => {
  const conf = {
    active: true,
    ttl: new Date(),
    onLoad: [
      ['var', ['`', 'triggersProcessed'], true],
      ['log', ['var', ['`', 'triggersProcessed']]],
    ],
    process: [['var', ['`', 'processUnprocessed'], false]],
  };
  t.equals(!Rule.validate(conf).error, true);
  let expired = false;
  const triggerVars = { triggersProcessed: false };
  const vars = { processUnprocessed: true };
  const [state, run] = await statelessLoad(conf, { vars: triggerVars });
  const [, result] = await run(state, {
    vars,
    onExpired: () => {
      expired = true;
    },
  });
  t.equals(result, undefined);
  t.equals(expired, true);
  t.equals(triggerVars.triggersProcessed, true);
  t.equals(vars.processUnprocessed, true);
});

test('Should handle onLoad error', async t => {
  const conf = {
    active: true,
    onLoad: [['nothing', 0]],
  };
  t.equals(!Rule.validate(conf).error, true);
  let result;
  await load(conf).catch(() => (result = 'error'));
  t.equals(result, 'error');
});

test('Should handle process error', async t => {
  let result;
  const run = await load({
    active: true,
    process: [['nothing', 0]],
  });
  await run().catch(() => (result = 'error'));
  t.equals(result, 'error');
});

test('Should handle condition error', async t => {
  let result;
  const run = await load({
    active: true,
    condition: ['nothing', 0],
  });
  await run().catch(() => (result = 'error'));
  t.equals(result, 'error');
});

test('Should handle actions error', async t => {
  let result;
  const run = await load({
    active: true,
    actions: [['nothing', 0]],
  });
  await run().catch(() => (result = 'error'));
  t.equals(result, 'error');
});

test('parserPatcher effects & arguments', async t => {
  const conf = {
    active: true,
    onLoad: [{ msg: ['subscribe', ['`', 'data/default']] }],
  };
  t.equals(!Rule.validate(conf).error, true);
  const sub = (_, cb) => {
    setTimeout(() => cb({ ts: String(Date.now() / 1000), pl: [3] }), 10);
  };
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  // const [state, run] =
  await statelessLoad(conf, {
    parserPatcher: (parser, triggerKey) => {
      parser.subscribe = ch =>
        sub(ch, msg => {
          t.equals(msg.pl[0], 3);
          t.equals(triggerKey, 'msg');
          setDone();
          // run(conf.rid, triggerKey ? { [triggerKey]: msg } : {});
        });
    },
  });
  await done;
});

test('Should handle asyncs/promises in process', async t => {
  const conf = {
    active: true,
    process: [{ asset: ['rpc', ['`', 'data']] }, { theAsset: ['var', ['`', 'asset']] }],
  };
  t.equals(!Rule.validate(conf).error, true);
  const vars = {};
  const [state, run] = await statelessLoad(conf);
  await run(state, {
    vars,
    parserOptions: {
      envExtra: {
        rpc: name => new Promise(r => setTimeout(r(name), 100)),
      },
    },
  });
  t.equals(vars.asset, 'data');
  t.equals(vars.theAsset, 'data');
});

test('Should fire actions with data from process', async t => {
  const conf = {
    active: true,
    process: [{ data: ['rpc', 1] }],
    condition: ['if', true, true],
    actions: [
      ['add', 1],
      ['add', ['var', ['`', 'data']]],
    ],
  };
  t.equals(!Rule.validate(conf).error, true);
  let result = 0;
  const targetResult = 2;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  const [state, run] = await statelessLoad(conf);
  await run(state, {
    parserOptions: {
      envExtra: {
        rpc: name => new Promise(r => setTimeout(r(name), 100)),
        add: value => {
          result += Number(value);
          if (result >= targetResult) setDone();
        },
      },
    },
  });
  await done;
  t.equals(result, targetResult);
});

test('Should not run actions if conditions not met', async t => {
  const conf = {
    active: true,
    process: [{ data: 1 }],
    condition: ['if', true, false],
    actions: [
      ['add', 1],
      ['add', ['var', ['`', 'data']]],
    ],
  };
  t.equals(!Rule.validate(conf).error, true);
  let result = 0;
  const targetResult = 0;
  const [state, run] = await statelessLoad(conf);
  await run(state, {
    parserOptions: {
      envExtra: {
        add: value => {
          result += Number(value);
        },
      },
    },
  });
  t.equals(result, targetResult);
});

test('Should check resetCondition and fire resetActions', async t => {
  const conf = {
    active: true,
    process: [{ data: ['rpc', 1] }],
    condition: ['if', true, true],
    resetCondition: ['if', true, true],
    resetActions: [
      ['add', 1],
      ['add', ['var', ['`', 'data']]],
    ],
  };
  t.equals(!Rule.validate(conf).error, true);
  const vars = {};
  let result = 0;
  const targetResult = 2;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  const parserOptions = {
    envExtra: {
      rpc: name => new Promise(r => setTimeout(r(name), 100)),
      add: value => {
        result += Number(value);
        if (result >= targetResult) setDone();
      },
    },
  };
  const [state, run] = await statelessLoad(conf);
  const [state2] = await run(state, { vars, parserOptions });
  await run(state2, { vars, parserOptions });
  await done;
  t.equals(result, targetResult);
});

test('Should handle cooldown - block', async t => {
  const conf = {
    active: true,
    cooldown: 1,
    condition: ['if', true, true],
    actions: [['add', 1]],
  };
  t.equals(!Rule.validate(conf).error, true);
  let result = 0;
  const targetResult = 1;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  const parserOptions = {
    envExtra: {
      add: value => {
        result += Number(value);
        if (result >= targetResult) setDone();
      },
    },
  };
  const [state, run] = await statelessLoad(conf);
  const [state2] = await run(state, { parserOptions });
  await run(state2, { parserOptions });
  await done;
  t.equals(result, targetResult);
});

test('Should handle cooldown - pass on no cooldown', async t => {
  const conf = {
    active: true,
    // cooldown: 0,
    condition: ['if', true, true],
    actions: [['add', 1]],
  };
  t.equals(!Rule.validate(conf).error, true);
  let result = 0;
  const targetResult = 2;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  const add = value => {
    result += Number(value);
    if (result >= targetResult) setDone();
  };
  const parserOptions = { envExtra: { add } };
  const [state, run] = await statelessLoad(conf);
  const [state2] = await run(state, { parserOptions });
  await run(state2, { parserOptions });
  await done;
  t.equals(result, targetResult);
});

test('Should handle cooldown - pass on small cooldown and a wait', async t => {
  const conf = {
    active: true,
    cooldown: 0.001,
    condition: ['if', true, true],
    actions: [['add', 1]],
  };
  t.equals(!Rule.validate(conf).error, true);
  let result = 0;
  const targetResult = 2;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  const add = value => {
    // console.log('FIRE!', value);
    result += Number(value);
    if (result >= targetResult) setDone();
  };
  const parserOptions = { envExtra: { add } };
  const [state, run] = await statelessLoad(conf);
  const [state2] = await run(state, { parserOptions });
  await new Promise(r => setTimeout(r, 10));
  await run(state2, { parserOptions });
  await done;
  t.equals(result, targetResult);
});

test('Should handle cooldown together with reset', async t => {
  const conf = {
    active: true,
    cooldown: 1,
    condition: ['if', true, true],
    actions: [['add', 1]],
    resetCondition: ['if', true, true],
    resetActions: [['add', 100]],
  };
  t.equals(!Rule.validate(conf).error, true);
  let result = 0;
  const targetResult = 102;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  const add = value => {
    // console.log('FIRE!', value);
    result += Number(value);
    if (result >= targetResult) setDone();
  };
  const parserOptions = { envExtra: { add } };
  const [state, run] = await statelessLoad(conf);
  // console.log('1:', state);
  const [state2] = await run(state, { parserOptions });
  // console.log('2:', state2);
  const [state3] = await run(state2, { parserOptions });
  // console.log('3:', state3);
  const [state4] = await run(state3, { parserOptions });
  await new Promise(r => setTimeout(r, 1200));
  // console.log('4:', state4);
  // const [state5] =
  await run(state4, { parserOptions });
  // console.log('5:', state5);
  await done;
  t.equals(result, targetResult);
});

test('Should handle reset', async t => {
  const conf = {
    active: true,
    condition: ['if', true, true],
    actions: [['add', 1]],
    resetCondition: ['getSignal'],
    resetActions: [['add', 100]],
  };
  t.equals(!Rule.validate(conf).error, true);
  let result = 0;
  const targetResult = 102;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  const add = value => {
    result += Number(value);
    if (result >= targetResult) setDone();
  };
  let signal = false;
  const getSignal = () => signal;
  const parserOptions = { envExtra: { add, getSignal } };
  let [state, run] = await statelessLoad(conf); // eslint-disable-line prefer-const
  // console.log('1:', state);
  [state] = await run(state, { parserOptions });
  // console.log('2:', state2);
  [state] = await run(state, { parserOptions });
  [state] = await run(state, { parserOptions });
  [state] = await run(state, { parserOptions });
  // console.log('3:', state3);
  signal = true;
  [state] = await run(state, { parserOptions });
  // console.log('4:', state4);
  // const [state5] =
  await run(state, { parserOptions });
  // console.log('5:', state5);
  await done;
  t.equals(result, targetResult);
});

test('Use timeout', async t => {
  const conf = {
    active: true,
    condition: ['if', true, true],
    actions: [
      [
        'setTimeout',
        [
          'fn',
          [],
          [
            'rpc',
            ['`', 'mailer/send'],
            [
              '`',
              {
                to: ['test@test.test'],
              },
            ],
          ],
        ],
        2000,
      ],
    ],
  };
  t.equals(!Rule.validate(conf).error, true);
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  console.log('WAITING ---------------------------');
  // const signal = false;
  const ts = new Date(Date.now() + 600);
  const rpc = () => {
    console.log(ts, new Date());
    t.ok(new Date() > ts, 'Timeout not working');
    setDone();
  };
  const parserOptions = { envExtra: { rpc } };

  let [state, run] = await statelessLoad(conf); // eslint-disable-line prefer-const
  // console.log('1:', state);
  [state] = await run(state, { parserOptions });
  await done;
});

//
//  TODO: if reuseParser, vars should be merged/loaded????
//

test('README example 1', async t => {
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
      {
        tooCold: ['<', ['var', ['`', 'tempDiff']], -2],
        closeEnough: ['>', ['var', ['`', 'tempDiff']], -0.5],
      },
    ],
    condition: ['var', ['`', 'tooCold']],
    actions: [['rpc', ['`', 'startHeater']]],
    resetCondition: ['var', ['`', 'closeEnough']],
    resetActions: [['rpc', ['`', 'stopHeater']]],
  };
  t.equals(!Rule.validate(conf).error, true);
  let result = 0;
  const targetResult = 2;
  let setDone;
  const done = new Promise(r => (setDone = r));
  let run;

  const parserOptions = {
    envExtra: {
      rpc: (name, args) => {
        console.log('---> RPC:', name, args);
        if (name === 'readWeather') {
          t.equals(args.position.lon, 15);
          return new Promise(r => setTimeout(r({ parameters: { temp: 12 + 7.8 * result } }), 100));
        }
        if (name === 'startHeater') {
          result += 1;
          return undefined;
        }
        if (name === 'stopHeater') {
          result += 1;
          return setDone();
        }
        throw new Error('WRONG RPC NAME');
      },
      fetcher: () => {
        return new Promise(r => setTimeout(r({ lon: 15, lat: 55 }), 100));
      },
    },
  };

  const runOptions = { parserOptions, reuseParser: true };

  let timerHandle;
  const client = {
    sub: (_, onMsg) => {
      timerHandle = setInterval(() => onMsg({ ts: new Date().toISOString(), pl: [3] }), 500);
    },
  };
  const loadOptions = {
    parserPatcher: (parser, triggerKey) => {
      parser.subscribe = ch =>
        client.sub(ch, msg => {
          run({ ...runOptions, ...(triggerKey ? { vars: { [triggerKey]: msg } } : {}) });
        });
    },
    parserOptions,
  };
  run = await load(conf, loadOptions);
  // t.equals(msg.pl[0], 3);
  await done;
  if (timerHandle) clearInterval(timerHandle);
  t.equals(result, targetResult);
});
