import { slice } from './utils.js'
import { UIDC } from './UID.js'

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
  let childNodes = node.childNodes
  return childNodes.length === 1 ? childNodes[0] : slice.call(childNodes)
}

// Both Firefox < 55 and TypeScript have issues with template literals.
// This lazy defined callback should spot issues right away
// and in the best case scenario become a no-op
let unique = strings => {
  // ATT: If we inline `fn`, uglify changes the behavior of our code!
  const fn = strings => strings
  const testFn = () => fn``
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
