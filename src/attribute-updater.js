export const makeAttributeSetter = (node, attributeName) => {
  let oldValue

  return value => {
    if (value === true) {
      value = ''
    }

    if (oldValue === value) {
      return
    }

    oldValue = value

    if (value == null || value === false) {
      node.removeAttribute(attributeName)
    } else {
      node.setAttribute(attributeName, value)
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
