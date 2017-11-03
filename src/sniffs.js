import { createDocumentFragment } from './dom-utils.js'

var featureFragment = createDocumentFragment(document)

// Firefox < 55 has non standard template literals.
// https://bugzilla.mozilla.org/show_bug.cgi?id=1108941
// TODO: is there any better way to feature detect this ?
export const FF =
  typeof navigator === 'object' &&
  /Firefox\/(\d+)/.test(navigator.userAgent) &&
  parseFloat(RegExp.$1) < 55

// If attributes order is shuffled, threat the browser differently
// Usually this is a well known IE only limitation but some older FF does the same.
export const IE = (function() {
  var p = document.createElement('p')
  p.innerHTML = '<i data-i="" class=""></i>'
  return /class/i.test(p.firstChild.attributes[0].name)
})()

// beside IE, old WebKit browsers don't have `children` in DocumentFragment
export const WK = !('children' in featureFragment)
