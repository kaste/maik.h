import { memoizeOnFirstArg } from './utils.js'
import { createTemplateBlueprint } from './make-template-blueprints.js'
import { importNode } from './dom-utils.js'

import {
  rwAwareNodeCallback,
  rxAwareAttributeCallback
} from './std-callbacks.js'

const memoizedCreateTemplateBlueprint = memoizeOnFirstArg(
  createTemplateBlueprint.bind(
    null,
    rwAwareNodeCallback,
    rxAwareAttributeCallback
  )
)

// create a template, if unknown
// upgrade a node to use such template for future updates
export const upgrade = (
  document,
  isSvg,
  next = instantiateBlueprint,
  strings
) => {
  let blueprint = memoizedCreateTemplateBlueprint(strings, document, isSvg)
  return next(document, blueprint)
}

export const instantiateBlueprint = (document, blueprint) => {
  let fragment = importNode(document, blueprint.fragment)
  let updaters = createUpdaters(fragment, blueprint.notes)
  return { fragment, updaters }
}

// given a root node and a list of paths
// creates an array of updates to invoke
// whenever the next interpolation happens
function createUpdaters(fragment, parts) {
  let updates = []
  for (var i = 0, length = parts.length; i < length; i++) {
    let part = parts[i]
    updates[i] = part.updater(getNode(fragment, part.path))
  }
  return updates
}

// return the correct node walking through a path
function getNode(parentNode, path) {
  for (var i = 0, length = path.length; i < length; i++) {
    parentNode = parentNode.childNodes[path[i]]
  }
  return parentNode
}
