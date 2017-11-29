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

// IE 11 has problems with cloning templates, it "forgets" empty childNodes
export const cloneNode = (function() {
  featureFragment.appendChild(createText(featureFragment, 'g'))
  featureFragment.appendChild(createText(featureFragment, ''))
  return featureFragment.cloneNode(true).childNodes.length === 1
    ? function cloneNode(node) {
        let clone = node.cloneNode()
        let childNodes = node.childNodes || []
        for (var i = 0, length = childNodes.length; i < length; i++) {
          clone.appendChild(cloneNode(childNodes[i]))
        }
        return clone
      }
    : node => node.cloneNode(true)
})()

export const importNode =
  'importNode' in document
    ? (document, node) => document.importNode(node, true)
    : (_, node) => cloneNode(node)

const NODE_FILTER =
  NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT

export const createTreeWalker = node =>
  node.ownerDocument.createTreeWalker(node, NODE_FILTER, null, false)

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
