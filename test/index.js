import test from 'blue-tape';
import { addYears } from 'date-fns/fp';
import { loadRule, runRule } from '../src/index';
import { getOrSet } from '../src/minimal-lisp-parser';

// const aTimestamp = 1521663819160 / 1000;
let idCounter = 0;
const getId = () => {
  idCounter += 1;
  return idCounter;
};

test('Parser "var" should modify vars', async t => {
  const vars = { test: 1 };
  const myVar = getOrSet(vars);
  myVar('test', 2);
  t.equals(vars.test, 2);
  t.equals(myVar('test'), 2);
});

test('No ID should throw', async t => {
  t.shouldFail(loadRule({}));
});

test('Custom ID key should be accepted', async t => {
  await loadRule({ rid: getId() }, { idKey: 'rid' });
  t.ok(true); // didn't throw
});

test("Shouldn't load rule if not active", async t => {
  const id = getId();
  await loadRule({ id });
  t.shouldFail(runRule(id));
});

test('Should handle ttl expired', async t => {
  const id = getId();
  let expired = false;
  const triggerVars = { triggersProcessed: false };
  const vars = { processUnprocessed: true };
  await loadRule(
    {
      id,
      active: true,
      ttl: new Date(),
      triggers: [
        ['var', ['`', 'triggersProcessed'], true],
        ['log', ['var', ['`', 'triggersProcessed']]],
      ],
      process: [['var', ['`', 'processUnprocessed'], false]],
    },
    {
      onExpired: () => {
        expired = true;
      },
      vars: triggerVars,
    },
  );
  await runRule(id, { vars });
  t.ok(expired);
  t.ok(triggerVars.triggersProcessed);
  t.ok(vars.processUnprocessed);
});

test('parserPatcher effects & arguments', async t => {
  const id = getId();
  const ruleConf = {
    id,
    active: true,
    triggers: [{ msg: ['subscribe', ['`', 'data/default']] }],
  };
  const client = {
    sub: (_, cb) => {
      setTimeout(() => cb({ ts: String(Date.now() / 1000), pl: [3] }), 10);
    },
  };
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  await loadRule(ruleConf, {
    parserPatcher: (parser, triggerKey) => {
      parser.subscribe = ch =>
        client.sub(ch, msg => {
          t.equals(msg.pl[0], 3);
          t.equals(triggerKey, 'msg');
          setDone();
          // runRule(ruleConf.rid, triggerKey ? { [triggerKey]: msg } : {});
        });
    },
  });
  await done;
});

test('Should handle asyncs/promises in process', async t => {
  const id = getId();
  const ruleConf = {
    id,
    active: true,
    process: [{ asset: ['rpc', ['`', 'data']] }, { theAsset: ['var', ['`', 'asset']] }],
  };
  const vars = {};
  await loadRule(ruleConf);
  await runRule(id, {
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
  const id = getId();
  const ruleConf = {
    id,
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
  await loadRule(ruleConf);
  await runRule(id, {
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
  const id = getId();
  const ruleConf = {
    id,
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
  await loadRule(ruleConf);
  await runRule(id, { vars, parserOptions });
  await runRule(id, { vars, parserOptions });
  await done;
  t.equals(result, targetResult);
});

test('Should handle cooldown', async t => {
  const id = getId();
  const ruleConf = {
    id,
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
  await loadRule(ruleConf);
  await runRule(id, { parserOptions });
  await runRule(id, { parserOptions });
  await done;
  t.equals(result, targetResult);
});

test('Should handle cooldown together with reset', async t => {
  const id = getId();
  const ruleConf = {
    id,
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
  await loadRule(ruleConf);
  await runRule(id, { parserOptions });
  await new Promise(r => setTimeout(r, 1000));
  await runRule(id, { parserOptions });
  await done;
  t.equals(result, targetResult);
});

test('README example 1', async t => {
  const id = getId();
  const ruleConf = {
    id,
    active: true,
    cooldown: 3,
    triggers: [{ msg: ['subscribe', ['`', 'temperature']] }],
    process: [
      { position: ['rpc', ['`', 'getGPSData']] },
      { weather: ['rpc', ['`', 'readWeather'], { position: ['var', ['`', 'position']] }] },
      { tempDiff: ['get', ['`', 'weather.parameters.t']] },
      { tooFarOff: ['.', 'Math', ['`', 'abs'], ['var', ['`', 'tempDiff']]] },
    ],
    condition: ['if', true, true],
    actions: [['fire', 1]],
    resetCondition: ['if', true, true],
    resetActions: [['fire', 1]],
  };
  let timerHandle;
  const client = {
    sub: (_, onMsg) => {
      timerHandle = setInterval(() => onMsg({ ts: String(Date.now() / 1000), pl: [3] }), 500);
    },
  };
  let result = 0;
  const targetResult = 2;
  // let setDone;
  // const done = new Promise(r => {
  //   setDone = r;
  // });
  const parserOptions = {
    envExtra: {
      rpc: name => new Promise(r => setTimeout(r(name), 100)),
      fire: value => {
        result += Number(value);
        if (result >= targetResult) setDone();
      },
    },
  };
  await loadRule(ruleConf, {
    parserPatcher: (parser, triggerKey) => {
      parser.subscribe = ch =>
        client.sub(ch, msg => {
          runRule(ruleConf.rid, triggerKey ? { [triggerKey]: msg } : {});
        });
    },
  });
  // t.equals(msg.pl[0], 3);
  // t.equals(triggerKey, 'msg');
  // setDone();
  await runRule(id, { parserOptions });
  await new Promise(r => setTimeout(r, 1000));
  await runRule(id, { parserOptions });
  await done;
  if (timerHandle) clearInterval(timerHandle);
  t.equals(result, targetResult);
});
