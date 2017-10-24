/* global chai */

const {assert} = chai

export const matchInnerHTML = (string, html) => {
  let container = html.cloneNode(true)
  removeComments(container)
  assert.equal(string, container.innerHTML)
}

export const removeComments = (node) => {
  let walker = document.createTreeWalker(node, NodeFilter.SHOW_COMMENT)
  let commentNodes = []

  while (walker.nextNode()) {
    commentNodes.push(walker.currentNode)
  }

  for (let n of commentNodes) {
    n.parentNode.removeChild(n)
  }
}

export const xfail = (ctx, fn) => {
  let succeeded
  try {
    fn()
    succeeded = true
  } catch (e) {
    ctx.skip()
    return
  }
  if (succeeded) {
    assert.fail('Success', 'Failure', 'Expected to fail, but succeeded')
  }
}
