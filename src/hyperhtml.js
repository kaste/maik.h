/* eslint semi: [1, 'always'] */

import {majinbuu} from '../node_modules/majinbuu/esm/main.js';
// import {makeAttributeUpdateFn} from './attribute-updater.js';
import {
  makeRxAwareAttributeUpdateFn, rxAware
} from './rx-aware-attribute-updater.js';

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
  var ATTRIBUTE_NODE = 2;
  var TEXT_NODE = 3;
  var COMMENT_NODE = 8;
  var DOCUMENT_FRAGMENT_NODE = 11;

  // SVG related
  var OWNER_SVG_ELEMENT = 'ownerSVGElement';
  var SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

  var SHOULD_USE_ATTRIBUTE = /^style$/i;
  var SHOULD_USE_TEXT_CONTENT = /^style|textarea$/i;
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
  // DOM Traversing
  // ---------------------------------------------

  // look for attributes that contains the comment text
  function attributesSeeker(node, notes, strings) {
    let foundAttributes = [];
    for (var
      name, realName, attrs, attr,
      attribute,
      cache = Object.create(null),
      attributes = node.attributes,
      i = 0, length = attributes.length;
      i < length; i++
    ) {
      attribute = attributes[i];
      if (attribute.value === UID) {
        name = attribute.name;
        // this is an IE < 11 thing only
        if (name in cache) {
          // attributes with unrecognized values
          // are duplicated, even if same attribute, across the node
          // to fix it, you need to remove it
          node.removeAttributeNode(attribute);
          // put a value that won't (hopefully) bother IE
          cache[name].value = '';
          // and place the node back
          node.setAttributeNode(cache[name]);
          // this will decrease attributes count by 1
          length--;
          // so the loop should be decreased by 1 too
          i--;
        } else {
          realName = strings.shift().replace(/^(?:|[\S\s]*?\s)(\S+?)=['"]?$/, '$1');
          attrs = node.attributes;
          // fallback is needed in both jsdom
          // and in not-so-standard browsers/engines
          attr = cache[name] = attrs[realName] || attrs[realName.toLowerCase()];
          foundAttributes.push(attr);
          notes.push(createNote('attr', node, realName));
        }
      }
    }
    for (let i=0, l=foundAttributes.length, attr; i<l; i++) {
      attr = foundAttributes[i];
      node.removeAttributeNode(attr);
    }
  }

  // walk the fragment tree in search of comments
  function hyperSeeker(node, notes, strings) {
    for (var
      child,
      childNodes = node.childNodes,
      length = childNodes.length,
      i = 0; i < length; i++
    ) {
      child = childNodes[i];
      switch (child.nodeType) {
        case ELEMENT_NODE:
          attributesSeeker(child, notes, strings);
          hyperSeeker(child, notes, strings);
          break;
        case COMMENT_NODE:
          if (child.textContent === UID) {
            strings.shift();
            notes.push(createNote('node', child));
          }
          break;
        case TEXT_NODE:
          if (
            SHOULD_USE_TEXT_CONTENT.test(node.nodeName) &&
            trim.call(child.textContent) === UIDC
          ) {
            strings.shift();
            notes.push(createNote('text', node));
          }
          break;
      }
    }
  }

  // ---------------------------------------------
  // Features detection / ugly UA sniffs
  // ---------------------------------------------
  var featureFragment = createDocumentFragment(globalDocument);

  // Firefox < 55 has non standard template literals.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1108941
  // TODO: is there any better way to feature detect this ?
  var FF = typeof navigator === 'object' &&
            /Firefox\/(\d+)/.test(navigator.userAgent) &&
            parseFloat(RegExp.$1) < 55;

  // If attributes order is shuffled, threat the browser differently
  // Usually this is a well known IE only limitation but some older FF does the same.
  var IE =  (function () {
              var p  = globalDocument.createElement('p');
              p.innerHTML = '<i data-i="" class=""></i>';
              return /class/i.test(p.firstChild.attributes[0].name);
            }());


  // beside IE, old WebKit browsers don't have `children` in DocumentFragment
  var WK = !('children' in featureFragment);

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

  // just a minifier friendly indirection
  function createDocumentFragment(document) {
    return document.createDocumentFragment();
  }

  // given a node, inject some html and return
  // the resulting template document fragment
  function createFragment(node, html) {
    return (
      OWNER_SVG_ELEMENT in node ?
        createSVGFragment :
        createHTMLFragment
    )(node, html);
  }

  // create fragment for HTML
  function createHTMLFragment(node, html) {
    let document = node.ownerDocument;
    let container = document.createElement('template');
    let supportsTemplate = 'content' in container;

    if (supportsTemplate) {
      container.innerHTML = html;
      return container.content;
    } else {
      let fragment = createDocumentFragment(document);

      // el.innerHTML = '<td></td>'; is not possible
      // if the content is a partial internal table content
      // it needs to be wrapped around once injected.
      // HTMLTemplateElement does not suffer this issue.
      let needsTableWrap = /^[^\S]*?<(col(?:group)?|t(?:head|body|foot|r|d|h))/i.test(html);
      if (needsTableWrap) {
        // secure the RegExp.$1 result ASAP to avoid issues
        // in case a non-browser DOM library uses RegExp internally
        // when HTML content is injected (basicHTML / jsdom / others...)
        let selector = RegExp.$1;
        container.innerHTML = '<table>' + html + '</table>';
        appendNodes(fragment, slice.call(container.querySelectorAll(selector)));
      } else {
        container.innerHTML = html;
        appendNodes(fragment, slice.call(container.childNodes));
      }

      return fragment;
    }

  }

  // create a fragment for SVG
  function createSVGFragment(node, html) {
    var container;
    var document = node.ownerDocument;
    var fragment = createDocumentFragment(document);
    if (IE || WK) {
      container = document.createElement('div');
      container.innerHTML = '<svg xmlns="' + SVG_NAMESPACE + '">' + html + '</svg>';
      appendNodes(fragment, slice.call(container.firstChild.childNodes));
    } else {
      container = document.createElementNS(SVG_NAMESPACE, 'svg');
      container.innerHTML = html;
      appendNodes(fragment, slice.call(container.childNodes));
    }
    return fragment;
  }

  // given a node, it does what is says
  function createText(node, text) {
    return node.ownerDocument.createTextNode(text);
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

  /*
   For each 'hole' we create a note.
   {
     type: String(node|attr|text),
     path: Array<accessor, index>, // used to find the node quickly via `getNode`
     name?: String  // the attribute name, if type is attr
   }
   */
  function createNote(type, node, name) {
    let path = createPath(node);
    return {type, path, name};
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

  // use native .append(...childNodes) where available
  var appendNodes = 'append' in featureFragment ?
      function (node, childNodes) {
        node.append.apply(node, childNodes);
      } :
      function appendNodes(node, childNodes) {
        for (var
          i = 0,
          length = childNodes.length;
          i < length; i++
        ) {
          node.appendChild(childNodes[i]);
        }
      };

  // returns children or retrieve them in IE/Edge
  var getChildren = WK || IE ?
      function (node) {
        for (var
          child,
          children = [],
          childNodes = node.childNodes,
          j = 0, i = 0, length = childNodes.length;
          i < length; i++
        ) {
          child = childNodes[i];
          if (child.nodeType === ELEMENT_NODE)
            children[j++] = child;
        }
        return children;
      } :
      function (node) { return node.children; };

  // return the correct node walking through a path
  // fixes IE/Edge issues with attributes and children (fixes old WebKit too)
  var getNode = IE || WK ?
      function (parentNode, path) {
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
      function (parentNode, path) {
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

  // IE 11 has problems with cloning templates too
  // it "forgets" empty childNodes
  // herrkaste: Does it also have problems with importing nodes?
  var importNode = (function () {
    featureFragment.appendChild(createText(featureFragment, 'g'));
    featureFragment.appendChild(createText(featureFragment, ''));
    return featureFragment.cloneNode(true).childNodes.length === 1 ?
      function (node) {
        for (var
          clone = document.importNode(),
          childNodes = node.childNodes || [],
          i = 0, length = childNodes.length;
          i < length; i++
        ) {
          clone.appendChild(importNode(childNodes[i]));
        }
        return clone;
      } :
      function (fragment) {
        return document.importNode(fragment, true);
      };
  }());

  // ---------------------------------------------
  // Adopting Nodes
  // ---------------------------------------------

  // IE/Edge gotcha with comment nodes
  var nextElementSibling = IE ?
    function (node) {
      // eslint-disable-next-line no-cond-assign
      while (node = node.nextSibling) {
        if (node.nodeType === ELEMENT_NODE) return node;
      }
      return undefined;
    } :
    function (node) { return node.nextElementSibling; };

  var previousElementSibling = IE ?
    function (node) {
      // eslint-disable-next-line no-cond-assign
      while (node = node.previousSibling) {
       if (node.nodeType === ELEMENT_NODE) return node;
      }
      return undefined;
    } :
    function (node) { return node.previousElementSibling; };

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


  /**
   * The functions `findTagClose` and `getHTML` originally come from the
   * lit-html PR https://github.com/PolymerLabs/lit-html/pull/153
   * authored by https://github.com/jridgewell
   *
   * Slightly modified to actually work.
   */

  /**
   * Finds the closing index of the last closed HTML tag.
   * This has 3 possible return values:
   *   - `-1`, meaning there is no tag in str.
   *   - `string.length`, meaning the last opened tag is unclosed.
   *   - Some positive number < str.length, meaning the index of the closing '>'.
   */
  function findTagClose(str) {
    const close = str.lastIndexOf('>');
    const open = str.indexOf('<', close + 1);
    return open > -1 ? str.length : close;
  }

  const textMarker = UIDC;
  const attributeMarker = UID;

  const getHTML = (strings) => {
    const l = strings.length;
    let html = '';
    let isTextBinding = true;
    for (let i = 0; i < l - 1; i++) {
      const s = strings[i];
      html += s;
      // We're in a text position if the previous string closed its tags.
      // If it doesn't have any tags, then we use the previous text position
      // state.
      const closing = findTagClose(s);
      isTextBinding = closing > -1 ? closing < s.length : isTextBinding;
      html += isTextBinding ? textMarker : attributeMarker;
    }
    html += strings[l - 1];
    return html;
  };


  // ---------------------------------------------
  // Template related utilities
  // ---------------------------------------------

  // Given the unique static strings of a template-tag invocation,
  // create a blueprint fragment and notes about its dynamic parts
  // which we can use over and over for new instances of this (template)
  // fragment
  function createTemplateBlueprint(strings, contextNode) {
    let html = getHTML(strings);
    let fragment = createFragment(contextNode, html);
    return processFragment(strings, fragment);
  }

  /*
    `processFragment` is generally a destructive thing. We walk the
    initial fragment, remove all the attributes for which the user wants to
    fill in values (in short: the dynamic attributes), and take notes about
    every dynamic 'hole' we find.
   */
  const processFragment = (strings, fragment) => {
    let notes = [];
    hyperSeeker(fragment, notes, strings.slice());  // mutate alert
    // Return the mutated fragment and notes about each 'hole'
    return {fragment, notes};
  };

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

  // given a generic node, returns a path capable
  // of retrieving such path back again.
  // TODO: worth passing the index when available ?
  function createPath(node) {
    let path = [];
    let parentNode;

    if (node.nodeType === COMMENT_NODE) {
      parentNode = node.parentNode;
      path.unshift(
        'childNodes',
        indexOf.call(parentNode.childNodes, node)
      );
      node = parentNode;
    }

    // eslint-disable-next-line no-cond-assign
    while(parentNode = node.parentNode) {
      path.unshift('children', indexOf.call(getChildren(parentNode), node));
      node = parentNode;
    }
    return path;
  }

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
