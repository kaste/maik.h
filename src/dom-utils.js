import { WK, IE } from './sniffs.js'

const ELEMENT_NODE = 1
const TEXT_NODE = 3

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
// @kaste: Does it also have problems with importing nodes?
export const importNode = (function() {
  featureFragment.appendChild(createText(featureFragment, 'g'))
  featureFragment.appendChild(createText(featureFragment, ''))
  return featureFragment.cloneNode(true).childNodes.length === 1
    ? function importNode(node) {
        for (
          var clone = document.importNode(node),
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
      while ((node = node.previousSibling)) {
        if (node.nodeType === ELEMENT_NODE) return node
      }
      return undefined
    }
  : function previousElementSibling(node) {
      return node.previousElementSibling
    }

// remove all text nodes from a virtual space
export function removePreviousText(parentNode, node) {
  var previousSibling = node.previousSibling
  if (previousSibling && previousSibling.nodeType === TEXT_NODE) {
    parentNode.removeChild(previousSibling)
    removePreviousText(parentNode, node)
  }
}

// avoid errors on obsolete platforms
export function insertBefore(parentNode, target, after) {
  if (after) {
    parentNode.insertBefore(target, after)
  } else {
    parentNode.appendChild(target)
  }
}

// TODO: `createFragment` has some uniqueness, maybe put it somewhere else?

// given a node, inject some html and return
// the resulting template document fragment
export function createFragment(document, svg, html) {
  return (svg ? createSVGFragment : createHTMLFragment)(document, html)
}

const SUPPORTS_TEMPLATE = 'content' in document.createElement('template')

// create fragment for HTML
export const createHTMLFragment = SUPPORTS_TEMPLATE
  ? function createHTMLFragment(document, html) {
      let container = document.createElement('template')
      container.innerHTML = html
      return container.content
    }
  : function createHTMLFragmentLegacy(document, html) {
      let fragment = createDocumentFragment(document)
      let container = document.createElement('div')

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

// create a fragment for SVG
export const createSVGFragment = SUPPORTS_TEMPLATE
  ? function createSVGFragment(document, html) {
      let container = document.createElement('template')
      let svgElement = document.createElementNS(SVG_NAMESPACE, 'svg')
      svgElement.innerHTML = html
      appendNodes(container.content, slice.call(svgElement.childNodes))
      return container.content
    }
  : function createSVGFragmentLegacy(document, html) {
      var fragment = createDocumentFragment(document)
      let container = document.createElement('div')
      container.innerHTML =
        '<svg xmlns="' + SVG_NAMESPACE + '">' + html + '</svg>'
      appendNodes(fragment, slice.call(container.firstChild.childNodes))
      return fragment
    }
