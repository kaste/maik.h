/* global Rx */

import {
  makeAttributeUpdateFn,
  makeAttributeSetter,
  makePropertySetter
} from './attribute-updater.js'
import { isObservable } from './utils.js'

export const makeRxAwareAttributeUpdateFn = (node, name) => {
  return makeAttributeUpdateFn(node, name, {
    makeAttributeSetterF: makeRxAttributeSetter,
    makePropertySetterF: makeRxPropertySetter,
    makeEventHandlerF: makeRxEventHandler
  })
}

export const rxAware = fn => (...args) => {
  let oldValue, subscription
  let sink = fn(...args)

  return value => {
    if (isObservable(value)) {
      if (oldValue === value) {
        return
      }
      oldValue = value

      if (subscription) {
        subscription.unsubscribe()
        subscription = null
      }
      if (value) {
        subscription = value.subscribe(sink)
      }
    } else {
      oldValue = value

      if (subscription) {
        subscription.unsubscribe()
        subscription = null
      }

      sink(value)
    }
  }
}

export const makeRxAttributeSetter = rxAware(makeAttributeSetter)
export const makeRxPropertySetter = rxAware(makePropertySetter)

export const makeRxEventHandler = (node, eventName) => {
  let oldValue, subscription

  let observer = Rx.Observable.fromEvent(node, eventName)

  return function setter(value) {
    if (oldValue === value) {
      return
    }
    oldValue = value

    if (subscription) {
      subscription.unsubscribe()
      subscription = null
    }

    if (value) {
      subscription = observer.subscribe(value)
    }
  }
}


