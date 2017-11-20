import { createFragment, getChildren } from './dom-utils.js'
import { indexOf } from './utils.js'

const EXPANDO = '_hyper_'
const UID = EXPANDO + ((Math.random() * new Date()) | 0) + ';'
const UIDC = '<!--' + UID + '-->'

const ELEMENT_NODE = 1
const ATTRIBUTE_NODE = 2
const TEXT_NODE = 3
const COMMENT_NODE = 8

// eslint-disable-next-line no-control-regex
const EXTRACT_ATTRIBUTE_NAME = /\s([^\0-\x1F\x7F-\x9F \x09\x0a\x0c\x0d"'>=/]+)[ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*['"]?$/

/*
  Given the unique static strings of a template-tag invocation,
  create a blueprint fragment and notes about its dynamic parts
  which we can use over and over for new instances of this (template)
  fragment.
 */
export function createTemplateBlueprint(strings, document, isSvg) {
  let { html, notes } = getHTML(strings)
  let fragment = createFragment(document, isSvg, html)
  return processFragment(notes, fragment)
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

const getHTML = (strings, nodeMarker = UIDC, attributeMarker = UID) => {
  const last = strings.length - 1
  let html = ''
  let notes = []

  let isTextBinding = true
  for (let i = 0; i < last; i++) {
    const s = strings[i]
    html += s
    // We're in a text position if the previous string closed its tags.
    // If it doesn't have any tags, then we use the previous text position
    // state.
    const closing = findTagClose(s)
    isTextBinding = closing > -1 ? closing < s.length : isTextBinding
    if (isTextBinding) {
      html += nodeMarker
      notes.push({ type: ELEMENT_NODE })
    } else {
      html += attributeMarker
      // In general attributes are stored in `node.attributes` as a map, which
      // means they're unordered. But user's `strings` is ordered and we MUST
      // retain this order. For now, we unfortunately extract the wanted
      // attributeName from the current string (s).
      let name = extractAttributeName(s)
      notes.push({ type: ATTRIBUTE_NODE, name })
    }
  }
  html += strings[last]
  return { html, notes }
}

const extractAttributeName = string => {
  let match = EXTRACT_ATTRIBUTE_NAME.exec(string)
  if (!match) {
    throw new Error(
      `Could not get the attribute name within the following String '${string}'`
    )
  }

  return match[1]
}

const processFragment = (
  firstNotes,
  fragment,
  nodeMarker = UIDC,
  marker = UID
) => {
  let notes = []
  let walker = domWalker(fragment, nodeMarker, marker)
  let foundAttributes = []

  for (let i = 0, l = firstNotes.length; i < l; i++) {
    let earlyNote = firstNotes[i]
    let typeHint = earlyNote.type
    let node = walker.next(typeHint)
    if (node) {
      switch (node.nodeType) {
        case ATTRIBUTE_NODE: {
          notes.push(createNote('attr', node.ownerElement, earlyNote.name))
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

const domWalker = (node, nodeMarker, marker) => {
  let stack = [{ nodes: node.childNodes, index: 0 }]
  let frame

  return {
    next: typeHint => {
      while ((frame = stack[stack.length - 1])) {
        FOR_LOOP: {
          let { nodes, index: i, cache } = frame
          for (let l = nodes.length; i < l; i++) {
            let node = nodes[i]

            switch (node.nodeType) {
              case ATTRIBUTE_NODE:
                if (typeHint !== ATTRIBUTE_NODE) {
                  stack.pop()
                  break FOR_LOOP
                }
                if (node.value === marker) {
                  let name = node.name
                  // According to @WebReflection IE < 11 sometimes has
                  // duplicate attributes. So we cache each name we already
                  // found to fast skip.
                  if (name in cache) {
                    continue
                  }
                  cache[name] = true

                  frame.index = ++i
                  return node
                }
                continue

              case ELEMENT_NODE:
                stack.push({ nodes: node.childNodes, index: 0 })
                if (typeHint === ATTRIBUTE_NODE && node.hasAttributes()) {
                  stack.push({
                    nodes: node.attributes,
                    index: 0,
                    cache: Object.create(null)
                  })
                }

                frame.index = ++i
                break FOR_LOOP

              case COMMENT_NODE:
                if (node.nodeValue === marker) {
                  frame.index = ++i
                  return node
                }
                continue

              case TEXT_NODE:
                // Seeing a TEXT_NODE here means that the browser could
                // actually NOT add a comment node at that particular position.
                if (node.nodeValue.indexOf(nodeMarker) > -1) {
                  frame.index = ++i
                  return node
                }
                continue
            }
          }
          stack.pop()
        }
      }
    }
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
