import { describe } from 'riteway';
import * as R from 'ramda';
import * as M from '@most/core';
import { newDefaultScheduler } from '@most/scheduler';

describe('basic use', async assert => {
  const externalDataShooter = conf => console.log(conf);
  const actionsShooter = conf => console.log(conf);
  const conditionsChecker = (condition, ctx) => console.log(condition, ctx);

  M.runEffects(M.tap(console.log, test$), newDefaultScheduler());
});
