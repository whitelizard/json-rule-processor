import joi from '@hapi/joi';

export const Rule = joi.object().keys({
  id: joi.string(),
  active: joi
    .boolean()
    .required()
    .description('If the rule is active or not. An inactive rule is not run at all.'),
  actuator: joi.string().description('ID of where the rule should be loaded and run.'),
  ttl: joi.date().description('At this time (ISO timestamp) the rule will be set to inactive.'),
  cooldown: joi
    .number()
    .min(0)
    .description("A rule can't be triggered again unless this number of seconds has passed."),
  onLoad: joi.array().description('MiniMAL command or command block to run when rule is loaded.'),
  process: joi
    .array()
    .description(
      'MiniMAL command or command block to run when rule is triggeed, before condition.',
    ),
  condition: joi
    .array()
    .description(
      'MiniMAL command to check if rule should execute (state to flipped, run actions etc).',
    ),
  actions: joi
    .array()
    .description(
      'MiniMAL command or command block to execute when condition is true (& not in flipped state).',
    ),
  resetCondition: joi
    .array()
    .description('MiniMAL command to check if rule should reset, if it is in flipped state.'),
  resetActions: joi
    .array()
    .description('MiniMAL command or command block to execute when resetCondition is true.'),
});
