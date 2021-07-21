import { createMachine } from 'xstate';

// loading: {
//   invoke: {
//     src: 'onLoad',
//     onDone: [{ cond: 'isActive', target: 'active' }, { target: 'inactive' }],
//   },
// },

// activities: {
//   cron: (ctx) => {
//
//     return () => clearInterval()
//   },
//   cron: () => {
//     return () => clearInterval()
//   }
// },

// const machineConf = {
//   id: 'rule',
//   initial: 'inactive',
//   context: {
//     ttl: 0,
//     cooldown: 1000,
//     lastFired: 0,
//   },
//   states: {
//     // loading: {
//     //   invoke: {
//     //     src: 'onLoad',
//     //     onDone: [{ cond: 'isActive', target: 'active' }, { target: 'inactive' }],
//     //   },
//     // },
//     inactive: { on: { ACTIVATE: 'active' } },
//     active: {
//       id: 'active-rule',
//       initial: 'ready',
//       states: {
//         ready: {
//           on: { FIRE: '' },
//         },
//         cooling: {
//           after: { COOLDOWN: 'cool' }
//         },
//             flipped: { on: { RESET: 'idle' } },
//         },
//         temperature: {
//           initial: 'cool',
//           states: {
//             cool: { on: { FIRE: 'hot' } },
//             hot: {  },
//           },
//         },
//       },
//       on: { EXPIRE: 'expired' },
//     },
//     expired: {
//       final: true,
//     },
//   },
// };

const tempExpiresIn = 20;

const context = {
  // active: true,
  ttl: new Date(Date.now() + tempExpiresIn * 1000),
  cooldown: 1500,
  hysteresis: true,
  lastFired: 0,
};

const machineConf = {
  id: 'rule',
  initial: 'decideStart',
  context,
  states: {
    // decideStart: {
    //   always: [{ cond: 'isExpired', target: 'expired' }, { target: 'loading' }],
    //   on: {
    //     '': [{ cond: 'isExpired', target: 'expired' }, { target: 'loading' }],
    //   },
    // },
    // loading: {
    //   invoke: {
    //     src: 'onLoad',
    //   },
    // },
    inactive: { on: { ACTIVATE: 'idle' } },
    idle: { on: { FIRE: 'checkExpired' } },
    checkExpired: {
      always: [{ cond: 'isExpired', target: 'expired' }, { target: 'fired' }],
      on: { '': [{ cond: 'isExpired', target: 'expired' }, { target: 'fired' }] },
    },
    fired: {
      type: 'parallel',
      states: {
        switcher: {
          initial: 'decide',
          states: {
            decide: {
              always: [{ cond: 'hasReset', target: 'flipped' }, { target: 'done' }],
              on: { '': [{ cond: 'hasReset', target: 'flipped' }, { target: 'done' }] },
            },
            flipped: { on: { RESET: 'done' } },
            done: { type: 'final' },
          },
        },
        temperature: {
          initial: 'decide',
          states: {
            decide: {
              always: [{ cond: 'hasCooldown', target: 'hot' }, { target: 'cool' }],
              on: { '': [{ cond: 'hasCooldown', target: 'hot' }, { target: 'cool' }] },
            },
            hot: { after: { COOLDOWN: 'cool' } },
            cool: { type: 'final' },
          },
        },
      },
      onDone: 'idle',
    },
    expired: { type: 'final' },
  },
};

const options = {
  delays: {
    COOLDOWN: ({ cooldown }) => cooldown,
  },
  guards: {
    hasCooldown: ({ cooldown }) => Boolean(cooldown),
    hasReset: ({ hysteresis }) => hysteresis,
    // isActive: ({ active }) => active,
    isExpired: ({ ttl }) => ttl < new Date(),
  },
};

export const ruleMachine = createMachine(machineConf, options);
