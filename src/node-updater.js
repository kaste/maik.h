import { createFragment, createText } from './dom-utils.js'
import { Aura, optimist } from './aura.js'
import { isArray, slice, flatten } from './utils.js'
import { TagInvocation } from './tag-invocation-type.js'
import { materializer } from './maik.js'

const TEXT_NODE = 3
const DOCUMENT_FRAGMENT_NODE = 11

// transformers registry; shared and global
export var transformers = {}
export var transformersKeys = []

// `<p>${'any'}</p>`
// `<li>a</li>${'virtual'}<li>c</li>`
export const setAnyContent = node => {
  let childNodes = []
  let aura = new Aura(node, childNodes)

  let oldValue
  let wires = Object.create(null)

  return function anyContent(value) {
    var length
    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
        length = childNodes.length
        if (length === 1 && childNodes[0].nodeType === TEXT_NODE) {
          if (oldValue !== value) {
            oldValue = value
            childNodes[0].nodeValue = value
          }
        } else {
          oldValue = value
          if (length) {
            // Clear everything first, to optimize for the following append
            optimist(aura, node, childNodes, [])
          }
          optimist(aura, node, childNodes, [createText(node, value)])
        }
        return
      case 'object':
      case 'undefined':
        if (value == null) {
          oldValue = value
          anyContent('')
          return
        }
      /* fallthrough */
      default:
        oldValue = value
        if (isArray(value)) {
          length = value.length
          if (length === 0) {
            wires = Object.create(null)
          } else {
            switch (typeof value[0]) {
              case 'string':
              case 'number':
              case 'boolean':
                anyContent(value.join(''))
                return
              case 'object':
                if (isArray(value[0])) {
                  anyContent(flatten(value))
                  return
                }
                if (isPromise_ish(value[0])) {
                  Promise.all(value).then(anyContent)
                  return
                }
                if (value[0] instanceof TagInvocation) {
                  let newWires = Object.create(null)
                  for (let i = 0; i < length; i++) {
                    let tagInvocation = value[i]
                    let key = tagInvocation.key || i
                    let wire = (newWires[key] = wires[key] || materializer())
                    value[i] = wire(tagInvocation)
                  }
                  wires = newWires
                  value = flatten(value)
                }
            }
          }

          optimist(aura, node, childNodes, value)
        } else if (isNode_ish(value)) {
          optimist(
            aura,
            node,
            childNodes,
            value.nodeType === DOCUMENT_FRAGMENT_NODE
              ? slice.call(value.childNodes)
              : [value]
          )
        } else if (value instanceof TagInvocation) {
          let tagInvocation = value
          let key = tagInvocation.key || tagInvocation.type
          let wire = wires[key] || (wires[key] = materializer())
          anyContent(wire(tagInvocation))
        } else if (isPromise_ish(value)) {
          value.then(anyContent)
        } else if ('placeholder' in value) {
          invokeAtDistance(value, anyContent)
        } else if ('text' in value) {
          anyContent(String(value.text))
        } else if ('any' in value) {
          anyContent(value.any)
        } else if ('html' in value) {
          let fragment = createFragment(
            node.ownerDocument,
            false,
            value.html
          )
          anyContent(fragment)
        } else if ('length' in value) {
          anyContent(slice.call(value))
        } else {
          anyContent(invokeTransformer(value, anyContent))
        }
    }
  }
}

// use a placeholder and resolve with the right callback
function invokeAtDistance(value, callback) {
  callback(value.placeholder)
  if ('text' in value) {
    Promise.resolve(value.text)
      .then(String)
      .then(callback)
  } else if ('any' in value) {
    Promise.resolve(value.any).then(callback)
  } else if ('html' in value) {
    Promise.resolve(value.html)
      .then(asHTML)
      .then(callback)
  } else {
    Promise.resolve(invokeTransformer(value, callback)).then(callback)
  }
}

// last attempt to transform content
function invokeTransformer(object, callback) {
  for (var key, i = 0, length = transformersKeys.length; i < length; i++) {
    key = transformersKeys[i]
    if (object.hasOwnProperty(key)) {
      return transformers[key](object[key], callback)
    }
  }
}

// return content as html
function asHTML(html) {
  return { html: html }
}

// quick and dirty Node check
function isNode_ish(value) {
  return 'ELEMENT_NODE' in value
}

// quick and dirty Promise check
function isPromise_ish(value) {
  return value != null && 'then' in value
}
