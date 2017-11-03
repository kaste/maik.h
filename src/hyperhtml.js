/* eslint semi: [1, 'always'] */

import {majinbuu} from '../node_modules/majinbuu/esm/main.js';
// import {makeAttributeUpdateFn} from './attribute-updater.js';
import {
  makeRxAwareAttributeUpdateFn, rxAware
} from './rx-aware-attribute-updater.js';
import {createTemplateBlueprint} from './make-template-blueprints.js';
import {
  createDocumentFragment,
  createFragment,
  getChildren,
  importNode,
  appendNodes,
  createText,
  previousElementSibling,
  nextElementSibling,
} from './dom-utils.js';
import {IE, WK, FF} from './sniffs.js';


var hyperHTML = (function (globalDocument, majinbuu) {'use strict';

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
    return function () {
      notAdopting = false;
      render.apply(node, arguments);
      notAdopting = true;
      return node;
    };
  };

  // hyper.bind(el) ⚡️
  // render TL inside a DOM node used as context
  hyper.bind = bind;
  function bind(context) { return render.bind(context); }

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
  // DOM Manipulation
  // ---------------------------------------------

  function Aura(node, childNodes) {
    this.node = node;
    this.childNodes = childNodes;
    return majinbuu.aura(this, childNodes);
  }

  Aura.prototype.splice = function splice(start) {
    for (var
      tmp,
      ph = this.node,
      cn = this.childNodes,
      target = cn[start + (arguments[1] || 0)] || ph,
      result = cn.splice.apply(cn, arguments),
      pn = ph.parentNode,
      i = 0,
      length = result.length;
      i < length; i++
    ) {
      tmp = result[i];
      // TODO: this is not optimal (but necessary)
      if (cn.indexOf(tmp) < 0) {
        pn.removeChild(tmp);
      }
    }
    i = 2;
    length = arguments.length;
    if (i < length) {
      if ((length - i) === 1) {
        tmp = arguments[i];
      } else {
        tmp = createDocumentFragment(pn.ownerDocument);
        while (i < length) {
          tmp.appendChild(arguments[i++]);
        }
      }
      pn.insertBefore(tmp, target);
    }
    return result;
  };

  // ---------------------------------------------
  // hyperHTML Operations
  // ---------------------------------------------

  // entry point for all TL => DOM operations
  function render(template, ...values) {
    var hyper = hypers.get(this);
    template = TL(template);
    if (!hyper || hyper.template !== template) {
      upgrade(this, template, values);
    } else {
      update(hyper.updaters, values);
    }
    return this;
  }

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
                  anyContent(value.concat.apply([], value));
                  break;
                case 'object':
                  if (isArray(value[0])) {
                    value = value.concat.apply([], value);
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

  // used to convert childNodes to Array
  const slice = [].slice;
  const indexOf = [].indexOf;

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

  // return a single node or an Array or nodes
  function extractContent(node) {
    for (var
      child,
      content = [],
      childNodes = node.childNodes,
      i = 0,
      length = childNodes.length;
      i < length; i++
    ) {
      child = childNodes[i];
      if (
        child.nodeType === ELEMENT_NODE ||
        trim.call(child.textContent).length !== 0
      ) {
        content.push(child);
      }
    }
    return content.length === 1 ? content[0] : content;
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

  // uses majinbuu only if the two lists are different
  function optimist(aura, value) {
    var i = 0, length = aura.length;
    if (value.length !== length) {
      majinbuu(aura, value, hyper.MAX_LIST_SIZE);
    } else {
      for (; i < length--; i++) {
        if (aura[length] !== value[length] || aura[i] !== value[i]) {
          majinbuu(aura, value, hyper.MAX_LIST_SIZE);
          return;
        }
      }
    }
  }


  const makeRxAwareContentUpdateFn = rxAware(setAnyContent);

  // Return function which takes a value and then performs the side-effect
  // of updating the 'hole' in the template; (...) => (val) => IO
  function createUpdateFn(info, target, childNodes) {
    switch (info.type) {
      case 'node':
        return makeRxAwareContentUpdateFn(target, childNodes, new Aura(target, childNodes));
      case 'attr':
        return makeRxAwareAttributeUpdateFn(target, info.name);
      case 'text':
        return setTextContent(target);
    }
  }

  // ---------------------------------------------
  // Hybrid Shims
  // ---------------------------------------------

  // WeakMap with partial UID fallback
  var $WeakMap = typeof WeakMap === typeof $WeakMap ?
      function () {
        // NOT A POLYFILL: simplified ad-hoc for this library cases
        /* istanbul ignore next */
        return {
          delete: function (obj) { delete obj[UID]; },
          get: function (obj) { return obj[UID]; },
          has: function (obj) { return UID in obj; },
          set: function (obj, value) {
            Object.defineProperty(obj, UID, {
              configurable: true,
              value: value
            });
          }
        };
      } :
      WeakMap;

  var $WeakSet = typeof WeakSet === typeof $WeakSet ?
      function () {
        var wm = new $WeakMap;
        // NOT A POLYFILL: simplified ad-hoc for this library cases
        /* istanbul ignore next */
        return {
          add: function (obj) { wm.set(obj, true); },
          has: function (obj) { return wm.get(obj) === true; }
        };
      } :
      WeakSet;

  // Map with partial double Array fallback
  var $Map = typeof Map === typeof $Map ?
      function () {
        var k = [], v = [];
        return {
          get: function (obj) {
            return v[k.indexOf(obj)];
          },
          // being used with unique template literals
          // there is never a case when a value is overwritten
          // no need to check upfront for the indexOf
          set: function (obj, value) {
            v[k.push(obj) - 1] = value;
          }
        };
      } :
      Map;

  // TODO: which browser needs these partial polyfills here?

  // BB7 and webOS need this
  var isArray = Array.isArray ||
                (function () {
                  var toString = {}.toString;
                  // I once had an engine returning [array Array]
                  // and I've got scared since!
                  var s = toString.call([]);
                  return function (a) {
                    return toString.call(a) === s;
                  };
                }());

  // older WebKit need this
  var trim = EXPANDO.trim ||
              function () { return this.replace(/^\s+|\s+$/g, ''); };

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

  // [element] = {template, updates};
  var hypers = new $WeakMap;

  // [element] = {template, updates};
  var wires = new $WeakMap;

  // internal signal to switch adoption
  var notAdopting = true;

  // ---------------------------------------------
  // Adopting Nodes
  // ---------------------------------------------

  // remove all text nodes from a virtual space
  function removePreviousText(parentNode, node) {
    var previousSibling = node.previousSibling;
    if (previousSibling && previousSibling.nodeType === TEXT_NODE) {
      parentNode.removeChild(previousSibling);
      removePreviousText(parentNode, node);
    }
  }

  // avoid errors on obsolete platforms
  function insertBefore(parentNode, target, after) {
    if (after) {
      parentNode.insertBefore(target, after);
    } else {
      parentNode.appendChild(target);
    }
  }

  // given an info, tries to find out the best option
  // to replace or update the content
  function discoverNode(parentNode, virtual, info, childNodes) {
    for (var
      target = parentNode,
      document = parentNode.ownerDocument,
      path = info.path,
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

          if (i === length - 1 && info.type === 'attr') {
            target.removeAttribute(info.name);
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

  // like createUpdates but for nodes with already a content
  function discoverUpdates(contextNode, fragment, paths) {
    for (var
      info, childNodes,
      updates = [],
      i = 0, length = paths.length;
      i < length; i++
    ) {
      childNodes = [];
      info = paths[i];
      updates[i] = createUpdateFn(
        info,
        discoverNode(contextNode, fragment, info, childNodes),
        childNodes
      );
    }
    return updates;
  }



  // ---------------------------------------------
  // Template related utilities
  // ---------------------------------------------

  const memoizeOnFirstArg = (fn) => {
    let cache = new $Map();
    return (arg, ...args) => {
      let rv = cache.get(arg);
      if (rv === undefined) {
        rv = fn(arg, ...args);
        cache.set(arg, rv);
      }
      return rv;
    };
  };

  const memoizedCreateTemplateBlueprint =
    memoizeOnFirstArg(createTemplateBlueprint);


  // given a root node and a list of paths
  // creates an array of updates to invoke
  // whenever the next interpolation happens
  function createUpdaters(fragment, paths) {
    for (var
      info,
      updates = [],
      i = 0, length = paths.length;
      i < length; i++
    ) {
      info = paths[i];
      updates[i] = createUpdateFn(
        info,
        getNode(fragment, info.path),
        []
      );
    }
    return updates;
  }

  // invokes each update function passing interpolated value
  function update(updateFns, values) {
    for (var i = 0, length = updateFns.length; i < length; i++) {
      updateFns[i](values[i]);
    }
  }

  // create a template, if unknown
  // upgrade a node to use such template for future updates
  function upgrade(contextNode, template, values) {
    let updaters;
    let info = memoizedCreateTemplateBlueprint(template, contextNode);
    if (notAdopting) {
      var fragment = importNode(info.fragment);
      updaters = createUpdaters(fragment, info.notes);
      hypers.set(contextNode, {template: template, updaters: updaters});
      update(updaters, values);
      contextNode.textContent = '';
      contextNode.appendChild(fragment);
    } else {
      updaters = discoverUpdates(contextNode, info.fragment, info.notes);
      hypers.set(contextNode, {template: template, updaters: updaters});
      update(updaters, values);
    }
  }

  // ---------------------------------------------
  // Wires
  // ---------------------------------------------

  // create a new wire for generic DOM content
  function wireContent(type) {
    var adopter, content, container, fragment, render, setup, template;

    function before(document) {
      fragment = createDocumentFragment(document);
      container = type === 'svg' ?
        document.createElementNS(SVG_NAMESPACE, 'svg') :
        fragment;
      render = bind(container);
    }

    function after() {
      if (setup) {
        setup = false;
        if (type === 'svg') {
          appendNodes(fragment, slice.call(container.childNodes));
        }
        content = extractContent(fragment);
      }
      return content;
    }

    return type === 'adopt' ?
      function adopt(statics) {
        var args = arguments;
        statics = TL(statics);
        if (template !== statics) {
          setup = true;
          template = statics;
          adopter = function (parentNode, children, i) {
            if (setup) {
              if (i < children.length) {
                container = children[i];
                fragment = {
                  ownerDocument: container.ownerDocument,
                  childNodes: [container],
                  children: [container]
                };
                render = hyper.adopt(fragment);
              } else {
                if (OWNER_SVG_ELEMENT in parentNode) type = 'svg';
                before(parentNode.ownerDocument);
              }
            }
            render.apply(null, args);
            return after();
          };
        }
        return adopter;
      } :
      function update(statics) {
        statics = TL(statics);
        if (template !== statics) {
          setup = true;
          template = statics;
          before(hyper.document);
        }
        render.apply(null, arguments);
        return after();
      };
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

  // avoid processing too many nodes
  // this is about the algorithm used
  // to calculate the least amount of DOM
  // changes needed to show the a new list
  // where there was another one.
  // There is a limit, in terms of performance,
  // on how big can the optimal computation be,
  // so if you change this value be sure your
  // target hardware is good enough.
  hyper.MAX_LIST_SIZE = 1000;

  // ---------------------------------------------
  // ⚡️ ️️The End ➰
  // ---------------------------------------------
  return hyper;

}(document, majinbuu));

export default hyperHTML;

const {bind, escape, wire, adopt} = hyperHTML;
export {bind, escape, wire, adopt};
