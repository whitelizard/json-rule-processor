import test from 'blue-tape';
// import { addYears } from 'date-fns/fp';
import { load, statelessLoad } from '../src';
import { getOrSet } from '../src/minimal-lisp-parser';

test('Parser "var" should modify vars', async t => {
  const vars = { test: 1 };
  const myVar = getOrSet(vars);
  myVar('test', 2);
  t.equals(vars.test, 2);
  t.equals(myVar('test'), 2);
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
  let expired = false;
  const triggerVars = { triggersProcessed: false };
  const vars = { processUnprocessed: true };
  const [state, run] = await statelessLoad(
    {
      active: true,
      ttl: new Date(),
      onLoad: [
        ['var', ['`', 'triggersProcessed'], true],
        ['log', ['var', ['`', 'triggersProcessed']]],
      ],
      process: [['var', ['`', 'processUnprocessed'], false]],
    },
    {
      vars: triggerVars,
    },
  );
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
  let result;
  try {
    await load({
      active: true,
      onLoad: ['nothing', 0],
    });
  } catch (err) {
    result = 'error';
  }
  t.equals(result, 'error');
});

test('Should handle process error', async t => {
  let result;
  const run = await load({
    active: true,
    process: ['nothing', 0],
  });
  try {
    await run();
  } catch (err) {
    result = 'error';
  }
  t.equals(result, 'error');
});

test('Should handle condition error', async t => {
  let result;
  const run = await load({
    active: true,
    condition: ['nothing', 0],
  });
  try {
    await run();
  } catch (err) {
    result = 'error';
  }
  t.equals(result, 'error');
});

test('Should handle actions error', async t => {
  let result;
  const run = await load({
    active: true,
    actions: ['nothing', 0],
  });
  try {
    await run();
  } catch (err) {
    result = 'error';
  }
  t.equals(result, 'error');
});

test('parserPatcher effects & arguments', async t => {
  const conf = {
    active: true,
    onLoad: [{ msg: ['subscribe', ['`', 'data/default']] }],
  };
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
    actions: [['add', 1], ['add', ['var', ['`', 'data']]]],
  };
  const vars = {};
  let result = 0;
  const targetResult = 2;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  const [state, run] = await statelessLoad(conf);
  await run(state, {
    vars,
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

test('Should check resetCondition and fire resetActions', async t => {
  const conf = {
    active: true,
    process: [{ data: ['rpc', 1] }],
    condition: ['if', true, true],
    resetCondition: ['if', true, true],
    resetActions: [['add', 1], ['add', ['var', ['`', 'data']]]],
  };
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

//
//  TODO: if reuseParser, vars should be merged/loaded????
//

test('README example 1', async t => {
  const conf = {
    // active: true,
    cooldown: 3,
    onLoad: [{ msg: ['subscribe', ['`', 'temperature']] }],
    // onUnload: [],
    process: [
      { position: ['fetch', ['`', '?f=locationData']] },
      {
        weather: [
          'rpc',
          ['`', 'readWeather'],
          ['R.objOf', ['`', 'position'], ['var', ['`', 'position']]],
        ],
      },
      { tempDiff: ['-', ['var', ['`', 'weather.parameters.temp']], 18] },
      { absDiff: ['.', 'Math', ['`', 'abs'], ['var', ['`', 'tempDiff']]] },
      { tooFarOff: ['>', ['var', ['`', 'tempDiff']], 2] },
      { closeEnough: ['<', ['var', ['`', 'tempDiff']], 1] },
    ],
    condition: ['var', ['`', 'tooFarOff']],
    actions: [['rpc', ['`', 'startHeater']]],
    resetCondition: ['var', ['`', 'closeEnough']],
    resetActions: [['rpc', ['`', 'stopHeater']]],
  };
  let timerHandle;
  const client = {
    sub: (_, onMsg) => {
      timerHandle = setInterval(() => onMsg({ ts: new Date().toISOString, pl: [3] }), 500);
    },
  };
  let result = 0;
  const targetResult = 2;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  let run;

  const parserOptions = {
    envExtra: {
      rpc: (name, args) => {
        console.log('---> RPC:', name, args);
        if (name === 'readWeather') {
          t.equals(args.position.lon, 15);
          // if (args.position.lon !== 15) throw new Error('WRONG PARAM');
          return new Promise(r => setTimeout(r({ parameters: { temp: -3.2 } }), 100));
        }
        throw new Error('WRONG RPC NAME');
      },
      fetch: name => {
        console.log('---> FETCH:', name);
        if (name === '?f=locationData') {
          return new Promise(r => setTimeout(r({ lon: 15, lat: 55 }), 100));
        }
      },
      fire: value => {
        result += Number(value);
        if (result >= targetResult) setDone();
      },
    },
  };
  const options = {
    parserPatcher: (parser, triggerKey) => {
      parser.subscribe = ch =>
        client.sub(ch, msg => {
          run(triggerKey ? { vars: { [triggerKey]: msg } } : {});
        });
    },
  };
  run = await load(conf, options);
  // t.equals(msg.pl[0], 3);
  // t.equals(triggerKey, 'msg');
  // setDone();
  await run({ parserOptions });
  await new Promise(r => setTimeout(r, 1000));
  await run({ parserOptions });
  await done;
  if (timerHandle) clearInterval(timerHandle);
  t.equals(result, targetResult);
});
