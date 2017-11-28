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
  let currentValue
  let handler = ev => currentValue(ev)

  return nextValue => {
    if (currentValue === nextValue) {
      return
    }

    if (!nextValue) {
      node.removeEventListener(eventName, handler, false)
    } else if (!currentValue) {
      node.addEventListener(eventName, handler, false)
    }

    currentValue = nextValue
  }
}
