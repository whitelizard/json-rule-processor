import test from 'blue-tape';

import { processRule } from '../src/index'; // eslint-disable-line

test('BASIC', async t => {
  const msg = { ts: String(Date.now() / 1000), pl: [3] };
  processRule({
    active: true,
  });
});

const baseRule = client => ({
  rid: client.getUid(),
  owner: 'user1',
  actuator: 'backend',
  ttl: Date.now() / 1000 + 10,
  active: true,
  cooldown: 30, // secs
  condition: { if: true },
  // resetCondition: { if: true },
  // externalData: {},
  triggers: { channels: ['data/default'] },
});

const rules = client => [
  {
    ...baseRule(client),
    // rpcFetch: {
    // externalRpcData: {
    externalData: {
      // [ RPC-id, args ]
      asset: ['conf-v1/readAsset', { rids: ['robot1'] }],
      weather: ['weather-v1/read', { pos: [58.2, 15.9] }],
    },
    // process: {},
    condition: {
      // these will run through JsonLogic
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
    externalData: {
      asset: ['non-existant'],
    },
    actions: {
      apiCalls: [['check/ok', { ok: true }]],
    },
  },
  {
    ...baseRule(client),
    externalData: { asset: ['conf-v1/readAsset', { rids: ['robot1'] }] },
    triggers: { channels: ['data/2'] },
    actions: {
      apiCalls: [['task-v1/create', { type: 'global', properties: { severity: 'critical' } }]],
    },
  },
  {
    ...baseRule(client),
    ttl: Date.now() / 1000,
    triggers: { channels: ['data/4'] },
    actions: {
      apiCalls: [['task-v1/create', { type: 'global', properties: { severity: 'critical' } }]],
    },
  },
  {
    ...baseRule(client),
    triggers: { channels: ['data/5'] },
    cooldown: 0,
    resetCondition: { '>': [{ var: 'msg.pl.0' }, 10] },
    actions: {
      apiCalls: [['task-v1/create', { type: 'global', properties: { severity: 'critical' } }]],
    },
  },
  {
    ...baseRule(client),
    condition: { '>': [{ var: 'msg.pl.0' }, 10.5] },
    resetCondition: { '>': [{ var: 'msg.pl.0' }, 8.5] },
    triggers: { channels: ['data/3'] },
    actions: {
      apiCalls: [
        [
          'notification-v1/create',
          {
            type: 'asset',
            entityRid: 'jal5n63x-2cn27o2cclz',
            properties: {
              name: 'Pressure high',
              severity: 'critical',
              text: 'Call a service technician',
            },
          },
        ],
      ],
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
        'conf-v1/readAsset',
        {
          rids: ['jepvdrf1-2bd8fwjl9gs'],
        },
      ],
      temperature: [
        'data-history-v1/read',
        {
          rid: 'jepv16uc-5pywzxsbmlm',
          limit: 1,
        },
      ],
      cycle: [
        'data-history-v1/read',
        {
          rid: 'jepv3dpj-z0r2isybwdi',
          limit: 1,
        },
      ],
    },
    process: {
      lastTemperature: ['%get%', 'temperature[0].pl[0]'],
      lastCycle: ['%get%', 'cycle[0].pl[0]'],
      minPressure: ['%get%', 'asset[0].params.minPressure'],
      initPressure: ['%get%', 'asset[0].params.initPressure'],
      initTemperature: ['%get%', 'asset[0].params.initTemperature'],
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
    externalData: { previous: ['data-history-v1/read', { rid: 'data/utilization', limit: 1 }] },
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

test('Set up testing', async () => {
  server.start();
  c = getClient('localhost:6020', options);
  c.on('error', e => console.log('Test-client Error:', e));
  c.p.login({});
});

const aTimestamp = 1521663819160 / 1000;

test('API provide mock', async () => {
  c.rpc.provide('check/ok', (args, response) => response.send(args));
  c.rpc.provide('conf-v1/readRule', (args, response) => response.send(rules(c)));
  c.rpc.provide('conf-v1/updateRule', (args, response) => response.send(args.rids.length));
  c.rpc.provide('conf-v1/readAsset', (args, response) =>
    response.send(args.rids.map(rid => ({
      rid,
      extra: { model: 'b7', height: 22 },
      params: {
        initTemperature: 25,
        initPressure: 190,
        initTime: '1519003874.049',
        minPressure: 100,
      },
    }))));
  c.rpc.provide('weather-v1/read', (args, response) =>
    response.send({ temp: args.pos[1] - args.pos[0], windSpeed: args.pos[0] - args.pos[1] }));
  c.rpc.provide('data-history-v1/read', (args, response) =>
    response.send([{ ts: String(aTimestamp - 3600), pl: [10, 50, 100] }]));
});

test('Create & start service', async t => {
  s = new Service('localhost:6020', false);
  // console.log('Will start RuleEngine Service..');
  await s.start();
  await new Promise(resolve => setTimeout(resolve, 100));
  t.ok(true);
});

test('getInterface', async t => {
  const res = await c.rpc.p.make('rule-engine-v1/getInterface');
  // console.log(res);
  t.true(res && Array.isArray(res.forceRuleUpdate));
});

test('Trigger multiple rules, with (& with broken) external data + Out', async t => {
  // console.log('Going to provide mocks');
  const p1 = provideOnce('mirror/look');
  const p2 = provideOnce('service/three');
  const p3 = provideOnce('un/fire');
  // console.log('Will emit data message');
  let msg = new Tiip({ pl: [261] });
  c.event.emit('data/default', msg.toJS());
  let reply = await p1;
  console.log('reply:', reply);
  t.equals(reply.value, 22);
  reply = await p2;
  t.equals(reply, msg.ts);
  // console.log('Will emit another data message');
  msg = new Tiip({ pl: [222] });
  c.event.emit('data/default', msg.toJS());
  reply = await p3;
  t.equals(reply, msg.pl[0]);
});

test('Realistic test 1', async t => {
  const p1 = provideOnce('notification-v1/create');
  const msg = new Tiip({ pl: [10.6] });
  c.event.emit('data/3', msg.toJS());
  const reply = await p1;
  t.equals(reply.properties.severity, 'critical');
});

test('Realistic test 2 a', async t => {
  const sp = subscribeBusP('data/utilization');
  const msg = new Tiip({ pl: [234, 20], ts: String(aTimestamp + 3600) });
  c.event.emit('data/cycles', msg.toJS());
  const reply = await sp;
  t.same(reply.pl, [12, 52, 102]);
});

test('Realistic test 2 b', async t => {
  await new Promise(r => setTimeout(r, 300));
  const sp = subscribeBusP('data/utilization');
  const msg = new Tiip({ pl: [234, 20], ts: String(aTimestamp + 3600 * 10) });
  c.event.emit('data/cycles', msg.toJS());
  const reply = await sp;
  t.same(reply.pl, [0, 61, 111]);
});

test('Realistic test 2 c', async t => {
  await new Promise(r => setTimeout(r, 300));
  const sp = subscribeBusP('data/utilization');
  const msg = new Tiip({ pl: [234, 20], ts: String(aTimestamp + 3600 * 200) });
  c.event.emit('data/cycles', msg.toJS());
  const reply = await sp;
  t.same(reply.pl, [0, 0, 301]);
});

test('Realistic test 2 d', async t => {
  await new Promise(r => setTimeout(r, 300));
  const sp = subscribeBusP('data/utilization');
  const msg = new Tiip({ pl: [234, 0], ts: String(aTimestamp + 3600 * 290) });
  c.event.emit('data/cycles', msg.toJS());
  const reply = await sp;
  t.same(reply.pl, [0, 0, 100]);
});

test('Realistic test 3', async t => {
  const sp = subscribeBusP('data/jf32nbju-ably329u7q4');
  const msg = new Tiip({ pl: [200, 120], ts: String(aTimestamp + 3600) });
  c.event.emit('data/jepv16uc-5pywzxsbmlm', msg.toJS());
  const reply = await sp;
  t.same(reply.pl, [-434280287.05567867, 2.8589807733542996, 63.18157894736842]);
});

const tasks = [];
test('Cooldown + ttl features', async t => {
  c.rpc.provide('task-v1/create', (args, response) => {
    tasks.push(args);
    response.send(true);
  });
  c.event.emit('data/2', {});
  await new Promise(resolve => setTimeout(resolve, 100));
  t.equals(tasks.length, 1);
  c.event.emit('data/2', {});
  await new Promise(resolve => setTimeout(resolve, 100));
  t.equals(tasks.length, 1);
  c.event.emit('data/4', {});
  await new Promise(resolve => setTimeout(resolve, 100));
  t.equals(tasks.length, 1); // FAILS
  c.event.emit('data/5', {});
  await new Promise(resolve => setTimeout(resolve, 100));
  t.equals(tasks.length, 2);
  c.event.emit('data/5', {});
  await new Promise(resolve => setTimeout(resolve, 100));
  t.equals(tasks.length, 2);
  c.event.emit('data/5', { pl: [11] });
  await new Promise(resolve => setTimeout(resolve, 100));
  t.equals(tasks.length, 2);
  c.event.emit('data/5', {});
  await new Promise(resolve => setTimeout(resolve, 100));
  t.equals(tasks.length, 3);
});

test('forceRuleUpdate API', async t => {
  const res = await c.rpc.p.make('rule-engine-v1/forceRuleUpdate');
  t.ok(res);
});

test('restart deepstream', async () => {
  server.stop();
  await new Promise(resolve => setTimeout(resolve, 2500));
  server2.start();
  return new Promise(resolve => setTimeout(resolve, 2000));
});

test('forceRuleUpdate API', async t => {
  const res = await c.rpc.p.make('rule-engine-v1/forceRuleUpdate');
  t.ok(res);
});

test('shutdown', t => {
  s.close();
  c.close();
  server2.stop();
  t.end();
});
