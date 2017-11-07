/* global chai */

import { bind, html, materialize, keyed } from '../src/hyperhtml.js'
import { matchInnerHTML } from './utils.js'

const { assert } = chai

describe('html tag', () => {
  let div

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
  })

  afterEach(() => {
    document.body.removeChild(div)
  })

  it('can be materialized', () => {
    let greeting = html`Hello friend!`
    let $text = materialize(greeting)

    assert.equal('Hello friend!', $text.textContent)
  })

  it('can be rendered', () => {
    let greeting = html`Hello friend!`
    let render = bind(div)
    render`${greeting}`

    matchInnerHTML(`Hello friend!`, div)
  })

  it('can render two of the same', () => {
    let greeting = (name = 'friend') => html`<p>Hello ${name}!</p>`
    let render = bind(div)
    render`${greeting()}${greeting()}`

    matchInnerHTML(
      `<p>Hello ${'friend'}!</p><p>Hello ${'friend'}!</p>`,
      div
    )
    let p = div.firstElementChild
    render`${greeting('you')}${greeting()}`
    matchInnerHTML(`<p>Hello ${'you'}!</p><p>Hello ${'friend'}!</p>`, div)
    assert.equal(p, div.firstElementChild)
  })

  it('can render an array', () => {
    let greeting = (name = 'friend') => html`<p>Hello ${name}!</p>`
    let friends = ['Tom', 'Bartels']
    let render = bind(div)
    render`${friends.map(greeting)}`
    let p = div.firstElementChild

    matchInnerHTML(`<p>Hello Tom!</p><p>Hello Bartels!</p>`, div)
    friends = ['Henry', 'Bartels']
    render`${friends.map(greeting)}`

    matchInnerHTML(`<p>Hello Henry!</p><p>Hello Bartels!</p>`, div)
    assert.equal(p, div.firstElementChild)
  })

  it('render supports keys for efficient updates (1 - using `html(key)`)', () => {
    let friends = ['Tom', 'Bartels']
    let render = bind(div)
    render`${friends.map(name => html(name)`<p>Hello ${name}!</p>`)}`
    matchInnerHTML(`<p>Hello Tom!</p><p>Hello Bartels!</p>`, div)
    let $tom = div.firstElementChild
    let $bartels = div.lastElementChild

    friends = ['Bartels', 'Tom']
    render`${friends.map(name => html(name)`<p>Hello ${name}!</p>`)}`
    matchInnerHTML(`<p>Hello Bartels!</p><p>Hello Tom!</p>`, div)
    assert.equal($tom, div.lastElementChild)
    assert.equal($bartels, div.firstElementChild)
  })

  it('render supports keys for efficient updates (2 - using `keyed`)', () => {
    let friends = ['Tom', 'Bartels']
    let render = bind(div)
    render`${friends.map(name => keyed(name, html`<p>Hello ${name}!</p>`))}`
    matchInnerHTML(`<p>Hello Tom!</p><p>Hello Bartels!</p>`, div)
    let $tom = div.firstElementChild
    let $bartels = div.lastElementChild

    friends = ['Bartels', 'Tom']
    render`${friends.map(name => keyed(name, html`<p>Hello ${name}!</p>`))}`
    matchInnerHTML(`<p>Hello Bartels!</p><p>Hello Tom!</p>`, div)
    assert.equal($tom, div.lastElementChild)
    assert.equal($bartels, div.firstElementChild)
  })
})
