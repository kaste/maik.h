import { importNode } from './dom-utils.js'

export const createTemplateInstance = (
  createTemplateBlueprint,
  document,
  isSvg,
  strings
) => {
  let { fragment, notes } = createTemplateBlueprint(strings, document, isSvg)
  return instantiateBlueprint(document, fragment, notes)
}

export const instantiateBlueprint = (document, blueprintFragment, notes) => {
  let fragment = importNode(document, blueprintFragment)
  let updaters = readyUpdaters(fragment, notes)
  return { fragment, updaters }
}

// Find the correct live node using our notes, and pass it to the
// updater fns. Return just the updaters.
function readyUpdaters(fragment, notes) {
  let updates = []
  for (var i = 0, length = notes.length; i < length; i++) {
    let { updater, path } = notes[i]
    let node = getNode(fragment, path)
    updates[i] = updater(node)
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
