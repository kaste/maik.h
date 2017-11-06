import { memoizeOnFirstArg } from './utils.js'
import { createTemplateBlueprint } from './make-template-blueprints.js'

const memoizedCreateTemplateBlueprint = memoizeOnFirstArg(
  createTemplateBlueprint
)

// create a template, if unknown
// upgrade a node to use such template for future updates
export const upgrade = (document, isSvg, next, strings) => {
  let blueprint = memoizedCreateTemplateBlueprint(strings, document, isSvg)
  return next(blueprint)
}
