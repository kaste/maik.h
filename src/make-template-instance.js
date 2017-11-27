import { importNode, createTreeWalker } from './dom-utils.js'

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
  let walker = createTreeWalker(fragment)
  let index = -1
  let updates = []
  for (let i = 0, l = notes.length; i < l; i++) {
    let { updater, index: nodeIndex } = notes[i]

    while (index < nodeIndex) {
      index++
      walker.nextNode()
    }

    updates[i] = updater(walker.currentNode)
  }
  return updates
}
