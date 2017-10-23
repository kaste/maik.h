/* eslint semi: [1, 'never'] */
/* global chai */

import {bind} from '../src/hyperhtml.js'

const {assert} = chai

describe('phyper', () => {

  let div

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
  })

  afterEach(() => {
    document.body.removeChild(div)
  })

  it('renders static html', () => {
    let render = bind(div)
    render`<p>Hello World!</p>`

    assert.equal(`<p>Hello World!</p>`, div.innerHTML)
  })

  it('renders a number', () => {
    let render = bind(div)
    render`<p>${123}</p>`
    matchInnerHTML(`<p>${123}</p>`, div)
  })

  it('renders a string', () => {
    let render = bind(div)
    render`<p>${'bar'}</p>`
    matchInnerHTML(`<p>${'bar'}</p>`, div)
  })

  it('renders `undefined` as empty string', () => {
    let render = bind(div)
    render`<p>${undefined}</p>`
    matchInnerHTML(`<p></p>`, div)
  })

  it('renders `null` as empty string', () => {
    let render = bind(div)
    render`<p>${null}</p>`
    matchInnerHTML(`<p></p>`, div)
  })

  it('resists XSS by escaping html', () => {
    let render = bind(div)
    render`<p>${'<script>alert("boom");</script>'}</p>`
    matchInnerHTML(`<p>&lt;script&gt;alert("boom");&lt;/script&gt;</p>`, div)
  })

  it('renders raw html if explicitly told', () => {
    let render = bind(div)
    render`<p>${{html: '<em>foo</em>'}}</p>`
    matchInnerHTML(`<p>${'<em>foo</em>'}</p>`, div)
  })
})


const matchInnerHTML = (string, html) => {
  let container = html.cloneNode(true)
  removeComments(container)
  assert.equal(string, container.innerHTML)
}

const removeComments = (node) => {
  let walker = document.createTreeWalker(node, NodeFilter.SHOW_COMMENT)
  let commentNodes = []

  while (walker.nextNode()) {
    commentNodes.push(walker.currentNode)
  }

  for (let n of commentNodes) {
    n.parentNode.removeChild(n)
  }
}