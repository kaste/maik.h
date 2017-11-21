import { trim } from './utils.js'
import { UIDC } from './UID.js'

const ELEMENT_NODE = 1

// entry point for all TL => DOM operations
export function render(
  createTemplateInstance,
  finalSideEffect,
  strings,
  ...values
) {
  strings = unique(strings)
  let { fragment, updaters } = createTemplateInstance(strings)
  update(updaters, values)
  return finalSideEffect(fragment)
}

// invokes each update function passing interpolated value
function update(updateFns, values) {
  for (var i = 0, length = updateFns.length; i < length; i++) {
    updateFns[i](values[i])
  }
}

export const replaceNodeContent = (node, fragment) => {
  node.textContent = ''
  node.appendChild(fragment)
  return node
}

// return a single node or an Array or nodes
export const extractContent = node => {
  let content = []
  let childNodes = node.childNodes

  for (var i = 0, length = childNodes.length; i < length; i++) {
    let child = childNodes[i]
    if (
      child.nodeType === ELEMENT_NODE ||
      trim.call(child.textContent).length !== 0
    ) {
      content.push(child)
    }
  }
  return content.length === 1 ? content[0] : content
}

// Both Firefox < 55 and TypeScript have issues with template literals.
// This lazy defined callback should spot issues right away
// and in the best case scenario become a no-op
let unique = strings => {
  const testFn = () => (strings => strings)``
  if (testFn() === testFn()) {
    unique = strings => strings
  } else {
    const templateObjects = Object.create(null)
    unique = strings => {
      let key = strings.join(UIDC)
      return templateObjects[key] || (templateObjects[key] = strings)
    }
  }
  return unique(strings)
}
