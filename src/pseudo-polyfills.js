/* Pseudo Polyfills. Just enough to get it working. */

const EXPANDO = '_hyper_' + ((Math.random() * new Date()) | 0) + ';'

// WeakMap with partial EXPANDO fallback
export const $WeakMap =
  self.WeakMap === undefined
    ? function() {
        // NOT A POLYFILL: simplified ad-hoc for this library cases
        /* istanbul ignore next */
        return {
          delete: function(obj) {
            delete obj[EXPANDO]
          },
          get: function(obj) {
            return obj[EXPANDO]
          },
          has: function(obj) {
            return EXPANDO in obj
          },
          set: function(obj, value) {
            Object.defineProperty(obj, EXPANDO, {
              configurable: true,
              value: value
            })
          }
        }
      }
    : WeakMap

// Map with partial double Array fallback
export const $Map =
  self.Map === undefined
    ? function() {
        var k = [],
          v = []
        return {
          get: function(obj) {
            return v[k.indexOf(obj)]
          },
          // being used with unique template literals
          // there is never a case when a value is overwritten
          // no need to check upfront for the indexOf
          set: function(obj, value) {
            v[k.push(obj) - 1] = value
          }
        }
      }
    : Map
