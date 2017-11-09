import { createFragment, createText } from './dom-utils.js'
import { optimist } from './aura.js'
import { isArray, slice, flatten } from './utils.js'
import { TagInvocation } from './tag-invocation-type.js'
import { materializer } from './maik.js'

const TEXT_NODE = 3
const DOCUMENT_FRAGMENT_NODE = 11

// transformers registry; shared and global
export var transformers = {}
export var transformersKeys = []

// `<style>${'text'}</style>`
export const setTextContent = node => {
  var oldValue
  return function(value) {
    if (value !== oldValue) {
      oldValue = value
      node.textContent = value
    }
  }
}

// `<p>${'any'}</p>`
// `<li>a</li>${'virtual'}<li>c</li>`
export const setAnyContent = (node, childNodes, aura) => {
  var oldValue
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
            childNodes[0].textContent = value
          }
        } else {
          oldValue = value
          if (length) {
            aura.splice(0, length, createText(node, value))
          } else {
            childNodes[0] = node.parentNode.insertBefore(
              createText(node, value),
              node
            )
          }
        }
        break
      case 'function':
        anyContent(value(node.parentNode, childNodes, 0))
        break
      case 'object':
      case 'undefined':
        if (value == null) {
          oldValue = value
          anyContent('')
          break
        }
      /* fallthrough */
      default:
        oldValue = value
        if (isArray(value)) {
          length = value.length
          if (length === 0) {
            aura.splice(0)
          } else {
            switch (typeof value[0]) {
              case 'string':
              case 'number':
              case 'boolean':
                anyContent(value.join(''))
                break
              case 'function':
                var parentNode = node.parentNode
                for (var i = 0; i < length; i++) {
                  value[i] = value[i](parentNode, childNodes, i)
                }
                anyContent(flatten(value))
                break
              case 'object':
                if (isArray(value[0])) {
                  value = flatten(value)
                }
                if (isPromise_ish(value[0])) {
                  Promise.all(value).then(anyContent)
                  break
                }
                if (value[0] instanceof TagInvocation) {
                  for (let i = 0; i < length; i++) {
                    let tagInvocation = value[i]
                    let key = tagInvocation.key || i
                    let wire = wires[key] || (wires[key] = materializer())
                    value[i] = wire(tagInvocation)
                  }
                }
              /* fallthrough */
              default:
                optimist(aura, value)
                break
            }
          }
        } else if (isNode_ish(value)) {
          optimist(
            aura,
            value.nodeType === DOCUMENT_FRAGMENT_NODE
              ? slice.call(value.childNodes)
              : [value]
          )
        } else if (value instanceof TagInvocation) {
          let tagInvocation = value
          let key = tagInvocation.key || tagInvocation.type
          let wire = wires[key] || (wires[key] = materializer(anyContent))
          wire(tagInvocation)
        } else if (isPromise_ish(value)) {
          value.then(anyContent)
        } else if ('placeholder' in value) {
          invokeAtDistance(value, anyContent)
        } else if ('text' in value) {
          anyContent(String(value.text))
        } else if ('any' in value) {
          anyContent(value.any)
        } else if ('html' in value) {
          var html = [].concat(value.html).join('')
          var fragment = createFragment(node.ownerDocument, false, html)

          anyContent(fragment)
          // aura.splice(0);
          // childNodes.push.apply(childNodes, fragment.childNodes);
          // node.parentNode.insertBefore(fragment, node);
        } else if ('length' in value) {
          anyContent(slice.call(value))
        } else {
          anyContent(invokeTransformer(value, anyContent))
        }
        break
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
