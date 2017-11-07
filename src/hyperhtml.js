/* eslint semi: [1, 'always'] */

/*! (c) 2017 Andrea Giammarchi @WebReflection, (ISC) */
/*! (c) 2017 herr.kaste, (ISC) */

import {
  upgrade,
  instantiateBlueprint,
  adoptBlueprint
} from './make-template-instance.js';
import {FF} from './sniffs.js';
import { memoizeOnFirstArg, lruCacheOne, trim, isArray } from './utils.js';
import {$WeakMap} from './pseudo-polyfills.js';
import { UIDC } from './UID.js';
import {transformers, transformersKeys} from './node-updater.js';
import {TagInvocation} from './tag-invocation-type.js';






// ---------------------------------------------
// hyperHTML Public API
// ---------------------------------------------




// The main render factories

// hyper.bind(el) ⚡️
// render TL inside a DOM node used as context
export const bind = (node) => {
  let finalSideEffect = lruCacheOne(replaceNodeContent.bind(null, node));

  let document = node.ownerDocument;
  let isSvg = OWNER_SVG_ELEMENT in node;
  let upgrader = memoizeOnFirstArg(
    upgrade.bind(null, document, isSvg, instantiateBlueprint));

  return render.bind(null, upgrader, finalSideEffect);
};

export const html = (strings, ...values) => {
  if (isArray(strings)) {
    return new TagInvocation(strings, values, false);
  }
  let key = strings;
  return (strings, ...values) => new TagInvocation(strings, values, false, key);
};

export const svg = (strings, ...values) => {
  if (isArray(strings)) {
    return new TagInvocation(strings, values, true);
  }
  let key = strings;
  return (strings, ...values) => new TagInvocation(strings, values, true, key);
};


export const materializer = (finalizer=extractContent) => {
  let finalSideEffect = lruCacheOne(finalizer);
  let wire = lruCacheOne(
    (isSvg) => memoizeOnFirstArg(
      upgrade.bind(null, document, isSvg, instantiateBlueprint)
    )
  );
  return (tagInvocation) => {
    let {strings, values, isSvg} = tagInvocation;
    let upgrader = wire(isSvg);
    return render(upgrader, finalSideEffect, strings, ...values);
  };
};

export const materialize = (tagInvocation) => {
  return materializer()(tagInvocation);
};

export const keyed = (key, tagInvocation) => {
  tagInvocation.key = key;
  return tagInvocation;
};


export const wireHtml = () => {
  let finalSideEffect = lruCacheOne(extractContent);
  let upgrader = memoizeOnFirstArg(
    upgrade.bind(null, document, false, instantiateBlueprint));
  return render.bind(null, upgrader, finalSideEffect);
};

export const wireSvg = () => {
  let finalSideEffect = lruCacheOne(extractContent);
  let upgrader = memoizeOnFirstArg(
    upgrade.bind(null, document, true, instantiateBlueprint));
  return render.bind(null, upgrader, finalSideEffect);
};

// hyper.adopt(el) 🐣
// adopt to an already live DOM structure
// ATTENTION: Only works for flat templates
export const adopt = (node) => {
  let finalSideEffect = () => node;

  let document = node.ownerDocument;
  let isSvg = OWNER_SVG_ELEMENT in node;
  let adopter = adoptBlueprint.bind(null, node);
  let upgrader = memoizeOnFirstArg(
    upgrade.bind(null, document, isSvg, adopter));

  return render.bind(null, upgrader, finalSideEffect);
};

// - - - - - - - - - - - - - - - - - - - - - - -


// hyper.define('transformer', callback) 🌀
export const define = (transformer, callback) => {
  if (!(transformer in transformers)) {
    transformersKeys.push(transformer);
  }
  transformers[transformer] = callback;
  // TODO: else throw ? console.warn ? who cares ?
};

// hyper.wire(obj, 'type:ID') ➰
// relate a renderer to a generic object
export function wire(obj, type) {
  return arguments.length < 1 ?
    wireContent('html') :
    (obj == null ?
      wireContent(type || 'html') :
      wireWeakly(obj, type || 'html')
    );
}


// - - - - - - - - - - - - - - - - - - - - - - -

// ---------------------------------------------
// Constants
// ---------------------------------------------

// Node.CONSTANTS
// without assuming Node is globally available
// since this project is used on the backend too
var ELEMENT_NODE = 1;

// SVG related
const OWNER_SVG_ELEMENT = 'ownerSVGElement';




// ---------------------------------------------
// hyperHTML Operations
// ---------------------------------------------

// entry point for all TL => DOM operations
function render(createTemplateInstance, finalSideEffect, strings, ...values) {
  strings = TL(strings);
  let {fragment, updaters} = createTemplateInstance(strings);
  update(updaters, values);
  return finalSideEffect(fragment);
}

// invokes each update function passing interpolated value
function update(updateFns, values) {
  for (var i = 0, length = updateFns.length; i < length; i++) {
    updateFns[i](values[i]);
  }
}

const replaceNodeContent = (node, fragment) => {
  node.textContent = '';
  node.appendChild(fragment);
  return node;
};

// return a single node or an Array or nodes
const extractContent = (node) => {
  let content = [];
  let childNodes = node.childNodes;

  for (var i = 0, length = childNodes.length; i < length; i++) {
    let child = childNodes[i];
    if (child.nodeType === ELEMENT_NODE ||
        trim.call(child.textContent).length !== 0) {
      content.push(child);
    }
  }
  return content.length === 1 ? content[0] : content;
};







// both Firefox < 55 and TypeScript have issues with template literals
// this lazy defined callback should spot issues right away
// and in the best case scenario become a no-op
var TL = function (template) {
  if (template.propertyIsEnumerable('raw') || FF) TL = unique;
  else TL = function (t) { return t; };
  return TL(template);
};

// normalize Firefox issue with template literals
var templateObjects = {};

function unique(template) {
  var key = '_' + template.join(UIDC);
  return templateObjects[key] ||
        (templateObjects[key] = template);
}


// ---------------------------------------------
// Wires
// ---------------------------------------------

// [element] = {template, updates};
var wires = new $WeakMap;

// create a new wire for generic DOM content
function wireContent(type) {
  switch (type) {
    case 'html':
      return wireHtml();
    case 'svg':
      return wireSvg();
  }
}

// setup a weak reference if needed and return a wire by ID
function wireWeakly(obj, type) {
  var wire = wires.get(obj);
  var i = type.indexOf(':');
  var id = type;
  if (-1 < i) {
    id = type.slice(i + 1);
    type = type.slice(0, i) || 'html';
  }
  if (!wire) {
    wire = {};
    wires.set(obj, wire);
  }
  return wire[id] || (wire[id] = wireContent(type));
}

// ---------------------------------------------
// ⚡️ ️️The End ➰
// ---------------------------------------------
