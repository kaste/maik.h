import { createFragment, createTreeWalker } from './dom-utils.js'
import { UID, UIDC } from './UID.js'

const ELEMENT_NODE = 1
const ATTRIBUTE_NODE = 2
const TEXT_NODE = 3
const COMMENT_NODE = 8

// eslint-disable-next-line no-control-regex
const EXTRACT_ATTRIBUTE_NAME = /\s([^\0-\x1F\x7F-\x9F \x09\x0a\x0c\x0d"'>=/]+)[ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*['"]?$/
const WHITESPACE_NODE_TEST = /^\n\s*$/

/*
  Given the unique static strings of a template-tag invocation,
  create a blueprint fragment and notes about its dynamic parts
  which we can use over and over for new instances of this (template)
  fragment.
 */
export function createTemplateBlueprint(
  nodeCallback,
  attributeCallback,
  strings,
  document,
  isSvg
) {
  let { html, notes } = processStrings(
    strings,
    nodeCallback,
    attributeCallback
  )
  let fragment = createFragment(document, isSvg, html)
  return processFragment(notes, fragment)
}

/*
  The functions `findTagClose` and `processStrings` originally come from the
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

// In general, walk the static strings the user gave us, and decide which
// 'hole'/interpolation will be on an attribute or is in a node position.
// Prepare the HTML we will actually use as a template. Return the HTML
// and notes about each 'hole' we found.
const processStrings = (
  strings,
  nodeCallback,
  attributeCallback,
  nodeMarker = UIDC,
  attributeMarker = UID
) => {
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
      notes.push({ type: ELEMENT_NODE, updater: nodeCallback })
    } else {
      html += attributeMarker
      // In general attributes are stored in `node.attributes` as a map, which
      // means they're unordered. But user's `strings` is ordered and we MUST
      // retain this order. We therefore extract the wanted attributeName from
      // the current string (`s`).
      let name = extractAttributeName(s)
      notes.push({ type: ATTRIBUTE_NODE, updater: attributeCallback(name) })
    }
  }
  html += strings[last]
  return { html, notes }
}

const extractAttributeName = string => {
  let match = EXTRACT_ATTRIBUTE_NAME.exec(string)
  if (!match) {
    throw new Error(
      `Could not get the attribute name within the following String '${
        string
      }'`
    )
  }

  return match[1]
}

export const processFragment = (
  firstNotes,
  fragment,
  nodeMarker = UIDC,
  marker = UID
) => {
  let notes = []
  let nextNode = domWalker(fragment, nodeMarker, marker)
  // We keep an indexOffset here in case we create text nodes the walker did
  // not count.
  let indexOffset = 0

  // We HAVE to remove each attribute we will find at the end of this fn,
  // otherwise the user would see our markers.
  let foundAttributes = []

  for (let i = 0, l = firstNotes.length; i < l; i++) {
    let earlyNote = firstNotes[i]
    let { type: typeHint, updater } = earlyNote

    let [node, index] = nextNode(typeHint)
    switch (node.nodeType) {
      case ATTRIBUTE_NODE:
        notes.push({ index: index + indexOffset, updater })
        foundAttributes.push(node)
        break
      case COMMENT_NODE:
        notes.push({ index: index + indexOffset, updater })
        break
      case TEXT_NODE: {
        // Whenever we encounter a TEXT_NODE, the browser actually failed at
        // inserting a COMMENT_NODE, because that's what we asked for. This
        // is the case e.g. for <style> tags, which can only have TEXT_NODEs
        // as children.

        // Now let the input be html`<style>a${}b${}c</style>`. The walker
        // sees exactly ONE text node (with {{~}} denoting our marker):
        //   `a{{~}}b${{~}}c`
        // We have to fulfill TWO notes and since the node updater always
        // controls and fills the space BEFORE him, we somehow must end up
        // with three text nodes 'a', 'b' and 'c'; and at the same time push
        // two notes referring to 'b' and 'c'.

        let document = node.ownerDocument
        let parentNode = node.parentNode

        // We split the string into its static parts.
        let value = node.nodeValue
        let parts = value.split(nodeMarker)

        // For all parts except the last one, we create a new text node, and
        // a note
        let last = parts.length - 1
        for (let j = 0; j < last; j++) {
          let textNode = document.createTextNode(parts[j])
          // `insertBefore` to not move the position of the domWalker
          parentNode.insertBefore(textNode, node)

          // Create a note pointing to the *next* node
          indexOffset++
          notes.push({
            index: index + indexOffset,
            updater: earlyNote.updater
          })
          // ATT: We MUST forward the outer for-loop
          earlyNote = firstNotes[++i]
        }

        // Reuse the existing node for the last part.
        node.nodeValue = parts[last]
      }
    }
  }

  // Completely walk the DOM, and remove some whitespace nodes.
  nextNode()

  for (let i = 0, l = foundAttributes.length; i < l; i++) {
    let attribute = foundAttributes[i]
    let node = attribute.ownerElement
    node.removeAttributeNode(attribute)
  }

  return { fragment, notes }
}

// This is like a normal `TreeWalker` but yields only nodes with markers.
// The returned `next` function accepts a `typeHint` for optimization purposes.
// Say, we expect the next node to be a 'node', we can just skip processing
// attributes.
export const domWalker = (node, nodeMarker, marker) => {
  let walker = createTreeWalker(node)
  let index = -1

  let attributes = null
  let attrIndex = 0

  let whitespaceOnlyNodes = []

  return function next(typeHint) {
    while (true) {
      if (attributes && typeHint === ATTRIBUTE_NODE) {
        for (let l = attributes.length; attrIndex < l; attrIndex++) {
          let attr = attributes[attrIndex]
          if (attr.value === marker) {
            // ATT: We MUST increment the for-loop var manually before
            // returning
            attrIndex++
            return [attr, index]
          }
        }

        attributes = null
      }

      WALKER: {
        while (walker.nextNode()) {
          index++
          let node = walker.currentNode

          switch (node.nodeType) {
            case ELEMENT_NODE:
              if (typeHint === ATTRIBUTE_NODE && node.hasAttributes()) {
                attributes = node.attributes
                attrIndex = 0
                break WALKER
              }
              continue
            case COMMENT_NODE:
              if (node.nodeValue === marker) {
                return [node, index]
              }
              continue
            case TEXT_NODE: {
              let nodeValue = node.nodeValue
              if (WHITESPACE_NODE_TEST.test(nodeValue)) {
                index--
                whitespaceOnlyNodes.push(node)
              } else if (nodeValue.indexOf(nodeMarker) !== -1) {
                return [node, index]
              }
              continue
            }
          }
        }

        for (let i = 0, l = whitespaceOnlyNodes.length; i < l; i++) {
          let node = whitespaceOnlyNodes[i]
          node.parentNode.removeChild(node)
        }
        return
      }
    }
  }
}
