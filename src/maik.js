/*! (c) 2017 Andrea Giammarchi @WebReflection, (ISC) */
/*! (c) 2017 herr.kaste, (ISC) */

import { createTemplateBlueprint as createTemplateBlueprintF } from './make-template-blueprints.js'
import { upgrade as createTemplateInstanceF } from './make-template-instance.js'
import { render, replaceNodeContent, extractContent } from './render.js'
import { memoizeOnFirstArg, lruCacheOne, isArray } from './utils.js'
import { $WeakMap } from './pseudo-polyfills.js'
import { transformers, transformersKeys } from './node-updater.js'
import { TagInvocation } from './tag-invocation-type.js'

export { repeat } from './utils.js'

const OWNER_SVG_ELEMENT = 'ownerSVGElement'

import {
  rwAwareNodeCallback,
  rxAwareAttributeCallback
} from './std-callbacks.js'

const createTemplateBlueprint = memoizeOnFirstArg(
  createTemplateBlueprintF.bind(
    null,
    rwAwareNodeCallback,
    rxAwareAttributeCallback
  )
)

const upgrade = createTemplateInstanceF.bind(null, createTemplateBlueprint)

// The main render factories

// render TL inside a DOM node used as context
export const bind = node => {
  let finalSideEffect = lruCacheOne(replaceNodeContent.bind(null, node))

  let document = node.ownerDocument
  let isSvg = OWNER_SVG_ELEMENT in node
  let upgrader = memoizeOnFirstArg(upgrade.bind(null, document, isSvg))

  return render.bind(null, upgrader, finalSideEffect)
}

export const html = (strings, ...values) => {
  if (isArray(strings)) {
    return new TagInvocation(strings, values, false)
  }
  let key = strings
  return (strings, ...values) =>
    new TagInvocation(strings, values, false, key)
}

export const svg = (strings, ...values) => {
  if (isArray(strings)) {
    return new TagInvocation(strings, values, true)
  }
  let key = strings
  return (strings, ...values) =>
    new TagInvocation(strings, values, true, key)
}

export const materialize = tagInvocation => {
  return materializer()(tagInvocation)
}

export const materializer = () => {
  let finalSideEffect = lruCacheOne(extractContent)
  let wire = lruCacheOne(isSvg =>
    memoizeOnFirstArg(upgrade.bind(null, document, isSvg))
  )
  return tagInvocation => {
    let { strings, values, isSvg } = tagInvocation
    let upgrader = wire(isSvg)
    return render(upgrader, finalSideEffect, strings, ...values)
  }
}

export const keyed = (key, tagInvocation) => {
  let { strings, values, isSvg } = tagInvocation
  return new TagInvocation(strings, values, isSvg, key)
}

export function wire(obj, type) {
  return arguments.length < 1
    ? wireContent('html')
    : obj == null
      ? wireContent(type || 'html')
      : wireWeakly(obj, type || 'html')
}

export const wireHtml = () => {
  let finalSideEffect = lruCacheOne(extractContent)
  let upgrader = memoizeOnFirstArg(upgrade.bind(null, document, false))
  return render.bind(null, upgrader, finalSideEffect)
}

export const wireSvg = () => {
  let finalSideEffect = lruCacheOne(extractContent)
  let upgrader = memoizeOnFirstArg(upgrade.bind(null, document, true))
  return render.bind(null, upgrader, finalSideEffect)
}

// - - - - - - - - - - - - - - - - - - - - - - -

// hyper.define('transformer', callback) 🌀
export const define = (transformer, callback) => {
  if (!(transformer in transformers)) {
    transformersKeys.push(transformer)
  }
  transformers[transformer] = callback
  // TODO: else throw ? console.warn ? who cares ?
}

// ---------------------------------------------
// Wires
// ---------------------------------------------

// [element] = {template, updates};
var wires = new $WeakMap()

// create a new wire for generic DOM content
function wireContent(type) {
  switch (type) {
    case 'html':
      return wireHtml()
    case 'svg':
      return wireSvg()
  }
}

// setup a weak reference if needed and return a wire by ID
function wireWeakly(obj, type) {
  var wire = wires.get(obj)
  var i = type.indexOf(':')
  var id = type
  if (-1 < i) {
    id = type.slice(i + 1)
    type = type.slice(0, i) || 'html'
  }
  if (!wire) {
    wire = {}
    wires.set(obj, wire)
  }
  return wire[id] || (wire[id] = wireContent(type))
}

// ---------------------------------------------
// ⚡️ ️️The End ➰
// ---------------------------------------------
