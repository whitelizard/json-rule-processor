import 'airbnb-js-shims';
import { functionalParserWithVars, asyncBlockEvaluator } from './minimal-lisp-parser';

export const loadRule = async (ruleConf, { parserOptions = {}, parserPatcher, vars = {} } = {}) => {
  const { triggers } = ruleConf;
  const parser = functionalParserWithVars(vars, parserOptions);
  if (triggers) await asyncBlockEvaluator(parser, triggers, parserPatcher);
  else console.warn('Rule has no triggers');

  return async ({ vars = {}, parserOptions = {} }) => {
    // console.log('runRule:', id, vars, parserOptions, ruleStore[id]);
    const { process, condition, actions } = ruleConf;
    const parser = functionalParserWithVars(vars, parserOptions);
    if (process) await asyncBlockEvaluator(parser, process);

    const conditionsMet = parser.evalWithLog(condition);
    if (conditionsMet) {
      return asyncBlockEvaluator(parser, actions);
    }
    return undefined;
  };
};
