import test from 'blue-tape';
import { addYears } from 'date-fns/fp';
import { load, initialRuleState, getTtl, statelessLoad } from '../src/index2';
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
      triggers: [
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

test('parserPatcher effects & arguments', async t => {
  const conf = {
    active: true,
    triggers: [{ msg: ['subscribe', ['`', 'data/default']] }],
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
    actions: [['fire', 1], ['fire', ['var', ['`', 'data']]]],
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
        fire: value => {
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
    resetActions: [['fire', 1], ['fire', ['var', ['`', 'data']]]],
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
      fire: value => {
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

test('Should handle cooldown', async t => {
  const conf = {
    active: true,
    cooldown: 1,
    condition: ['if', true, true],
    actions: [['fire', 1]],
  };
  let result = 0;
  const targetResult = 1;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  const parserOptions = {
    envExtra: {
      fire: value => {
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

test('Should handle cooldown together with reset', async t => {
  const conf = {
    active: true,
    cooldown: 1,
    condition: ['if', true, true],
    actions: [['fire', 1]],
    resetCondition: ['if', true, true],
    resetActions: [['fire', 1]],
  };
  let result = 0;
  const targetResult = 2;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  const parserOptions = {
    envExtra: {
      fire: value => {
        result += Number(value);
        if (result >= targetResult) setDone();
      },
    },
  };
  const [state, run] = await statelessLoad(conf);
  await run(state, { parserOptions });
  await new Promise(r => setTimeout(r, 1000));
  await run(state, { parserOptions });
  await done;
  t.equals(result, targetResult);
});

test('README example 1', async t => {
  const conf = {
    active: true,
    cooldown: 3,
    triggers: [{ msg: ['subscribe', ['`', 'temperature']] }],
    process: [
      { position: ['rpc', ['`', 'getGPSData']] },
      {
        weather: [
          'rpc',
          ['`', 'readWeather'],
          ['R.objOf', ['`', 'position'], ['var', ['`', 'position']]],
        ],
      },
      { tempDiff: ['var', ['`', 'weather.parameters.t']] },
      { tooFarOff: ['.', 'Math', ['`', 'abs'], ['var', ['`', 'tempDiff']]] },
    ],
    // condition: ['if', true, true],
    actions: [['fire', 1]],
    resetCondition: ['if', true, true],
    resetActions: [['fire', 1]],
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
  const options = {
    parserOptions: {
      envExtra: {
        rpc: (name, args) => {
          console.log('---> RPC:', name, args);
          if (name === 'getGPSData') {
            t.equals(args, undefined);
            return new Promise(r => setTimeout(r({ lon: 15, lat: 55 }), 100));
          }
          if (name === 'readWeather') {
            t.equals(args.position.lon, 15);
            // if (args.position.lon !== 15) throw new Error('WRONG PARAM');
            return new Promise(r => setTimeout(r({ parameters: { t: -3.2 } }), 100));
          }
          throw new Error('WRONG RPC NAME');
        },
        fire: value => {
          result += Number(value);
          if (result >= targetResult) setDone();
        },
      },
    },
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
  await run();
  await new Promise(r => setTimeout(r, 1000));
  await run();
  await done;
  if (timerHandle) clearInterval(timerHandle);
  t.equals(result, targetResult);
});
