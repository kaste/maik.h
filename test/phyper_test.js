/* global chai */

import { bind, wire, adopt } from '../src/hyperhtml.js'
import { matchInnerHTML, xfail } from './utils.js'

const { assert } = chai

describe('bind/render', () => {
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
    matchInnerHTML(
      `<p>&lt;script&gt;alert("boom");&lt;/script&gt;</p>`,
      div
    )
  })

  it('renders raw html if explicitly told', () => {
    let render = bind(div)
    render`<p>${{ html: '<em>foo</em>' }}</p>`
    matchInnerHTML(`<p>${'<em>foo</em>'}</p>`, div)
  })

  it('injects a node in-place', () => {
    let render = bind(div)
    let em = document.createElement('em')
    em.textContent = 'foo'
    render`<p>${em}</p>`
    matchInnerHTML(`<p><em>foo</em></p>`, div)
  })

  context('performance: ', () => {
    it('re-uses the same element on re-render', () => {
      let render = bind(div)
      render`<p>${'foo'}</p>`
      let p = div.querySelector('p')
      let text = p.firstChild
      assert.isOk(p)
      assert.isOk(text)

      render`<p>${'bar'}</p>`
      let newP = div.querySelector('p')
      assert.equal(p, newP)
      assert.equal(text, newP.firstChild)

      matchInnerHTML(`<p>${'bar'}</p>`, div)
    })
  })

  it('leaves whitespace as is', () => {
    let render = bind(div)
    render`<p> ${'foo'} ${'bar'} </p>`
    matchInnerHTML(`<p> foo bar </p>`, div)
  })

  it('handles leading and trailing text', () => {
    let render = bind(div)
    render`${1}<p>${2}</p>${3}<hr>${4}`
    matchInnerHTML(`1<p>2</p>3<hr>4`, div)
  })

  context('edge cases', () => {
    it('can render style tags', () => {
      let render = bind(div)
      render`<style>${1}</style>`
      matchInnerHTML(`<style>1</style>`, div)
    })

    it('can render within textarea tags', () => {
      let render = bind(div)
      render`<textarea>${1}</textarea>`
      matchInnerHTML(`<textarea>1</textarea>`, div)
    })
  })

  context('arrays as values', () => {
    it('renders an array of numbers', () => {
      let render = bind(div)
      render`<p>${[1, 2, 3]}</p>`
      matchInnerHTML(`<p>123</p>`, div)
    })

    it('renders an array of strings', () => {
      let render = bind(div)
      render`<p>${['a', 'b', 'c']}</p>`
      matchInnerHTML(`<p>abc</p>`, div)
    })

    it('resists XSS by escaping html', function() {
      let render = bind(div)
      render`<p>${['<em>a</em>']}</p>`
      xfail(this, () => {
        matchInnerHTML(`<p>${'&lt;em&gt;a&lt;/em&gt;'}</p>`, div)
      })
    })

    // IMO this is the only relevant feature here
    it('injects multiple nodes in-place', () => {
      let render = bind(div)
      let em = document.createElement('em')
      em.textContent = 'foo'
      let em2 = em.cloneNode(true)
      render`<p>${[em, em2]}</p>`
      matchInnerHTML(`<p><em>foo</em><em>foo</em></p>`, div)
    })
  })

  context('attributes', () => {
    it('passes an attribute value', () => {
      let render = bind(div)
      render`<p some-attr$=${'value'}></p>`
      matchInnerHTML(`<p some-attr="value"></p>`, div)
    })

    it('resists XSS attacks', () => {
      let render = bind(div)
      render`<p some-attr$="${'"><script>alert("boo");</script><div foo="'}"></p>`
      matchInnerHTML(
        `<p some-attr="&quot;><script>alert(&quot;boo&quot;);</script><div foo=&quot;"></p>`,
        div
      )
    })

    it('handles `true` as setting the empty string', () => {
      let render = bind(div)
      render`<p hidden$=${true}></p>`
      matchInnerHTML(`<p hidden=""></p>`, div)
      assert.equal(div.firstChild.hidden, true)
    })

    it('handles `false` as remove-the-attribute intent', () => {
      let render = bind(div)
      render`<p hidden$=${false}></p>`
      matchInnerHTML(`<p></p>`, div)
      assert.equal(div.firstChild.hidden, false)
    })

    it('handles `undefined` as remove-the-attribute intent', () => {
      let render = bind(div)
      render`<p hidden$=${undefined}></p>`
      matchInnerHTML(`<p></p>`, div)
      assert.equal(div.firstChild.hidden, false)
    })

    it('handles `null` as remove-the-attribute intent', () => {
      let render = bind(div)
      render`<p hidden$=${null}></p>`
      matchInnerHTML(`<p></p>`, div)
      assert.equal(div.firstChild.hidden, false)
    })
  })

  context('native properties/accessors', () => {
    it('handles `null` as setting the empty string', () => {
      let render = bind(div)
      render`<p align=${null}></p>`
      assert.equal(div.firstChild.align, '')
      matchInnerHTML(`<p align=""></p>`, div)
    })

    it('handles `undefined` as setting the empty string', () => {
      let render = bind(div)
      render`<p align=${undefined}></p>`
      assert.equal(div.firstChild.align, '')
      matchInnerHTML(`<p align=""></p>`, div)
    })
  })

  context('handling events', () => {
    it('adds an event listener', done => {
      let render = bind(div)
      const handler = ev => {
        done()
      }
      render`<p onclick=${handler}></p>`
      let p = div.firstChild
      let event = document.createEvent('Event')
      event.initEvent('click', false, false)
      p.dispatchEvent(event)
    })

    it('removes an event listener', () => {
      let render = bind(div)
      const handler = ev => {
        assert.fail()
      }
      render`<p onclick=${handler}></p>`
      let p = div.firstChild
      render`<p onclick=${null}></p>`

      let event = document.createEvent('Event')
      event.initEvent('click', false, false)
      p.dispatchEvent(event)
    })
  })
})

describe('wire', () => {
  it('every call to wire() gives us new nodes', () => {
    function Title(title) {
      return wire()`<h1>${title}</h1>`
    }

    let t1 = Title('Hello')
    let t2 = Title('World!')

    assert.notEqual(t1, t2)
  })

  it('reusing a wire updates nodes', () => {
    let render = wire()
    function Title(title) {
      return render`<h1>${title}</h1>`
    }

    let t1 = Title('Hello')
    let t2 = Title('World!')

    assert.equal(t1, t2)
  })
})

describe('bugs', () => {
  let div

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
  })

  afterEach(() => {
    document.body.removeChild(div)
  })

  it('correctly imports nodes so that custom elements v0 upgrade', () => {
    let proto = Object.create(HTMLElement.prototype)
    proto.createdCallback = function() {
      this.innerHTML = '<p>Hello</p>'
    }

    document.registerElement('x-foo', { prototype: proto })

    let render = bind(div)
    render`<x-foo></x-foo>`
    assert.equal(`<x-foo><p>Hello</p></x-foo>`, div.innerHTML)
  })

  it('does not upgrade v1 custom elements with hyper attributes', () => {})
})

describe('adopt', () => {
  let div

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
  })

  afterEach(() => {
    document.body.removeChild(div)
  })

  it('basically adopts a given DOM', () => {
    let innerHTML =
      '<style>* {color:red;}</style>' +
      '<p></p>' +
      '<div prop="foo" test="before">before' +
      '<ul><li> lonely </li></ul>' +
      'NO<hr>' +
      '</div>'
    div.innerHTML = innerHTML

    let innerDiv = div.lastElementChild
    let firstText = innerDiv.firstChild
    let ul = innerDiv.firstElementChild
    let secondText = ul.nextSibling
    let hr = innerDiv.lastElementChild

    let model = {
      css: '* {color: blue;}',
      click: function() {},
      newContent: 0.756,
      prop: 'bar',
      test: 'after',
      text: 'after',
      list: [{ name: 'first' }, { name: 'second' }],
      inBetween: 'OK'
    }
    let render = adopt(div)
    render`
      <style>${model.css}</style>
      <p onclick="${model.click}"> ${model.newContent} </p>
      <div prop="${model.prop}" test$="${model.test}">
        ${model.text}
        <ul>
        ${model.list.map(item => `<li> ${item.name} </li>`)}
        </ul>
        ${model.inBetween}
        <hr>
      </div>
    `

    // Note that `prop` is gone here!
    let newHTML =
      '<style>* {color: blue;}</style>' +
      '<p>0.756</p>' +
      '<div test="after">after' +
      '<ul><li> first </li><li> second </li></ul>' +
      'OK<hr>' +
      '</div>'
    matchInnerHTML(newHTML, div)
    assert.equal(div.lastElementChild.prop, 'bar')

    // It seems that TEXT_NODE's are replaced. Does it matter?
    assert.equal(div.lastElementChild, innerDiv)
    // assert.equal(div.lastElementChild.firstChild, firstText)
    assert.equal(div.lastElementChild.firstElementChild, ul)
    // assert.equal(
    //   div.lastElementChild.firstElementChild.nextSibling,
    //   secondText
    // )
    assert.equal(div.lastElementChild.lastElementChild, hr)
  })

  it.skip('adopts a text node', () => {
    div.innerHTML = `<p>before</p>`
    let textNode = div.firstElementChild.firstChild

    let render = adopt(div)
    render`<p>${'after'}</p>`

    matchInnerHTML(`<p>${'after'}</p>`, div)

    assert.equal(div.firstElementChild.firstChild, textNode)
  })

  it('adopts a property', () => {
    div.innerHTML = `<p prop="before"></p>`
    let render = adopt(div)
    render`<p prop=${'after'}></p>`

    assert.equal(div.firstElementChild.prop, 'after')
    matchInnerHTML(`<p></p>`, div)
  })
})
