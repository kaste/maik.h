/* eslint semi: [1, 'always'] */

import {
  upgrade,
  instantiateBlueprint,
  adoptBlueprint
} from './make-template-instance.js';
import {FF} from './sniffs.js';
import { memoizeOnFirstArg, lruCacheOne, trim } from './utils.js';
import {$WeakMap} from './pseudo-polyfills.js';
import { UIDC } from './UID.js';
import {transformers, transformersKeys} from './node-updater.js';




var hyperHTML = (function (globalDocument) {'use strict';

  /*! (c) 2017 Andrea Giammarchi @WebReflection, (ISC) */

  // ---------------------------------------------
  // hyperHTML Public API
  // ---------------------------------------------

  // The document must be swap-able at runtime.
  // Needed by both basicHTML and nativeHTML
  hyper.document = globalDocument;

  // friendly destructuring
  hyper.hyper = hyper;

  function hyper(HTML) {
    return arguments.length < 2 ?
      (HTML == null ?
        wireContent('html') :
        (typeof HTML === 'string' ?
          wire(null, HTML) :
          ('raw' in HTML ?
            wireContent('html')(HTML) :
            ('nodeType' in HTML ?
              bind(HTML) :
              wireWeakly(HTML, 'html')
            )
          )
        )) :
      ('raw' in HTML ?
        wireContent('html') : wire
      ).apply(null, arguments);
  }


  // The main render factories

  // hyper.bind(el) ⚡️
  // render TL inside a DOM node used as context
  hyper.bind = bind;
  function bind(node) {
    let finalSideEffect = lruCacheOne(replaceNodeContent.bind(null, node));

    let document = node.ownerDocument;
    let isSvg = OWNER_SVG_ELEMENT in node;
    let upgrader = memoizeOnFirstArg(
      upgrade.bind(null, document, isSvg, instantiateBlueprint));

    return render.bind(null, upgrader, finalSideEffect);
  }

  const wireHtml = () => {
    let finalSideEffect = lruCacheOne(extractContent);
    let upgrader = memoizeOnFirstArg(
      upgrade.bind(null, document, false, instantiateBlueprint));
    return render.bind(null, upgrader, finalSideEffect);
  };
  hyper.wireHtml = wireHtml;

  const wireSvg = () => {
    let finalSideEffect = lruCacheOne(extractContent);
    let upgrader = memoizeOnFirstArg(
      upgrade.bind(null, document, true, instantiateBlueprint));
    return render.bind(null, upgrader, finalSideEffect);
  };
  hyper.wireSvg = wireSvg;

  // hyper.adopt(el) 🐣
  // adopt to an already live DOM structure
  // ATTENTION: Only works for flat templates
  hyper.adopt = function adopt(node) {
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
  hyper.define = function define(transformer, callback) {
    if (!(transformer in transformers)) {
      transformersKeys.push(transformer);
    }
    transformers[transformer] = callback;
    // TODO: else throw ? console.warn ? who cares ?
  };

  // hyper.escape('<html>') => '&lt;text&gt;' 🏃
  hyper.escape = function escape(html) {
    return html.replace(/[&<>'"]/g, fnEscape);
  };

  // hyper.wire(obj, 'type:ID') ➰
  // relate a renderer to a generic object
  hyper.wire = wire;
  function wire(obj, type) {
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







  // ---------------------------------------------
  // Features detection / ugly UA sniffs
  // ---------------------------------------------

  // both Firefox < 55 and TypeScript have issues with template literals
  // this lazy defined callback should spot issues right away
  // and in the best case scenario become a no-op
  var TL = function (template) {
    if (template.propertyIsEnumerable('raw') || FF) TL = unique;
    else TL = function (t) { return t; };
    return TL(template);
  };

  // ---------------------------------------------
  // Helpers
  // ---------------------------------------------

  // used to sanitize html
  var oEscape = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  };
  function fnEscape(m) {
    return oEscape[m];
  }


  // ---------------------------------------------
  // Shared variables
  // ---------------------------------------------


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
  return hyper;

}(document));

export default hyperHTML;

const {bind, escape, wire, wireHtml, wireSvg, adopt} = hyperHTML;
export {bind, escape, wire, wireHtml, wireSvg, adopt};
