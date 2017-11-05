/* global chai */

import { wireHtml, wireSvg, bind } from '../src/hyperhtml.js'
import { matchInnerHTML } from './utils.js'

const { assert } = chai

describe('new wire', () => {
  it('every call to wire() gives us new nodes', () => {
    function Title(title) {
      return wireHtml()`<h1>${title}</h1>`
    }

    let t1 = Title('Hello')
    let t2 = Title('World!')

    assert.notEqual(t1, t2)
  })

  it('reusing a wire updates nodes', () => {
    let render = wireHtml()
    function Title(title) {
      return render`<h1>${title}</h1>`
    }

    let t1 = Title('Hello')
    let t2 = Title('World!')

    assert.equal(t1, t2)
  })

  describe('wire svg', () => {
    it('works?', () => {
      let line = wireSvg()`<line y1="1" y2="1"/>`

      assert.equal(line.tagName, 'line')
      assert.equal(line.namespaceURI, 'http://www.w3.org/2000/svg')
    })
  })

  describe('bind svg', () => {
    let svg

    beforeEach(() => {
      svg = document.createElement('svg')
      document.body.appendChild(svg)
    })

    afterEach(() => {
      document.body.removeChild(svg)
    })

    it('works?', () => {
      let render = bind(svg)
      render`<line y1="1" y2="1"/>`

      matchInnerHTML(`<line y1="1" y2="1"></line>`, svg)
    })
  })
})
