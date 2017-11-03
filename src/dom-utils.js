import { WK, IE } from './sniffs.js'

const ELEMENT_NODE = 1
const OWNER_SVG_ELEMENT = 'ownerSVGElement'
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const slice = [].slice

// just a minifier friendly indirection
export function createDocumentFragment(document) {
  return document.createDocumentFragment()
}

// given a node, it does what is says
export function createText(node, text) {
  return node.ownerDocument.createTextNode(text)
}

const featureFragment = createDocumentFragment(document)

// use native .append(...childNodes) where available
export const appendNodes =
  'append' in featureFragment
    ? function appendNodes(node, childNodes) {
        node.append.apply(node, childNodes)
      }
    : function appendNodes(node, childNodes) {
        for (var i = 0, length = childNodes.length; i < length; i++) {
          node.appendChild(childNodes[i])
        }
      }

// returns children or retrieve them in IE/Edge
export const getChildren =
  WK || IE
    ? function getChildren(node) {
        for (
          var child,
            children = [],
            childNodes = node.childNodes,
            j = 0,
            i = 0,
            length = childNodes.length;
          i < length;
          i++
        ) {
          child = childNodes[i]
          if (child.nodeType === ELEMENT_NODE) children[j++] = child
        }
        return children
      }
    : function getChildren(node) {
        return node.children
      }

// IE 11 has problems with cloning templates too
// it "forgets" empty childNodes
// herrkaste: Does it also have problems with importing nodes?
export const importNode = (function() {
  featureFragment.appendChild(createText(featureFragment, 'g'))
  featureFragment.appendChild(createText(featureFragment, ''))
  return featureFragment.cloneNode(true).childNodes.length === 1
    ? function importNode(node) {
        for (
          var clone = document.importNode(),
            childNodes = node.childNodes || [],
            i = 0,
            length = childNodes.length;
          i < length;
          i++
        ) {
          clone.appendChild(importNode(childNodes[i]))
        }
        return clone
      }
    : function importNode(fragment) {
        return document.importNode(fragment, true)
      }
})()

// IE/Edge gotcha with comment nodes
export const nextElementSibling = IE
  ? function nextElementSibling(node) {
      // eslint-disable-next-line no-cond-assign
      while ((node = node.nextSibling)) {
        if (node.nodeType === ELEMENT_NODE) return node
      }
      return undefined
    }
  : function nextElementSibling(node) {
      return node.nextElementSibling
    }

export const previousElementSibling = IE
  ? function previousElementSibling(node) {
      // eslint-disable-next-line no-cond-assign
      while ((node = node.previousSibling)) {
        if (node.nodeType === ELEMENT_NODE) return node
      }
      return undefined
    }
  : function previousElementSibling(node) {
      return node.previousElementSibling
    }

// given a node, inject some html and return
// the resulting template document fragment
export function createFragment(node, html) {
  return (OWNER_SVG_ELEMENT in node
    ? createSVGFragment
    : createHTMLFragment)(node, html)
}

// create fragment for HTML
export function createHTMLFragment(node, html) {
  let document = node.ownerDocument
  let container = document.createElement('template')
  let supportsTemplate = 'content' in container

  if (supportsTemplate) {
    container.innerHTML = html
    return container.content
  } else {
    let fragment = createDocumentFragment(document)

    // el.innerHTML = '<td></td>'; is not possible
    // if the content is a partial internal table content
    // it needs to be wrapped around once injected.
    // HTMLTemplateElement does not suffer this issue.
    let needsTableWrap = /^[^\S]*?<(col(?:group)?|t(?:head|body|foot|r|d|h))/i.test(
      html
    )
    if (needsTableWrap) {
      // secure the RegExp.$1 result ASAP to avoid issues
      // in case a non-browser DOM library uses RegExp internally
      // when HTML content is injected (basicHTML / jsdom / others...)
      let selector = RegExp.$1
      container.innerHTML = '<table>' + html + '</table>'
      appendNodes(
        fragment,
        slice.call(container.querySelectorAll(selector))
      )
    } else {
      container.innerHTML = html
      appendNodes(fragment, slice.call(container.childNodes))
    }

    return fragment
  }
}

// create a fragment for SVG
export function createSVGFragment(node, html) {
  var container
  var document = node.ownerDocument
  var fragment = createDocumentFragment(document)
  if (IE || WK) {
    container = document.createElement('div')
    container.innerHTML =
      '<svg xmlns="' + SVG_NAMESPACE + '">' + html + '</svg>'
    appendNodes(fragment, slice.call(container.firstChild.childNodes))
  } else {
    container = document.createElementNS(SVG_NAMESPACE, 'svg')
    container.innerHTML = html
    appendNodes(fragment, slice.call(container.childNodes))
  }
  return fragment
}

