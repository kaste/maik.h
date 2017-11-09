/* global chai, Rx */

// import '../node_modules/rx-lite/rx.lite.js'

import { bind } from '../src/maik.js'
import { matchInnerHTML } from './utils.js'

const { assert } = chai

describe('observers in attributes', () => {
  let div

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
  })

  afterEach(() => {
    document.body.removeChild(div)
  })

  it('updates on pushed values', () => {
    let subject = new Rx.Subject()

    let render = bind(div)
    render`<p my-attr$=${subject}></p>`
    matchInnerHTML(`<p></p>`, div)
    subject.next(1)
    matchInnerHTML(`<p my-attr="1"></p>`, div)
  })

  it('switches to next passed observable and unsubscribes', () => {
    let subject = new Rx.Subject()

    let render = bind(div)
    render`<p my-attr$=${subject}></p>`
    subject.next(1)
    matchInnerHTML(`<p my-attr="1"></p>`, div)

    let nextSubject = new Rx.Subject()
    render`<p my-attr$=${nextSubject}></p>`
    nextSubject.next('foo')
    subject.next(2)
    matchInnerHTML(`<p my-attr="foo"></p>`, div)

    render`<p my-attr$=${null}></p>`
    assert.equal(subject.observers.length, 0)
  })
})

describe('event handlers as subjects', () => {
  let div

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
  })

  afterEach(() => {
    document.body.removeChild(div)
  })

  it('pushes the event out to the subject', done => {
    let clicks = new Rx.Subject()
    clicks.subscribe(ev => {
      assert.equal(ev.target, div.firstChild)
      done()
    })

    let render = bind(div)
    render`<p on-click=${clicks}></p>`
    let p = div.firstChild
    let event = document.createEvent('Event')
    event.initEvent('click', false, false)
    p.dispatchEvent(event)
  })

  it('removes the event listener when no subject listens', done => {
    let clicks = new Rx.Subject()

    let render = bind(div)
    render`<p on-click=${clicks}></p>`

    let p = div.firstChild
    p.removeEventListener = () => {
      done()
    }

    render`<p on-click=${null}></p>`
  })
})

describe('observers for nodes', () => {
  let div

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
  })

  afterEach(() => {
    document.body.removeChild(div)
  })

  it('pushes values into the template hole', () => {
    let subject = new Rx.Subject()

    let render = bind(div)
    render`<p>${subject}</p>`

    matchInnerHTML(`<p></p>`, div)

    subject.next('Hello')
    matchInnerHTML(`<p>Hello</p>`, div)
  })

  it('unsubscribes a previous observable', function() {
    let render = bind(div)

    let subject = new Rx.Subject()
    render`<p>${subject}</p>`
    let newSubject = new Rx.Subject()
    render`<p>${newSubject}</p>`

    subject.next('Hello')
    matchInnerHTML(`<p></p>`, div)

    newSubject.next('World')
    matchInnerHTML(`<p>World</p>`, div)
  })
})
