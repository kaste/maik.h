import { majinbuu } from '../node_modules/majinbuu/esm/index.js'
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
  let ph = this.node
  let cn = this.childNodes
  let target = cn[start + (arguments[1] || 0)] || ph
  let result = cn.splice.apply(cn, arguments)
  let pn = ph.parentNode
  for (var tmp, i = 0, length = result.length; i < length; i++) {
    tmp = result[i]
    // TODO: this is not optimal (but necessary)
    if (cn.indexOf(tmp) < 0) {
      pn.removeChild(tmp)
    }
  }
  insertManyBefore(pn, slice.call(arguments, 2), target)
  return result
}

function insertManyBefore(parentNode, nodes, node) {
  const length = nodes.length
  if (length === 1) {
    parentNode.insertBefore(nodes[0], node)
  } else {
    let i = 0
    const document = parentNode.ownerDocument
    const tmp = createDocumentFragment(document)
    while (i < length) tmp.appendChild(nodes[i++])
    parentNode.insertBefore(tmp, node)
  }
  return nodes
}

function removeMany(parentNode, nodes) {
  let i = nodes.length
  while (i--) {
    parentNode.removeChild(nodes[i])
  }
}

const slice = [].slice
const push = [].push
const splice = [].splice
const unshift = [].unshift

export function optimist(aura, node, childNodes, virtual) {
  const vlength = virtual.length
  // if there are new elements to push ..
  if (0 < vlength) {
    const live = childNodes
    const pn = node.parentNode
    let llength = live.length
    let l = 0
    let v = 0
    // if the current list is empty, append all nodes
    if (llength < 1) {
      push.apply(live, insertManyBefore(pn, virtual, node))
      return
    }
    // if all elements are the same, do pretty much nothing
    while (l < llength && v < vlength) {
      // appending nodes/components could be just fine
      if (live[l] !== virtual[v]) break
      l++
      v++
    }
    // if we reached the live length destination
    if (l === llength) {
      // there could be a tie (nothing to do)
      if (vlength === llength) return
      // or there's only to append
      push.apply(live, insertManyBefore(pn, slice.call(virtual, v), node))
      return
    }
    // if the new length is reached though
    if (v === vlength) {
      // there are nodes to remove
      removeMany(pn, splice.call(live, l, llength))
      return
    }
    // otherwise let's check backward
    let rl = llength
    let rv = vlength
    while (rl && rv) {
      if (live[--rl] !== virtual[--rv]) {
        ++rl
        ++rv
        break
      }
    }
    // now ... lists are not identical, we know that,
    // but maybe it was a prepend ... so if live length is covered
    if (rl < 1) {
      // return after pre-pending all nodes
      unshift.apply(
        live,
        insertManyBefore(pn, slice.call(virtual, 0, rv), live[0])
      )
      return
    }
    // or maybe, it was a removal of nodes at the beginning
    if (rv < 1) {
      // return after removing all pre-nodes
      removeMany(pn, splice.call(live, l, rl))
      return
    }
    // now we have a boundary of nodes that need to be changed
    // all the discovered info ar passed to the engine
    // Megatron.engine.update(
    //   utils,
    //   pn,
    //   node,
    //   live,
    //   l,
    //   rl,
    //   llength,
    //   virtual,
    //   v,
    //   rv,
    //   vlength
    // )
  }

  majinbuu(aura, virtual, MAX_LIST_SIZE)
}
