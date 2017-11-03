import { majinbuu } from '../node_modules/majinbuu/esm/main.js'
import { createDocumentFragment } from './dom-utils.js'

// avoid processing too many nodes
// this is about the algorithm used
// to calculate the least amount of DOM
// changes needed to show the a new list
// where there was another one.
// There is a limit, in terms of performance,
// on how big can the optimal computation be,
// so if you change this value be sure your
// target hardware is good enough.
const MAX_LIST_SIZE = 1000

// ---------------------------------------------
// DOM Manipulation
// ---------------------------------------------

export function Aura(node, childNodes) {
  this.node = node
  this.childNodes = childNodes
  return majinbuu.aura(this, childNodes)
}

Aura.prototype.splice = function splice(start) {
  for (
    var tmp,
      ph = this.node,
      cn = this.childNodes,
      target = cn[start + (arguments[1] || 0)] || ph,
      result = cn.splice.apply(cn, arguments),
      pn = ph.parentNode,
      i = 0,
      length = result.length;
    i < length;
    i++
  ) {
    tmp = result[i]
    // TODO: this is not optimal (but necessary)
    if (cn.indexOf(tmp) < 0) {
      pn.removeChild(tmp)
    }
  }
  i = 2
  length = arguments.length
  if (i < length) {
    if (length - i === 1) {
      tmp = arguments[i]
    } else {
      tmp = createDocumentFragment(pn.ownerDocument)
      while (i < length) {
        tmp.appendChild(arguments[i++])
      }
    }
    pn.insertBefore(tmp, target)
  }
  return result
}

// uses majinbuu only if the two lists are different
export function optimist(aura, value) {
  let length = aura.length
  if (value.length !== length) {
    majinbuu(aura, value, MAX_LIST_SIZE)
  } else {
    for (let i = 0; i < length--; i++) {
      if (aura[length] !== value[length] || aura[i] !== value[i]) {
        majinbuu(aura, value, MAX_LIST_SIZE)
        return
      }
    }
  }
}
