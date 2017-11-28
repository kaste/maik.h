import { setAnyContent } from './node-updater.js'
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

export const nodeCallback = setAnyContent

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
      return makeAttributeSetterF(node, newName)
    }
  }

  return node => makePropertySetterF(node, attributeName)
}

export const rwAwareNodeCallback = rxAware(setAnyContent)

export const rxAwareAttributeCallback = name => {
  return attributeCallback(name, {
    makeAttributeSetterF: makeRxAttributeSetter,
    makePropertySetterF: makeRxPropertySetter,
    makeEventHandlerF: makeRxEventHandler
  })
}
