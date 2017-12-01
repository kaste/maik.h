import { createFragment, createText } from './dom-utils.js'
import { Aura, optimist } from './aura.js'
import { isArray, slice, flatten } from './utils.js'
import { TagInvocation } from './tag-invocation-type.js'
import { materializer } from './maik.js'

const TEXT_NODE = 3
const DOCUMENT_FRAGMENT_NODE = 11

// transformers registry; shared and global, yeah!
export var transformers = {}
export var transformersKeys = []

class NodeHolder {
  constructor(marker, managedNodes = []) {
    this._marker = marker
    this._managedNodes = managedNodes

    let aura = new Aura(marker, managedNodes)
    this._optimist = optimist.bind(null, aura, marker, managedNodes)
  }

  setText(value) {
    let managedNodes = this._managedNodes
    let length = managedNodes.length
    if (length === 1 && managedNodes[0].nodeType === TEXT_NODE) {
      // Reuse existing TEXT_NODE
      managedNodes[0].nodeValue = value
    } else {
      if (length) {
        // Clear everything first, to optimize for the following append
        this.clear()
      }
      this._optimist([createText(this._marker, value)])
    }
  }

  setHTML(value) {
    let fragment = createFragment(this._marker.ownerDocument, false, value)
    this._optimist(slice.call(fragment.childNodes))
  }

  setNodes(value) {
    this._optimist(
      value.nodeType === DOCUMENT_FRAGMENT_NODE
        ? slice.call(value.childNodes)
        : isArray(value) ? value : [value]
    )
  }

  appendNodes(value) {
    if (!isArray(value)) {
      value = [value]
    }
    let nodes = this._managedNodes.slice()
    nodes.push(...value)
    this._optimist(nodes)
  }

  appendText(value) {
    this.appendNodes([createText(this._marker, value)])
  }

  appendHTML(value) {
    let fragment = createFragment(this._marker.ownerDocument, false, value)
    this.appendNodes(slice.call(fragment.childNodes))
  }

  clear() {
    this._optimist([])
  }
}

export const setAnyContent = nodeMarker => {
  let holder = new NodeHolder(nodeMarker)

  let oldValue
  let wires = Object.create(null)

  return function anyContent(value) {
    if (value == null) {
      value = ''
    }

    if (value === oldValue) {
      return
    }
    oldValue = value

    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
        holder.setText(value)
        return
    }

    if (isNode_ish(value)) {
      holder.setNodes(value)
      return
    }

    if (value instanceof TagInvocation) {
      let tagInvocation = value
      let key = tagInvocation.key || tagInvocation.type
      let wire = wires[key] || (wires[key] = materializer())
      holder.setNodes(wire(tagInvocation))
      return
    }

    if ('length' in value) {
      if (!isArray(value)) {
        value = slice.call(value)
      }

      let length = value.length

      if (length === 0) {
        wires = Object.create(null)
        holder.clear()
        return
      }

      switch (typeof value[0]) {
        case 'string':
        case 'number':
        case 'boolean':
          holder.setText(value.join(''))
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

      holder.setNodes(value)
      return
    }

    if (isPromise_ish(value)) {
      value.then(anyContent)
    } else if ('html' in value) {
      holder.setHTML(value.html)
    } else {
      invokeTransformer(value, anyContent, holder)
    }
  }
}

// last attempt to transform content
function invokeTransformer(value, setValue, nodeHolder) {
  for (var key, i = 0, length = transformersKeys.length; i < length; i++) {
    key = transformersKeys[i]
    if (value.hasOwnProperty(key)) {
      transformers[key](value[key], setValue, nodeHolder, value)
    }
  }
}

// quick and dirty Node check
function isNode_ish(value) {
  return 'ELEMENT_NODE' in value
}

// quick and dirty Promise check
function isPromise_ish(value) {
  return 'then' in value
}
