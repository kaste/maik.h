import { memoizeOnFirstArg } from './utils.js'
import { createTemplateBlueprint } from './make-template-blueprints.js'
import { Aura } from './aura.js'
import { setAnyContent, setTextContent } from './node-updater.js'
// import {makeAttributeUpdateFn} from './attribute-updater.js';
import {
  makeRxAwareAttributeUpdateFn,
  rxAware
} from './rx-aware-attribute-updater.js'
import {
  getChildren,
  importNode,
  previousElementSibling,
  nextElementSibling,
  removePreviousText,
  insertBefore
} from './dom-utils.js'
import { IE, WK } from './sniffs.js'
import { indexOf, slice } from './utils.js'
import { UID } from './UID.js'

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

export const adoptBlueprint = (contextNode, blueprint) => {
  let updaters = discoverUpdates(
    contextNode,
    blueprint.fragment,
    blueprint.notes
  )
  return { updaters }
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

// like createUpdates but for nodes with already a content
function discoverUpdates(contextNode, fragment, parts) {
  let updates = []
  for (var i = 0, length = parts.length; i < length; i++) {
    let childNodes = []
    let part = parts[i]
    updates[i] = createUpdateFn(
      part,
      discoverNode(contextNode, fragment, part, childNodes),
      childNodes
    )
  }
  return updates
}

// given an info, tries to find out the best option
// to replace or update the content
function discoverNode(parentNode, fragment, part, childNodes) {
  let path = part.path

  if (part.type !== 'node') {
    let node = getOrCreateNodesToPath(parentNode, path, fragment)
    if (part.type === 'attr') {
      node.removeAttribute(part.name)
    }
    return node
  }

  let document = parentNode.ownerDocument
  let virtualNode = getNode(fragment, path)
  let target

  parentNode = getOrCreateNodesToPath(
    parentNode,
    path.slice(0, -2),
    fragment
  )

  // --- BEGIN original code gibble from @WebReflection
  // --- No time to think this through
  let children = getChildren(parentNode)
  let virtualChildren = getChildren(virtualNode.parentNode)

  let previousElement = previousElementSibling(virtualNode)
  let before = previousElement
    ? indexOf.call(virtualChildren, previousElement) + 1
    : -1
  let nextElement = nextElementSibling(virtualNode)
  let after = nextElement ? indexOf.call(virtualChildren, nextElement) : -1

  switch (true) {
    case after < 0:
      // `</a>${'Hello'}`
      after = children.length
      break
    case before < 0:
      // `${'Hello'}<b>`
      before = 0
    /* fallthrough */
    default:
      // `</a>${'Hello'}<b>`
      after = -(virtualChildren.length - after)
      break
  }
  childNodes.push(...slice.call(children, before, after))

  target = document.createComment(UID)
  if (childNodes.length) {
    insertBefore(
      parentNode,
      target,
      nextElementSibling(childNodes[childNodes.length - 1])
    )
  } else {
    insertBefore(parentNode, target, slice.call(children, after)[0])
  }
  if (childNodes.length === 0) {
    removePreviousText(parentNode, target)
  }
  return target
}

const getOrCreateNodesToPath = (parent, path, fragment) => {
  let target = parent

  for (let i = 0, l = path.length; i < l; i = i + 2) {
    // We walk the path, and try to match already present nodes.
    let currentPath = path.slice(i, i + 2)
    target = getNode(parent, currentPath)
    if (!target) {
      // As soon as a wanted node according to path is not in the actual DOM,
      // we just look up that node in the fragment, and import it into the
      // correct position.
      let wantedNode = getNode(fragment, path.slice(0, i + 2))
      parent.appendChild(importNode(wantedNode))
      // We MUST return the end node, so we look it up again.
      return getNode(parent, path.slice(i))
    }
    parent = target
  }
  return target
}

// return the correct node walking through a path
// fixes IE/Edge issues with attributes and children (fixes old WebKit too)
var getNode =
  IE || WK
    ? function getNode(parentNode, path) {
        for (var name, i = 0, length = path.length; i < length; i++) {
          name = path[i++]
          switch (name) {
            case 'children':
              parentNode = getChildren(parentNode)[path[i]]
              break
            default:
              parentNode = parentNode[name][path[i]]
              break
          }
        }
        return parentNode
      }
    : function getNode(parentNode, path) {
        for (var i = 0, length = path.length; i < length; i++) {
          parentNode = parentNode[path[i++]][path[i]]
        }
        return parentNode
      }
