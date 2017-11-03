import { createFragment, getChildren } from './dom-utils.js'
import { indexOf, trim } from './utils.js'

const EXPANDO = '_hyper_'
const UID = EXPANDO + ((Math.random() * new Date()) | 0) + ';'
const UIDC = '<!--' + UID + '-->'

const ELEMENT_NODE = 1
const TEXT_NODE = 3
const COMMENT_NODE = 8

const SHOULD_USE_TEXT_CONTENT = /^style|textarea$/i

/*
  Given the unique static strings of a template-tag invocation,
  create a blueprint fragment and notes about its dynamic parts
  which we can use over and over for new instances of this (template)
  fragment.
 */
export function createTemplateBlueprint(strings, contextNode) {
  let html = getHTML(strings)
  let fragment = createFragment(contextNode, html)
  return processFragment(strings, fragment)
}

/*
  The functions `findTagClose` and `getHTML` originally come from the
  lit-html PR https://github.com/PolymerLabs/lit-html/pull/153
  authored by https://github.com/jridgewell

  Slightly modified to actually work.
 */

/*
  Finds the closing index of the last closed HTML tag.
  This has 3 possible return values:
    - `-1`, meaning there is no tag in str.
    - `string.length`, meaning the last opened tag is unclosed.
    - Some positive number < str.length, meaning the index of the closing '>'.
 */
function findTagClose(str) {
  const close = str.lastIndexOf('>')
  const open = str.indexOf('<', close + 1)
  return open > -1 ? str.length : close
}

const textMarker = UIDC
const attributeMarker = UID

const getHTML = strings => {
  const l = strings.length
  let html = ''
  let isTextBinding = true
  for (let i = 0; i < l - 1; i++) {
    const s = strings[i]
    html += s
    // We're in a text position if the previous string closed its tags.
    // If it doesn't have any tags, then we use the previous text position
    // state.
    const closing = findTagClose(s)
    isTextBinding = closing > -1 ? closing < s.length : isTextBinding
    html += isTextBinding ? textMarker : attributeMarker
  }
  html += strings[l - 1]
  return html
}

/*
  `processFragment` is generally a destructive thing. We walk the
  initial fragment, remove all the attributes for which the user wants to
  fill in values (in short: the dynamic attributes), and take notes about
  every dynamic 'hole' we find.
 */
const processFragment = (strings, fragment) => {
  let notes = []
  hyperSeeker(fragment, notes, strings.slice()) // mutate alert
  // Return the mutated fragment and notes about each 'hole'
  return { fragment, notes }
}

// walk the fragment tree in search of comments
function hyperSeeker(node, notes, strings) {
  for (
    var child,
      childNodes = node.childNodes,
      length = childNodes.length,
      i = 0;
    i < length;
    i++
  ) {
    child = childNodes[i]
    switch (child.nodeType) {
      case ELEMENT_NODE:
        attributesSeeker(child, notes, strings)
        hyperSeeker(child, notes, strings)
        break
      case COMMENT_NODE:
        if (child.textContent === UID) {
          strings.shift()
          notes.push(createNote('node', child))
        }
        break
      case TEXT_NODE:
        if (
          SHOULD_USE_TEXT_CONTENT.test(node.nodeName) &&
          trim.call(child.textContent) === UIDC
        ) {
          strings.shift()
          notes.push(createNote('text', node))
        }
        break
    }
  }
}

// look for attributes that contains the comment text
function attributesSeeker(node, notes, strings) {
  let foundAttributes = []
  for (
    var name,
      realName,
      attrs,
      attr,
      attribute,
      cache = Object.create(null),
      attributes = node.attributes,
      i = 0,
      length = attributes.length;
    i < length;
    i++
  ) {
    attribute = attributes[i]
    if (attribute.value === UID) {
      name = attribute.name
      // this is an IE < 11 thing only
      if (name in cache) {
        // attributes with unrecognized values
        // are duplicated, even if same attribute, across the node
        // to fix it, you need to remove it
        node.removeAttributeNode(attribute)
        // put a value that won't (hopefully) bother IE
        cache[name].value = ''
        // and place the node back
        node.setAttributeNode(cache[name])
        // this will decrease attributes count by 1
        length--
        // so the loop should be decreased by 1 too
        i--
      } else {
        realName = strings
          .shift()
          .replace(/^(?:|[\S\s]*?\s)(\S+?)=['"]?$/, '$1')
        attrs = node.attributes
        // fallback is needed in both jsdom
        // and in not-so-standard browsers/engines
        attr = cache[name] =
          attrs[realName] || attrs[realName.toLowerCase()]
        foundAttributes.push(attr)
        notes.push(createNote('attr', node, realName))
      }
    }
  }
  for (let i = 0, l = foundAttributes.length, attr; i < l; i++) {
    attr = foundAttributes[i]
    node.removeAttributeNode(attr)
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
  let path = createPath(node)
  return { type, path, name }
}

// given a generic node, returns a path capable
// of retrieving such path back again.
// TODO: worth passing the index when available ?
function createPath(node) {
  let path = []
  let parentNode

  if (node.nodeType === COMMENT_NODE) {
    parentNode = node.parentNode
    path.unshift('childNodes', indexOf.call(parentNode.childNodes, node))
    node = parentNode
  }

  while ((parentNode = node.parentNode)) {
    path.unshift('children', indexOf.call(getChildren(parentNode), node))
    node = parentNode
  }
  return path
}
