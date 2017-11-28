import { $WeakMap } from './pseudo-polyfills.js'

export const memoizeOnFirstArg = fn => {
  let cache = new $WeakMap()
  return (arg, ...args) => {
    let rv = cache.get(arg)
    if (rv === undefined) {
      rv = fn(arg, ...args)
      cache.set(arg, rv)
    }
    return rv
  }
}

export const lruCacheOne = fn => {
  let lastIn, lastOut
  return (arg, ...args) => {
    if (lastIn === arg) {
      return lastOut
    }
    let curOut = fn(arg, ...args)
    lastIn = arg
    lastOut = curOut
    return curOut
  }
}

export const flatten = array => [].concat(...array)

// used to convert childNodes to Array
export const slice = [].slice
export const indexOf = [].indexOf
// older WebKit need this
export const trim =
  ''.trim ||
  function() {
    return this.replace(/^\s+|\s+$/g, '')
  }

// BB7 and webOS need this
export const isArray =
  Array.isArray ||
  (function() {
    var toString = {}.toString
    // I once had an engine returning [array Array]
    // and I've got scared since!
    var s = toString.call([])
    return function(a) {
      return toString.call(a) === s
    }
  })()

export const isObject = x => x != null && typeof x === 'object'

// Keep it stupid simple here
export const isObservable = value => isObject(value) && 'subscribe' in value
export const isSubject = value => isObject(value) && 'next' in value

export const repeat = (seq, mapFn) => {
  if (isObservable(seq)) {
    return seq.map(items => items.map(mapFn))
  }
  return seq.map(mapFn)
}
