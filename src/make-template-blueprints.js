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
export function createTemplateBlueprint(strings, document, isSvg) {
  let html = getHTML(strings)
  let fragment = createFragment(document, isSvg, html)
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
// const processFragment = (strings, fragment) => {
//   let notes = []
//   hyperSeeker(fragment, notes, strings.slice()) // mutate alert
//   // Return the mutated fragment and notes about each 'hole'
//   return { fragment, notes }
// }

const ATTRIBUTE_NODE = 2

const processFragment = (strings, fragment) => {
  let notes = []
  let walker = domWalker(fragment)
  let foundAttributes = []

  for (let i = 0, l = strings.length - 1; i < l; i++) {
    let node = walker.next()
    if (node) {
      switch (node.nodeType) {
        case ATTRIBUTE_NODE: {
          let stringPart = strings[i]
          let match = EXTRACT_ATTRIBUTE_NAME.exec(stringPart)
          if (!match) {
            throw new Error(
              `Could not get the attribute name within the following String '${stringPart}'`
            )
          }

          let attributeName = match[1]
          notes.push(createNote('attr', node.ownerElement, attributeName))
          foundAttributes.push(node)
          break
        }
        case COMMENT_NODE:
          notes.push(createNote('node', node))
          break
        case TEXT_NODE:
          notes.push(createNote('text', node.parentNode))
          break
      }
    }
  }

  for (let i = 0, l = foundAttributes.length; i < l; i++) {
    let attribute = foundAttributes[i]
    let node = attribute.ownerElement
    node.removeAttributeNode(attribute)
  }

  return { fragment, notes }
}

const domWalker = (node, nodeMarker = UIDC, attrOrTextMarker = UID) => {
  let stack = [{ nodes: node.childNodes, index: 0 }]
  // According to @WebReflection IE < 11 sometimes has duplicate
  // attributes. So we cache each name we already found to fast skip.
  let attributesCache = Object.create(null)

  return {
    next: typeHint => {
      let frame
      while ((frame = stack[stack.length - 1])) {
        let { nodes, index: i } = frame
        TOP: {
          for (let l = nodes.length; i < l; i++) {
            let node = nodes[i]

            switch (node.nodeType) {
              case ATTRIBUTE_NODE:
                if (node.value === attrOrTextMarker) {
                  let name = node.name
                  if (name in attributesCache) {
                    continue
                  }
                  attributesCache[name] = true

                  frame.index = ++i
                  return node
                }
                continue
              case ELEMENT_NODE:
                stack.push({ nodes: node.childNodes, index: 0 })
                if (node.hasAttributes()) {
                  attributesCache = Object.create(null)
                  stack.push({ nodes: node.attributes, index: 0 })
                }
                frame.index = ++i
                break TOP
              case COMMENT_NODE:
                if (node.nodeValue === attrOrTextMarker) {
                  frame.index = ++i
                  return node
                }
                break
              case TEXT_NODE:
                // Seeing a TEXT_NODE here means that the browser could
                // actually NOT add a comment node at that particular position.
                if (node.nodeValue.indexOf(nodeMarker) > -1) {
                  frame.index = ++i
                  return node
                }
                break
            }
          }
          stack.pop()
        }
      }
    }
  }
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

// eslint-disable-next-line no-control-regex
const EXTRACT_ATTRIBUTE_NAME = /\s([^\0-\x1F\x7F-\x9F \x09\x0a\x0c\x0d"'>=/]+)[ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*['"]?$/

// look for attributes that contains the comment text
function attributesSeeker(node, notes, strings) {
  // Be warned: This is optimized, so that we only loop once over attributes.
  // In general `NamedNodeMap` is as the name suggest an unordered map, but we
  // can iterate over it just like an array anyway. The effect is that the
  // 'order' in attributes does not have to match the order in `strings`.
  // Now, the normal strategy would be: Iterate over attributes, and just
  // *count* how many attribute parts (placeholders) we find. Then take that
  // many parts from strings, process em, and create notes for each.
  // E.g.
  // count = attributes.filter(attr => attr.value === UID).length
  // notes = strings.slice(0, count).map(...createNode)

  let foundAttributes = []
  let cache = Object.create(null)
  let attributes = node.attributes
  for (let i = 0, length = attributes.length; i < length; i++) {
    let attribute = attributes[i]
    if (attribute.value === UID) {
      let name = attribute.name
      // According to @WebReflection IE < 11 sometimes has duplicate
      // attributes. So we cache each name we already found, and fast skip.
      if (name in cache) {
        continue
      }
      cache[name] = true
      foundAttributes.push(attribute)

      // For each matching attribute, we just pull one item from `strings`.
      // This `item` must not represent the same attribute, so we extract
      // the attributeName manually.
      let prependingString = strings.shift()
      let match = prependingString.match(EXTRACT_ATTRIBUTE_NAME)
      if (!match) {
        throw new Error(
          `Could not get the attribute name within the following String '${prependingString}'`
        )
      }
      let attributeName = match[1]
      notes.push(createNote('attr', node, attributeName))
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
