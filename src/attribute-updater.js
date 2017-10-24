
export const makeAttributeUpdateFn = (
  attribute,
  removedAttributes,
  name,
  {
    makeAttributeSetterF = makeAttributeSetter,
    makePropertySetterF = makePropertySetter,
    makeEventHandlerF = makeEventHandler
  } = {}
) => {
  let node = attribute.ownerElement

  if (name.startsWith('on')) {
    removedAttributes.push(node, name)

    // Allow `onclick` as well as `on-click`
    let eventName = name[2] === '-' ? name.slice(3) : name.slice(2)
    eventName = eventName.toLowerCase()

    // This is a stricter rule. hypeHTML had:
    // if (name.toLowerCase() in node) {
    //    eventName = eventName.toLowerCase()
    // }
    // which allows `onClick` instead of `onclick`, but
    // otherwise allowed `MixED-Case` events

    return makeEventHandlerF(node, eventName)
  }

  if (name.endsWith('$')) {
    removedAttributes.push(node, name)

    let attributeName = name.slice(0, -1)
    let document = node.ownerDocument
    let newAttribute = document.createAttribute(attributeName)
    return makeAttributeSetterF(node, newAttribute)
  }

  removedAttributes.push(node, name)
  return makePropertySetterF(node, name)
}

export const makeAttributeSetter = (node, attribute) => {
  let oldValue,
    removedAttribute = true

  return value => {
    if (value === true) {
      value = ''
    }

    if (oldValue === value && attribute.value === value) {
      return
    }

    oldValue = value

    if (value == null || value === false) {
      if (!removedAttribute) {
        removedAttribute = true
        node.removeAttributeNode(attribute)
      }
    } else {
      attribute.value = value
      if (removedAttribute) {
        removedAttribute = false
        node.setAttributeNode(attribute)
      }
    }
  }
}

export const makePropertySetter = (node, propertyName) => {
  if (propertyName in node) {
    return makePropertySetterWithDirtyCheck(node, propertyName)
  }
  return makeSimplePropertySetter(node, propertyName)
}

export const makeSimplePropertySetter = (node, propertyName) => {
  return value => {
    node[propertyName] = value
  }
}

export const makePropertySetterWithDirtyCheck = (node, propertyName) => {
  let oldValue = null

  return value => {
    let valueIsPrimitive = typeof value != 'object' || value === null
    if (value == null) {
      value = ''
    }

    if (
      valueIsPrimitive &&
      oldValue === value &&
      node[propertyName] === value
    ) {
      return
    }

    oldValue = value

    node[propertyName] = value
  }
}

export const makeEventHandler = (node, eventName) => {
  let oldValue

  return value => {
    if (oldValue === value) {
      return
    }

    if (oldValue) {
      node.removeEventListener(eventName, oldValue, false)
    }

    oldValue = value

    if (value) {
      node.addEventListener(eventName, value, false)
    }
  }
}
