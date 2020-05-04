import joi from '@hapi/joi';

const miniMALcmd = joi.array().min(1).items(joi.string().required(), joi.any());

const miniMALBlock = joi.array().items(joi.object().unknown(), miniMALcmd);

export const Rule = joi
  .object()
  .unknown()
  .keys({
    id: joi.string().description('Identifier for this particular rule.'),
    active: joi
      .boolean()
      .default(false)
      // .required()
      .description('If the rule is active or not. An inactive rule is not run at all.'),
    // actuator: joi
    //   .string()
    //   .default('backend')
    //   .description('ID of where the rule should be loaded and run.'),
    ttl: joi.date().description('At this time (ISO timestamp) the rule will be set to inactive.'),
    cooldown: joi
      .number()
      .min(0)
      .description("A rule can't be triggered again unless this number of seconds has passed."),
    onLoad: miniMALBlock.description('MiniMAL command block to run when rule is loaded.'),
    process: miniMALBlock.description(
      'MiniMAL command block to run when rule is triggeed, before condition.',
    ),
    condition: miniMALcmd.description(
      'MiniMAL command to check if rule should execute (state to flipped, run actions etc).',
    ),
    actions: miniMALBlock.description(
      'MiniMAL command block to execute when condition is true (& not in flipped state).',
    ),
    resetCondition: miniMALcmd.description(
      'MiniMAL command to check if rule should reset, if it is in flipped state.',
    ),
    resetActions: miniMALBlock.description(
      'MiniMAL command block to execute when resetCondition is true.',
    ),
  });
