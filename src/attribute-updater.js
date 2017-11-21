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
