/* Pseudo Polyfill. Just enough to get it working. */

// Map with partial double Array fallback
export const Map =
  self.Map ||
  function() {
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
