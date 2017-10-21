import majinbuu from './node_modules/majinbuu/index.js';

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

  // hyper.Component([initialState]) 🍻
  // An overly-simplified Component class.
  // For full Custom Elements support
  // see HyperHTMLElement instead.
  hyper.Component = Component;
  function Component() {}
  Object.defineProperties(
    Component.prototype,
    {
      // same as HyperHTMLElement handleEvent
      handleEvent: {value: function (e) {
        // both IE < 11 and JSDOM lack dataset
        var ct = e.currentTarget;
        this[
          ('getAttribute' in ct && ct.getAttribute('data-call')) ||
          ('on' + e.type)
        ](e);
      }},
      // returns its own HTML wire or create it once on comp.render()
      html: lazyGetter('html', wireContent),
      // returns its own SVG wire or create it once on comp.render()
      svg: lazyGetter('svg', wireContent),
      // same as HyperHTMLElement state
      state: lazyGetter('state', function () { return this.defaultState; }),
      // same as HyperHTMLElement get defaultState
      defaultState: {get: function () { return {}; }},
      // same as HyperHTMLElement setState
      setState: {value: function (state) {
        var target = this.state;
        var source = typeof state === 'function' ? state.call(this, target) : state;
        for (var key in source) target[key] = source[key];
        this.render();
      }}
      // the render must be defined when extending hyper.Component
      // the render **must** return either comp.html or comp.svg wire
      // render() { return this.html`<p>that's it</p>`; }
    }
  );

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
  var EXPANDO = '_hyper: ';
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
  function render(template) {
    var hyper = hypers.get(this);
    if (
      !hyper ||
      hyper.template !== TL(template)
    ) {
      upgrade.apply(this, arguments);
    } else {
      update.apply(hyper.updates, arguments);
    }
    return this;
  }

  // `<div class="${'attr'}"></div>`
  // `<div onclick="${function () {... }}"></div>`
  // `<div onclick="${{handleEvent(){ ... }}}"></div>`
  // `<div contenteditable="${true}"></div>`
  function setAttribute(attribute, removeAttributes, name) {
    var
      node = attribute.ownerElement,
      isData = name === 'data',
      isEvent = !isData && /^on/.test(name),
      isSpecial = isData ||
                  (isSpecialAttribute(node, name) &&
                  !SHOULD_USE_ATTRIBUTE.test(name)),
      type = isEvent ? name.slice(2) : '',
      noOwner = isSpecial || isEvent,
      wontUpgrade = isSpecial && (isData || name in node),
      oldValue
    ;
    if (isEvent || wontUpgrade) {
      removeAttributes.push(node, name);
      if (isEvent) {
        if (name.toLowerCase() in node) {
          type = type.toLowerCase();
        }
      }
    }
    function specialAttr(newValue) {
      if (oldValue !== newValue) {
        oldValue = newValue;
        // WebKit moves the cursor if input.value
        // is set again, even if same value
        if (node[name] !== newValue) {
          // let the browser handle the case
          // input.value = null;
          // input.value; // ''
          if (newValue == null) {
            // reflect the null intent,
            // do not pass undefined!
            node[name] = null;
            node.removeAttribute(name);
          } else {
            node[name] = newValue;
          }
        }
      }
    }
    function eventAttr(newValue) {
      if (oldValue !== newValue) {
        if (oldValue) node.removeEventListener(type, oldValue, false);
        oldValue = newValue;
        if (newValue) node.addEventListener(type, newValue, false);
      }
    }
    function normalAttr(newValue) {
      if (oldValue !== newValue) {
        oldValue = newValue;
        // avoid triggering again attributeChangeCallback
        // if the value was identical
        if (attribute.value !== newValue) {
          if (newValue == null) {
            if (!noOwner) {
              // TODO: should attribute.value = null here?
              noOwner = true;
              node.removeAttributeNode(attribute);
            }
          } else {
            attribute.value = newValue;
            if (noOwner) {
              noOwner = false;
              node.setAttributeNode(attribute);
            }
          }
        }
      }
    }
    return isEvent
      ? eventAttr
      : isSpecial
        ? specialAttr
        : normalAttr;
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
      switch (typeof value) {
        case 'string':
        case 'number':
        case 'boolean':
          var length = childNodes.length;
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
          } else if (value instanceof Component) {
            value = value.render();
          }
        default:
          oldValue = value;
          if (isArray(value)) {
            var length = value.length;
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
                  } else {
                    for (var i = 0, length = value.length; i < length; i++) {
                      if (value[i] instanceof Component) {
                        value[i] = value[i].render();
                      }
                    }
                  }
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
          } else if ('subscribe' in value) {
            value.subscribe(anyContent)
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
  function attributesSeeker(node, paths, parts) {
    for (var
      name, realName, attrs,
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
          realName = parts.shift().replace(/^(?:|[\S\s]*?\s)(\S+?)=['"]?$/, '$1');
          attrs = node.attributes;
          // fallback is needed in both jsdom
          // and in not-so-standard browsers/engines
          cache[name] = attrs[realName] || attrs[realName.toLowerCase()];
          paths.push(Path('attr', cache[name], realName));
        }
      }
    }
  }

  // walk the fragment tree in search of comments
  function hyperSeeker(node, paths, parts) {
    for (var
      child,
      childNodes = node.childNodes,
      length = childNodes.length,
      i = 0; i < length; i++
    ) {
      child = childNodes[i];
      switch (child.nodeType) {
        case ELEMENT_NODE:
          attributesSeeker(child, paths, parts);
          hyperSeeker(child, paths, parts);
          break;
        case COMMENT_NODE:
          if (child.textContent === UID) {
            parts.shift();
            paths.push(Path('any', child));
          }
          break;
        case TEXT_NODE:
          if (
            SHOULD_USE_TEXT_CONTENT.test(node.nodeName) &&
            trim.call(child.textContent) === UIDC
          ) {
            parts.shift();
            paths.push(Path('text', node));
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
  var slice = [].slice;

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
  function createContent(node) {
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
    )(node, html.replace(no, comments));
  }

  // create fragment for HTML
  function createHTMLFragment(node, html) {
    var fragment;
    var document = node.ownerDocument;
    var container = document.createElement(
      // TODO: this is a work around for A-Frame V0 based components
      //       see: https://stackoverflow.com/questions/46797635/aframe-content-not-rendering-on-chrome-with-hyperhtml/46817370
      /<(a-\w+)[\s\S]*?>[\s\S]*?<\/\1>/.test(html) ?
        'div' : 'template'
    );
    var hasContent = 'content' in container;
    var needsTableWrap = false;
    if (!hasContent) {
      // DO NOT MOVE THE FOLLOWING LINE ELSEWHERE
      fragment = createDocumentFragment(document);
      // (a jsdom + nodejs tests coverage gotcha)

      // el.innerHTML = '<td></td>'; is not possible
      // if the content is a partial internal table content
      // it needs to be wrapped around once injected.
      // HTMLTemplateElement does not suffer this issue.
      needsTableWrap = /^[^\S]*?<(col(?:group)?|t(?:head|body|foot|r|d|h))/i.test(html);
    }
    if (needsTableWrap) {
      // secure the RegExp.$1 result ASAP to avoid issues
      // in case a non-browser DOM library uses RegExp internally
      // when HTML content is injected (basicHTML / jsdom / others...)
      var selector = RegExp.$1;
      container.innerHTML = '<table>' + html + '</table>';
      appendNodes(fragment, slice.call(container.querySelectorAll(selector)));
    } else {
      container.innerHTML = html;
      if (hasContent) {
        fragment = container.content;
      } else {
        appendNodes(fragment, slice.call(container.childNodes));
      }
    }
    return fragment;
  }

  // create a fragment for SVG
  function createSVGFragment(node, html) {
    var document = node.ownerDocument;
    var fragment = createDocumentFragment(document);
    if (IE || WK) {
      var container = document.createElement('div');
      container.innerHTML = '<svg xmlns="' + SVG_NAMESPACE + '">' + html + '</svg>';
      appendNodes(fragment, slice.call(container.firstChild.childNodes));
    } else {
      var container = document.createElementNS(SVG_NAMESPACE, 'svg');
      container.innerHTML = html;
      appendNodes(fragment, slice.call(container.childNodes));
    }
    return fragment;
  }

  // given a node, it does what is says
  function createText(node, text) {
    return node.ownerDocument.createTextNode(text);
  }

  // returns current customElements reference
  // compatible with basicHTML too
  function getCEClass(node) {
    var doc = hyper.document;
    var ce = doc.customElements || doc.defaultView.customElements;
    return ce && ce.get(node.nodeName.toLowerCase());
  }

  // verify that an attribute has
  // a special meaning for the node
  function isSpecialAttribute(node, name) {
    var notSVG = !(OWNER_SVG_ELEMENT in node);
    if (notSVG && /-/.test(node.nodeName)) {
      var Class = getCEClass(node);
      if (Class) node = Class.prototype;
    }
    return notSVG && name in node;
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

  // return a descriptor that lazily initialize a property
  // unless it hasn't be previously set directly
  function lazyGetter(type, fn) {
    var secret = '_' + type + '$';
    return {
      get: function () {
        return this[secret] || (this[type] = fn.call(this, type));
      },
      set: function (value) {
        defineProperty(this, secret, {configurable: true, value: value});
      }
    };
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

  // remove a list of [node, attribute]
  function removeAttributeList(list) {
    for (var i = 0, length = list.length; i < length; i++) {
      list[i++].removeAttribute(list[i]);
    }
  }

  // specify the content to update
  function setContent(info, target, removeAttributes, childNodes) {
    var update;
    switch (info.type) {
      case 'any':
        // TODO: don't pass the target, it shouldn't be needed
        update = setAnyContent(target, childNodes, new Aura(target, childNodes));
        break;
      case 'attr':
        update = setAttribute(target, removeAttributes, info.name);
        break;
      case 'text':
        update = setTextContent(target);
        break;
    }
    return update;
  }

  // used for common path creation.
  function Path(type, node, name) {
    return {type: type, path: createPath(node), name: name};
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

  // recycled defineProperty shortcut
  var defineProperty = Object.defineProperty;

  // transformers registry
  var transformers = {};
  var transformersKeys = [];

  // normalize Firefox issue with template literals
  var templateObjects = {}, unique;
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

  // sanitizes interpolations as comments
  var attrName = '[^\\S]+[^ \\f\\n\\r\\t\\/>"\'=]+';
  var no = new RegExp('(<[a-z]+[a-z0-9:_-]*)((?:' + attrName + '(?:=(?:\'.*?\'|".*?"|<.+?>|\\S+))?)+)([^\\S]*\/?>)', 'gi');
  var findAttributes = new RegExp('(' + attrName + '=)([\'"]?)' + UIDC + '\\2', 'gi');
  var comments = function ($0, $1, $2, $3) {
    return $1 + $2.replace(findAttributes, replaceAttributes) + $3;
  };

  var replaceAttributes = function ($0, $1, $2) {
    return $1 + ($2 || '"') + UID + ($2 || '"');
  };

  // [element] = {template, updates};
  var hypers = new $WeakMap;

  // [element] = {template, updates};
  var wires = new $WeakMap;

  // [template] = {fragment, paths};
  var templates = new $Map;

  // internal signal to switch adoption
  var notAdopting = true;

  // IE 11 has problems with cloning templates too
  // it "forgets" empty childNodes
  var cloneNode = (function () {
    featureFragment.appendChild(createText(featureFragment, 'g'));
    featureFragment.appendChild(createText(featureFragment, ''));
    return featureFragment.cloneNode(true).childNodes.length === 1 ?
      function (node) {
        for (var
          clone = node.cloneNode(),
          childNodes = node.childNodes || [],
          i = 0, length = childNodes.length;
          i < length; i++
        ) {
          clone.appendChild(cloneNode(childNodes[i]));
        }
        return clone;
      } :
      function (fragment) {
        return fragment.cloneNode(true);
      };
  }());

  // ---------------------------------------------
  // Adopting Nodes
  // ---------------------------------------------

  // IE/Edge gotcha with comment nodes
  var nextElementSibling = IE ?
    function (node) {
      while (node = node.nextSibling) {
        if (node.nodeType === ELEMENT_NODE) return node;
      }
      return undefined;
    } :
    function (node) { return node.nextElementSibling; };

  var previousElementSibling = IE ?
    function (node) {
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
      i < length; i++
    ) {
      switch (path[i++]) {
        case 'attributes':
          var name = virtualNode.name;
          if (!parentNode.hasAttribute(name)) {
            parentNode.setAttribute(name, '');
          }
          target = parentNode.attributes[name];
          break;
        case 'childNodes':
          var children = getChildren(parentNode);
          var virtualChildren = getChildren(virtualNode.parentNode);
          target = previousElementSibling(virtualNode);
          var before = target ? (path.indexOf.call(virtualChildren, target) + 1) : -1;
          target = nextElementSibling(virtualNode);
          var after = target ? path.indexOf.call(virtualChildren, target) : -1;
          target = document.createComment(UID);
          switch (true) {
            // `${'virtual'}` is actually resolved as `${'any'}`
            // case before < 0 && after < 0: before = 0;

            // `</a>${'virtual'}`
            case after < 0:
              after = children.length;
              break;
            // `${'virtual'}<b>`
            case before < 0:
              before = 0;
            // `</a>${'virtual'}<b>`
            default:
              after = -(virtualChildren.length - after);
              break;
          }
          childNodes.push.apply(
            childNodes,
            slice.call(children, before, after)
          );
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
        default:
          // if the node is not there, create it
          target = getChildren(parentNode)[path[i]] ||
                    parentNode.appendChild(
                      parentNode.ownerDocument.createElement(
                        getNode(virtual, path.slice(0, i + 1)).nodeName
                      )
                    );
          parentNode = target;
          break;
      }
    }
    return target;
  }

  // like createUpdates but for nodes with already a content
  function discoverUpdates(fragment, paths) {
    for (var
      info, childNodes,
      updates = [],
      removeAttributes = [],
      i = 0, length = paths.length;
      i < length; i++
    ) {
      childNodes = [];
      info = paths[i];
      updates[i] = setContent(
        info,
        discoverNode(this, fragment, info, childNodes),
        removeAttributes,
        childNodes
      );
    }
    removeAttributeList(removeAttributes);
    return updates;
  }

  // ---------------------------------------------
  // Template related utilities
  // ---------------------------------------------

  // given a unique template object
  // create, parse, and store retrieved info
  function createTemplate(template) {
    var paths = [];
    var fragment = createFragment(this, template.join(UIDC));
    var info = {fragment: fragment, paths: paths};
    hyperSeeker(fragment, paths, template.slice());
    templates.set(template, info);
    return info;
  }

  // given a generic node, returns a path capable
  // of retrieving such path back again.
  // TODO: worth passing the index when available ?
  function createPath(node) {
    var path = [];
    var parentNode;
    switch(node.nodeType) {
      case ELEMENT_NODE:
      case DOCUMENT_FRAGMENT_NODE:
        parentNode = node;
        break;
      case COMMENT_NODE:
        parentNode = node.parentNode;
        path.unshift(
          'childNodes',
          path.indexOf.call(parentNode.childNodes, node)
        );
        break;
      case ATTRIBUTE_NODE:
      default: // jsdom here does not provide a nodeType 2 ...
        parentNode = node.ownerElement;
        path.unshift('attributes', node.name);
        break;
    }
    for (
      node = parentNode;
      parentNode = parentNode.parentNode;
      node = parentNode
    ) {
      path.unshift('children', path.indexOf.call(getChildren(parentNode), node));
    }
    return path;
  }

  // given a root node and a list of paths
  // creates an array of updates to invoke
  // whenever the next interpolation happens
  function createUpdates(fragment, paths) {
    for (var
      info,
      updates = [],
      removeAttributes = [],
      i = 0, length = paths.length;
      i < length; i++
    ) {
      info = paths[i];
      updates[i] = setContent(
        info,
        getNode(fragment, info.path),
        removeAttributes,
        []
      );
    }
    removeAttributeList(removeAttributes);
    return updates;
  }

  // invokes each update function passing interpolated value
  function update() {
    for (var i = 1, length = arguments.length; i < length; i++) {
      this[i - 1](arguments[i]);
    }
  }

  // create a template, if unknown
  // upgrade a node to use such template for future updates
  function upgrade(template) {
    template = TL(template);
    var updates;
    var info =  templates.get(template) ||
                createTemplate.call(this, template);
    if (notAdopting) {
      var fragment = cloneNode(info.fragment);
      updates = createUpdates.call(this, fragment, info.paths);
      hypers.set(this, {template: template, updates: updates});
      update.apply(updates, arguments);
      this.textContent = '';
      this.appendChild(fragment);
    } else {
      updates = discoverUpdates.call(this, info.fragment, info.paths);
      hypers.set(this, {template: template, updates: updates});
      update.apply(updates, arguments);
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
        content = createContent(fragment);
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