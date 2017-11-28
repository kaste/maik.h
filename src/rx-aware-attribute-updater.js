import {
  makeAttributeSetter,
  makePropertySetter,
  makeEventHandler
} from './attribute-updater.js'
import { isObservable, isSubject } from './utils.js'

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
  let sink = makeEventHandler(node, eventName)

  return function setter(value) {
    if (isSubject(value)) {
      sink(ev => value.next(ev))
    } else {
      sink(value)
    }
  }
}
