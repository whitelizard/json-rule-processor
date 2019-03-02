import test from 'blue-tape';
import { addYears } from 'date-fns/fp';
import { loadRule, runRule } from '../src/index';
import { getOrSet } from '../src/minimal-lisp-parser';

const rules = [
  {
    rid: 111,
    actuator: 'backend',
    ttl: addYears(100)(new Date()).toJSON(),
    active: true,
    cooldown: 30, // secs
    // condition: ['if', true],
    // triggers: { channels: ['data/default'] },
    triggers: [{ msg: ['subscribe', 'data/default'] }, ['cron', '* * * * * *']],
    process: [
      { asset: ['rpc', 'conf/readAsset', { rids: ['robot1'] }] },
      ['compose', ['get', 'pl[0]'], ['propOr', {}, 'msg']],
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
    ],
    condition: [
      '&&',
      ['>', ['var', 'msg.pl[0]'], 260],
      ['=', ['var', 'asset[0]extra.model'], 'b7'],
      ['<', ['var', 'weather.temp'], -20],
    ],
    actions: [['rpc', 'service/three', { time: ['var', 'msg.ts'] }]],
    // DDD: {
    //   apiCalls: [
    //     // [ RPC-id, args ]
    //     ['mirror/look', { value: ['%get%', 'asset[0]extra.height'] }],
    //     ['service/three', ['%jl%', { var: 'msg.ts' }]],
    //   ],
    //   // publish: [['CH', [1, 2, 3]]],
    //   // timers: {
    //   //   X: [10, 60],
    //   // }
    //   // intervals:
    // },
    resetCondition: ['<', ['var', 'msg.pl.0'], 230],
    resetActions: [['rpc', 'un/fire', { arg: ['var', 'msg.pl.0'] }]],
  },
  {
    rid: 123,
    actuator: 'backend',
    ttl: Date.now() / 1000 + 10,
    active: true,
    cooldown: 30, // secs
    condition: ['if', true],
    // triggers: { channels: ['data/default'] },
    initiate: [{ msg: ['subscribe', 'data/default'] }],
    process: [
      { conf: ['read', '{ "test": [1,2,3] }'] },
      { asset: ['rpc', 'conf/readAsset', { rids: ['robot1'] }] },
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
    ],
    actions: {
      apiCalls: [
        // [ RPC-id, args ]
        ['mirror/look', { value: ['%get%', 'asset[0]extra.height'] }],
        ['service/three', ['%jl%', { var: 'msg.ts' }]],
      ],
      // publish: [['CH', [1, 2, 3]]],
      // timers: {
      //   X: [10, 60],
      // }
      // intervals:
    },
    resetCondition: {
      '<': [{ var: 'msg.pl.0' }, 230],
    },
    resetActions: {
      apiCalls: [['un/fire', ['%jl%', { var: 'msg.pl.0' }]]],
    },
  },
  {
    triggers: {
      channels: ['data/jepv16uc-5pywzxsbmlm'],
    },
    actions: {
      pub: [
        [
          'data/jf32nbju-ably329u7q4',
          [
            ['%get%', 'timeToMaintenance'],
            ['%get%', 'cyclesToMaintenance'],
            ['%get%', 'remainingPressure'],
          ],
        ],
      ],
    },
    condition: {
      if: true,
    },
    externalData: {
      asset: [
        'conf/readAsset',
        {
          rids: ['jepvdrf1-2bd8fwjl9gs'],
        },
      ],
      temperature: [
        'data-history/read',
        {
          rid: 'jepv16uc-5pywzxsbmlm',
          limit: 1,
        },
      ],
      cycle: [
        'data-history/read',
        {
          rid: 'jepv3dpj-z0r2isybwdi',
          limit: 1,
        },
      ],
    },
    process: {
      lastTemperature: ['%get%', 'temperature[0].pl[0]'],
      initTemperature: ['%get%', 'asset[0].params.initTemperature'],
      lastCycle: ['%get%', 'cycle[0].pl[0]'],
      minPressure: ['%get%', 'asset[0].params.minPressure'],
      initPressure: ['%get%', 'asset[0].params.initPressure'],
      initTime: ['%get%', 'asset[0].params.initTime'],
      normalizedPressure: [
        '%jl%',
        {
          '-': [
            {
              var: 'msg.pl.1',
            },
            {
              '*': [
                0.003,
                {
                  '-': [{ var: 'lastTemperature' }, { var: 'initTemperature' }],
                },
              ],
            },
          ],
        },
      ],
      remainingPressure: [
        '%jl%',
        {
          '*': [
            100,
            {
              '/': [{ var: 'normalizedPressure' }, { var: 'initPressure' }],
            },
          ],
        },
      ],
      dPressureDt: [
        '%jl%',
        {
          '/': [
            {
              '-': [{ var: 'normalizedPressure' }, { var: 'initPressure' }],
            },
            {
              '-': [{ var: 'msg.ct' }, { var: 'initTime' }],
            },
          ],
        },
      ],
      timeToMaintenance: [
        '%jl%',
        {
          '/': [
            {
              '-': [
                {
                  var: 'minPressure',
                },
                {
                  var: 'msg.pl.1',
                },
              ],
            },
            {
              var: 'dPressureDt',
            },
          ],
        },
      ],
      cyclesToMaintenance: [
        '%jl%',
        {
          '*': [
            {
              var: 'timeToMaintenance',
            },
            {
              '/': [
                {
                  var: 'lastCycle',
                },
                {
                  '-': [
                    {
                      var: 'msg.ct',
                    },
                    {
                      var: 'initTime',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    active: true,
    cooldown: 30,
    ttl: null,
    actuator: 'backend',
  },
  {
    cooldown: 0.2,
    triggers: { channels: ['data/cycles'] },
    externalData: { previous: ['data-history/read', { rid: 'data/utilization', limit: 1 }] },
    process: {
      currentTime: [
        '%exec%',
        ['new', ['%global%', 'Date'], [['%jl%', { '*': [{ var: 'msg.ts' }, 1000] }]]],
      ],
      previousTime: [
        '%exec%',
        ['new', ['%global%', 'Date'], [['%jl%', { '*': [{ var: 'previous.0.ts' }, 1000] }]]],
      ],
      timeDiff: ['%jl%', { '-': [{ var: 'currentTime' }, { var: 'previousTime' }] }],
      rawDayOfCurrent: ['%exec%', [['%get%', 'currentTime'], 'getDay', []]],
      rawDayOfPrev: ['%exec%', [['%get%', 'previousTime'], 'getDay', []]],
      dayOfCurrent: [
        '%jl%',
        {
          if: [{ '===': [{ var: 'rawDayOfCurrent' }, 0] }, 7, { var: 'rawDayOfCurrent' }],
        },
      ],
      dayOfPrev: [
        '%jl%',
        {
          if: [{ '===': [{ var: 'rawDayOfPrev' }, 0] }, 7, { var: 'rawDayOfPrev' }],
        },
      ],
      newDay: [
        '%jl%',
        {
          or: [
            { '!==': [{ var: 'dayOfPrev' }, { var: 'dayOfCurrent' }] },
            { '>': [{ var: 'timeDiff' }, 86400000] },
          ],
        },
      ],
      newWeek: [
        '%jl%',
        {
          or: [
            { '<': [{ var: 'dayOfCurrent' }, { var: 'dayOfPrev' }] },
            { '>': [{ var: 'timeDiff' }, 604800000] },
          ],
        },
      ],
      running: ['%jl%', { '>': [{ var: 'msg.pl.1' }, 1] }],
      hoursSincePrev: [
        '%jl%',
        {
          '/': [{ '-': [{ var: 'currentTime' }, { var: 'previousTime' }] }, 3600000],
        },
      ],
      prevPl: ['%jl%', { var: 'previous.0.pl' }],
      newPl: [
        '%jl%',
        {
          if: [
            { var: 'running' },
            [
              {
                if: [
                  { var: 'newDay' },
                  0,
                  { '+': [{ var: 'prevPl.0' }, { var: 'hoursSincePrev' }] },
                ],
              },
              {
                if: [
                  { var: 'newWeek' },
                  0,
                  { '+': [{ var: 'prevPl.1' }, { var: 'hoursSincePrev' }] },
                ],
              },
              { '+': [{ var: 'prevPl.2' }, { var: 'hoursSincePrev' }] },
            ],
            [
              {
                if: [
                  {
                    var: 'newDay',
                  },
                  0,
                  {
                    var: 'prevPl.0',
                  },
                ],
              },
              {
                if: [
                  {
                    var: 'newWeek',
                  },
                  0,
                  {
                    var: 'prevPl.1',
                  },
                ],
              },
              {
                var: 'prevPl.2',
              },
            ],
          ],
        },
      ],
    },
    condition: { if: true },
    actions: {
      pub: [['data/utilization', ['%get%', 'newPl']]],
    },
  },
];

// const aTimestamp = 1521663819160 / 1000;
const testClient = msg => ({
  sub: (_, cb) => {
    setTimeout(() => cb(msg), 10);
  },
});

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
  await loadRule({ rid: 11 }, { idKey: 'rid' });
  t.ok(true); // didn't throw
});

test("Shouldn't load rule if not active", async t => {
  await loadRule({ id: 11 });
  t.shouldFail(runRule(11));
});

test('Should handle ttl expired', async t => {
  let expired = false;
  const triggerVars = { triggersProcessed: false };
  const vars = { processUnprocessed: true };
  await loadRule(
    {
      id: 11,
      active: true,
      ttl: Date.now(),
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
  await runRule(11, { vars });
  t.ok(expired);
  t.ok(triggerVars.triggersProcessed);
  t.ok(vars.processUnprocessed);
});

test('patchParser effects & arguments', async t => {
  const ruleConf = {
    id: 11,
    active: true,
    triggers: [{ msg: ['subscribe', ['`', 'data/default']] }],
  };
  const client = testClient({ ts: String(Date.now() / 1000), pl: [3] });
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  await loadRule(ruleConf, {
    patchParser: (parser, triggerKey) => {
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
  const ruleConf = {
    id: 11,
    active: true,
    process: [{ asset: ['rpc', ['`', 'data']] }, { theAsset: ['var', ['`', 'asset']] }],
  };
  const vars = {};
  await loadRule(ruleConf);
  await runRule(11, vars, {
    envExtra: {
      rpc: id => new Promise(r => setTimeout(r(id), 100)),
    },
  });
  t.equals(vars.asset, 'data');
  t.equals(vars.theAsset, 'data');
});

test('Should fire actions with data from process', async t => {
  const ruleConf = {
    id: 11,
    active: true,
    process: [{ data: ['rpc', 5] }],
    condition: ['if', true, true],
    actions: [['fire', 1], ['fire', ['var', ['`', 'data']]]],
  };
  const vars = {};
  let result = 0;
  let setDone;
  const done = new Promise(r => {
    setDone = r;
  });
  await loadRule(ruleConf);
  await runRule(11, vars, {
    envExtra: {
      rpc: id => new Promise(r => setTimeout(r(id), 100)),
      fire: value => {
        result += Number(value);
        if (result > 5) setDone();
      },
    },
  });
  await done;
  t.equals(result, 6);
});
