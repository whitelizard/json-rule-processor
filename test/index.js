import test from 'blue-tape';

import { processRule } from '../src/index'; // eslint-disable-line

test('BASIC', async t => {
  const msg = { ts: String(Date.now() / 1000), pl: [3] };
  processRule({
    active: true,
  });
});

const rules = client => [
  {
    rid: 111,
    owner: 'user1',
    actuator: 'backend',
    ttl: Date.now() / 1000 + 10,
    active: true,
    cooldown: 30, // secs
    condition: ['if', true],
    // triggers: { channels: ['data/default'] },
    triggers: [{ msg: ['subscribe', 'data/default'] }, ['cron', '* * * * * *']],
    asyncs: [{ asset: ['rpc', 'conf/readAsset', { rids: ['robot1'] }] }],
    process: [
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
    rid: 123,
    owner: 'user1',
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
    condition: {
      and: [
        { '>': [{ var: 'msg.pl.0' }, 260] },
        { '===': [{ var: 'asset.0.extra.model' }, 'b7'] },
        { '<': [{ var: 'weather.temp' }, -20] },
      ],
    },
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
    ...baseRule(client),
    owner: 'super',
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
    ...baseRule(client),
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

const provideOnce = rpcId =>
  new Promise(resolve => {
    // console.log('providing:', rpcId);
    c.rpc.provide(rpcId, (args, response) => {
      // console.log(rpcId, 'requested. Answering');
      response.send(args);
      c.rpc.unprovide(rpcId);
      resolve(args);
    });
  });

const subscribeBusP = ch =>
  new Promise(resolve => {
    c.event.subscribe(ch, tiipMsg => {
      resolve(tiipMsg);
    });
  });

const aTimestamp = 1521663819160 / 1000;

test('First', async () => {
  const ruleProcessor = createRuleProcessor({ transforms: {} });
  ruleProcessor.giveRules(rules);
});
