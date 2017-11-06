/* eslint semi: [1, 'always'] */

// import {makeAttributeUpdateFn} from './attribute-updater.js';
import {
  makeRxAwareAttributeUpdateFn, rxAware
} from './rx-aware-attribute-updater.js';
import {createTemplateBlueprint} from './make-template-blueprints.js';
import {Aura, optimist} from './aura.js';
import {
  createFragment,
  getChildren,
  importNode,
  createText,
  previousElementSibling,
  nextElementSibling,
  removePreviousText,
  insertBefore
} from './dom-utils.js';
import {IE, WK, FF} from './sniffs.js';
import {
  memoizeOnFirstArg,
  lruCacheOne,
  flatten,
  indexOf, slice, trim, isArray} from './utils.js';
import {$WeakMap} from './pseudo-polyfills.js';



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

  // hyper.adopt(el) 🐣
  // import an already live DOM structure
  // described as TL
  hyper.adopt = function adopt(node) {
    let finalSideEffect = () => node;
    let upgrader = memoizeOnFirstArg(upgrade.bind(null, adoptBlueprint));
    return render.bind(null, node, upgrader, finalSideEffect);
  };

  // hyper.bind(el) ⚡️
  // render TL inside a DOM node used as context
  hyper.bind = bind;
  function bind(context) {
    let finalSideEffect = lruCacheOne(replaceNodeContent.bind(null, context));
    let upgrader = memoizeOnFirstArg(upgrade.bind(null, instantiateBlueprint));
    return render.bind(null, context, upgrader, finalSideEffect);
  }

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
  var TEXT_NODE = 3;
  var DOCUMENT_FRAGMENT_NODE = 11;

  // SVG related
  var OWNER_SVG_ELEMENT = 'ownerSVGElement';
  var SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

  var EXPANDO = '_hyper_';
  var UID = EXPANDO + ((Math.random() * new Date) | 0) + ';';
  var UIDC = '<!--' + UID + '-->';



  // ---------------------------------------------
  // hyperHTML Operations
  // ---------------------------------------------

  // entry point for all TL => DOM operations
  function render(
    contextNode, memoizedUpgrader, finalSideEffect, strings, ...values
  ) {
    strings = TL(strings);
    let {fragment, updaters} = memoizedUpgrader(strings, contextNode);
    update(updaters, values);
    return finalSideEffect(fragment);
  }

  // invokes each update function passing interpolated value
  function update(updateFns, values) {
    for (var i = 0, length = updateFns.length; i < length; i++) {
      updateFns[i](values[i]);
    }
  }

  const memoizedCreateTemplateBlueprint =
    memoizeOnFirstArg(createTemplateBlueprint);

  const instantiateBlueprint = (blueprint) => {
    let fragment = importNode(blueprint.fragment);
    let updaters = createUpdaters(fragment, blueprint.notes);
    return {fragment, updaters};
  };

  const adoptBlueprint = (blueprint, contextNode) => {
    let updaters = discoverUpdates(
      contextNode, blueprint.fragment, blueprint.notes);
    return {updaters};
  };

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



  // create a template, if unknown
  // upgrade a node to use such template for future updates
  function upgrade(next, strings, contextNode) {
    let blueprint = memoizedCreateTemplateBlueprint(strings, contextNode);
    return next(blueprint, contextNode);
  }

  // given a root node and a list of paths
  // creates an array of updates to invoke
  // whenever the next interpolation happens
  function createUpdaters(fragment, parts) {
    let updates = [];
    for (var i = 0, length = parts.length; i < length; i++) {
      let part = parts[i];
      updates[i] = createUpdateFn(part, getNode(fragment, part.path), []);
    }
    return updates;
  }

  const makeRxAwareContentUpdateFn = rxAware(setAnyContent);

  // Return function which takes a value and then performs the side-effect
  // of updating the 'hole' in the template; (...) => (val) => IO
  function createUpdateFn(part, target, childNodes) {
    switch (part.type) {
      case 'node':
        return makeRxAwareContentUpdateFn(target, childNodes, new Aura(target, childNodes));
      case 'attr':
        return makeRxAwareAttributeUpdateFn(target, part.name);
      case 'text':
        return setTextContent(target);
    }
  }


  // like createUpdates but for nodes with already a content
  function discoverUpdates(contextNode, fragment, parts) {
    let updates = [];
    for (var i = 0, length = parts.length; i < length; i++) {
      let childNodes = [];
      let part = parts[i];
      updates[i] = createUpdateFn(
        part,
        discoverNode(contextNode, fragment, part, childNodes),
        childNodes
      );
    }
    return updates;
  }

  // given an info, tries to find out the best option
  // to replace or update the content
  function discoverNode(parentNode, virtual, part, childNodes) {
    for (var
      target = parentNode,
      document = parentNode.ownerDocument,
      path = part.path,
      virtualNode = getNode(virtual, path),
      i = 0,
      length = path.length;
      i < length;
      i++
    ) {
      switch (path[i++]) {  // <- i++!  path is a flat array of tuples
        case 'children':
          target = getChildren(parentNode)[path[i]];
          if (!target) {
            // if the node is not there, create it
            target = parentNode.appendChild(
              parentNode.ownerDocument.createElement(
                getNode(virtual, path.slice(0, i + 1)).nodeName
              )
            );

          }

          if (i === length - 1 && part.type === 'attr') {
            target.removeAttribute(part.name);
          }
          parentNode = target;
          break;
        case 'childNodes':
          var children = getChildren(parentNode);
          var virtualChildren = getChildren(virtualNode.parentNode);
          target = previousElementSibling(virtualNode);
          var before = target ? (indexOf.call(virtualChildren, target) + 1) : -1;
          target = nextElementSibling(virtualNode);
          var after = target ? indexOf.call(virtualChildren, target) : -1;
          switch (true) {
            // `${'virtual'}` is actually resolved as `${'any'}`
            // case before < 0 && after < 0:
            //   after = 0;

            case after < 0:
            // `</a>${'virtual'}`
              after = children.length;
              break;
            case before < 0:
            // `${'virtual'}<b>`
              before = 0;
              /* fallthrough */
            default:
            // `</a>${'virtual'}<b>`
              after = -(virtualChildren.length - after);
              break;
          }
          childNodes.push.apply(
            childNodes,
            slice.call(children, before, after)
          );

          target = document.createComment(UID);
          if (childNodes.length) {
            insertBefore(
              parentNode,
              target,
              nextElementSibling(childNodes[childNodes.length - 1])
            );
          } else {
            insertBefore(
              parentNode,
              target,
              slice.call(children, after)[0]
            );
          }
          if (childNodes.length === 0) {
            removePreviousText(parentNode, target);
          }
          break;
      }
    }
    return target;
  }



  // --------------------------------------------
  // side-effects
  // --------------------------------------------

  // `<style>${'text'}</style>`
  function setTextContent(node) {
    var oldValue;
    return function (value) {
      if (value !== oldValue) {
        oldValue = value;
        node.textContent = value;
      }
    };
  }

  // `<p>${'any'}</p>`
  // `<li>a</li>${'virtual'}<li>c</li>`
  function setAnyContent(node, childNodes, aura) {
    var oldValue;
    return function anyContent(value) {
      var length;
      switch (typeof value) {
        case 'string':
        case 'number':
        case 'boolean':
          length = childNodes.length;
          if (
            length === 1 &&
            childNodes[0].nodeType === TEXT_NODE
          ) {
            if (oldValue !== value) {
              oldValue = value;
              childNodes[0].textContent = value;
            }
          } else {
            oldValue = value;
            if (length) {
              aura.splice(0, length, createText(node, value));
            } else {
              childNodes[0] = node.parentNode.insertBefore(
                createText(node, value),
                node
              );
            }
          }
          break;
        case 'function':
          anyContent(value(node.parentNode, childNodes, 0));
          break;
        case 'object':
        case 'undefined':
          if (value == null) {
            oldValue = value;
            anyContent('');
            break;
          }
          /* fallthrough */
        default:
          oldValue = value;
          if (isArray(value)) {
            length = value.length;
            if (length === 0) {
              aura.splice(0);
            } else {
              switch (typeof value[0]) {
                case 'string':
                case 'number':
                case 'boolean':
                  anyContent({html: value});
                  break;
                case 'function':
                  var parentNode = node.parentNode;
                  for (var i = 0; i < length; i++) {
                    value[i] = value[i](parentNode, childNodes, i);
                  }
                  anyContent(flatten(value));
                  break;
                case 'object':
                  if (isArray(value[0])) {
                    value = flatten(value);
                  }
                  if (isPromise_ish(value[0])) {
                    Promise.all(value).then(anyContent);
                    break;
                  }
                  /* fallthrough */
                default:
                  optimist(aura, value);
                  break;
              }
            }
          } else if (isNode_ish(value)) {
            optimist(
              aura,
              value.nodeType === DOCUMENT_FRAGMENT_NODE ?
                slice.call(value.childNodes) :
                [value]
            );
          } else if (isPromise_ish(value)) {
            value.then(anyContent);
          } else if ('placeholder' in value) {
            invokeAtDistance(value, anyContent);
          } else if ('text' in value) {
            anyContent(String(value.text));
          } else if ('any' in value) {
            anyContent(value.any);
          } else if ('html' in value) {
            var html = [].concat(value.html).join('');
            aura.splice(0);
            var fragment = createFragment(node, html);
            childNodes.push.apply(childNodes, fragment.childNodes);
            node.parentNode.insertBefore(fragment, node);
          } else if ('length' in value) {
            anyContent(slice.call(value));
          } else {
            anyContent(invokeTransformer(value, anyContent));
          }
          break;
      }
    };
  }


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

  // return content as html
  function asHTML(html) {
    return {html: html};
  }


  // use a placeholder and resolve with the right callback
  function invokeAtDistance(value, callback) {
    callback(value.placeholder);
    if ('text' in value) {
      Promise.resolve(value.text).then(String).then(callback);
    } else if ('any' in value) {
      Promise.resolve(value.any).then(callback);
    } else if ('html' in value) {
      Promise.resolve(value.html).then(asHTML).then(callback);
    } else {
      Promise.resolve(invokeTransformer(value, callback)).then(callback);
    }
  }

  // last attempt to transform content
  function invokeTransformer(object, callback) {
    for (var key, i = 0, length = transformersKeys.length; i < length; i++) {
      key = transformersKeys[i];
      if (object.hasOwnProperty(key)) {
        return transformers[key](object[key], callback);
      }
    }
  }

  // quick and dirty Node check
  function isNode_ish(value) {
    return 'ELEMENT_NODE' in value;
  }

  // quick and dirty Promise check
  function isPromise_ish(value) {
    return value != null && 'then' in value;
  }

  // ---------------------------------------------
  // Shared variables
  // ---------------------------------------------

  // transformers registry
  var transformers = {};
  var transformersKeys = [];

  // normalize Firefox issue with template literals
  var templateObjects = {};

  function unique(template) {
    var key = '_' + template.join(UIDC);
    return templateObjects[key] ||
          (templateObjects[key] = template);
  }


  // return the correct node walking through a path
  // fixes IE/Edge issues with attributes and children (fixes old WebKit too)
  var getNode = IE || WK ?
      function getNode(parentNode, path) {
        for (var name, i = 0, length = path.length; i < length; i++) {
          name = path[i++];
          switch (name) {
            case 'children':
              parentNode = getChildren(parentNode)[path[i]];
              break;
            default:
              parentNode = parentNode[name][path[i]];
              break;
          }
        }
        return parentNode;
      } :
      function getNode(parentNode, path) {
        for (var i = 0, length = path.length; i < length; i++) {
          parentNode = parentNode[path[i++]][path[i]];
        }
        return parentNode;
      };



  // ---------------------------------------------
  // Wires
  // ---------------------------------------------

  // FIXME:
  // Currently `render` still needs a contextNode. This is for two reasons:
  // First, it uses `contextNode.ownerDocument` instead of a global one.
  // Second, it uses the type of this node to tell if it should render svg or
  // html.
  // The first rules becomes obsolete obviously bc we just use `document` here.
  const htmlContextNode = document.createElement('div');
  const svgContextNode = document.createElementNS(SVG_NAMESPACE, 'svg');

  const wireHtml = () => {
    let finalSideEffect = lruCacheOne(extractContent);
    let upgrader = memoizeOnFirstArg(upgrade.bind(null, instantiateBlueprint));
    return render.bind(null, htmlContextNode, upgrader, finalSideEffect);
  };
  hyper.wireHtml = wireHtml;

  const wireSvg = () => {
    let finalSideEffect = lruCacheOne(extractContent);
    let upgrader = memoizeOnFirstArg(upgrade.bind(null, instantiateBlueprint));
    return render.bind(null, svgContextNode, upgrader, finalSideEffect);
  };
  hyper.wireSvg = wireSvg;

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
