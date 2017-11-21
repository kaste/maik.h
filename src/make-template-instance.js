import { memoizeOnFirstArg } from './utils.js'
import { createTemplateBlueprint } from './make-template-blueprints.js'
import { Aura } from './aura.js'
import { setAnyContent, setTextContent } from './node-updater.js'
// import {makeAttributeUpdateFn} from './attribute-updater.js';
import {
  makeRxAwareAttributeUpdateFn,
  rxAware
} from './rx-aware-attribute-updater.js'
import { importNode } from './dom-utils.js'

const memoizedCreateTemplateBlueprint = memoizeOnFirstArg(
  createTemplateBlueprint
)

// create a template, if unknown
// upgrade a node to use such template for future updates
export const upgrade = (document, isSvg, next, strings) => {
  let blueprint = memoizedCreateTemplateBlueprint(strings, document, isSvg)
  return next(blueprint)
}

export const instantiateBlueprint = blueprint => {
  let fragment = importNode(blueprint.fragment)
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
    updates[i] = createUpdateFn(part, getNode(fragment, part.path), [])
  }
  return updates
}

const makeRxAwareContentUpdateFn = rxAware(setAnyContent)

// Return function which takes a value and then performs the side-effect
// of updating the 'hole' in the template; (...) => (val) => IO
function createUpdateFn(part, target, childNodes) {
  switch (part.type) {
    case 'node':
      return makeRxAwareContentUpdateFn(
        target,
        childNodes,
        new Aura(target, childNodes)
      )
    case 'attr':
      return makeRxAwareAttributeUpdateFn(target, part.name)
    case 'text':
      return setTextContent(target)
  }
}

// return the correct node walking through a path
function getNode(parentNode, path) {
  for (var i = 0, length = path.length; i < length; i++) {
    parentNode = parentNode.childNodes[path[i]]
  }
  return parentNode
}
