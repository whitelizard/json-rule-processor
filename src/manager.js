import { createMachine, assign, spawn } from 'xstate';
import { createRunner, defaultEnv } from 'ploson';
import * as R from 'ramda';
import * as D from 'date-fns/fp';

const getTriggers = async () => [
  { id: 't1', trigger: ['R.pipe', 'R.not'] },
  { id: 't2', trigger: ['R.pipe', 'R.not'] },
];

const context = {
  rules: [
    // { ploson, ruleRef }
  ],
  triggers: [
    // { ploson, triggerRef }
  ],
};

const machineConf = {
  id: 'rule-manager',
  initial: 'init',
  context,
  states: {
    init: {
      invoke: {
        src: 'generateTriggers',
        onDone: { actions: 'populateTriggers', target: 'idle' },
      },
    },
    idle: {},
    checkUpdates: {},
  },
};

const options = {
  services: {
    generateTriggers: async () => {
      const all = await getTriggers();
      return Promise.all(
        all.map(async ({ id, trigger: code }) => {
          const ploson = createRunner({ staticEnv: { ...defaultEnv, R, D } });
          const callback = await ploson(code);
          return { id, ploson, callback };
        }),
      );
    },
  },
  actions: {
    populateTriggers: assign({
      triggers: (ctx, { data = [] }) => {
        return data.map(({ id, ploson, callback }) => {
          return { id, ploson, triggerRef: spawn(callback) };
        });
      },
    }),
  },
};

export const ruleManagerMachine = createMachine(machineConf, options);
