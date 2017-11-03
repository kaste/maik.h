import { $Map } from './pseudo-polyfills.js'

export const memoizeOnFirstArg = fn => {
  let cache = new $Map()
  return (arg, ...args) => {
    let rv = cache.get(arg)
    if (rv === undefined) {
      rv = fn(arg, ...args)
      cache.set(arg, rv)
    }
    return rv
  }
}

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
