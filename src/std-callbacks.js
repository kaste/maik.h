import { setAnyContent, setTextContent } from './node-updater.js'
import {
  makeAttributeSetter,
  makePropertySetter,
  makeEventHandler
} from './attribute-updater.js'
import {
  makeRxAttributeSetter,
  makeRxPropertySetter,
  makeRxEventHandler,
  rxAware
} from './rx-aware-attribute-updater.js'

export const nodeCallback = type => {
  switch (type) {
    case 'text':
      return setTextContent
    case 'node':
    default:
      return setAnyContent
  }
}

export const attributeCallback = (
  attributeName,
  {
    makeAttributeSetterF = makeAttributeSetter,
    makePropertySetterF = makePropertySetter,
    makeEventHandlerF = makeEventHandler
  } = {}
) => {
  if (attributeName.startsWith('on')) {
    // Allow `onclick` as well as `on-click`
    let eventName =
      attributeName[2] === '-'
        ? attributeName.slice(3)
        : attributeName.slice(2)
    eventName = eventName.toLowerCase()
    return node => makeEventHandlerF(node, eventName)
  }

  if (attributeName.endsWith('$')) {
    let newName = attributeName.slice(0, -1)
    return node => {
      let document = node.ownerDocument
      let newAttribute = document.createAttribute(newName)
      return makeAttributeSetterF(node, newAttribute)
    }
  }

  return node => makePropertySetterF(node, attributeName)
}

const rxAwareContentUpdateFn = rxAware(setAnyContent)

export const rwAwareNodeCallback = type => {
  switch (type) {
    case 'text':
      return setTextContent
    case 'node':
    default:
      return rxAwareContentUpdateFn
  }
}

export const rxAwareAttributeCallback = name => {
  return attributeCallback(name, {
    makeAttributeSetterF: makeRxAttributeSetter,
    makePropertySetterF: makeRxPropertySetter,
    makeEventHandlerF: makeRxEventHandler
  })
}
