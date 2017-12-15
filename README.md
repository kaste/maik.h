[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

# maik.h

HTML templating without the render loop.

`maik` started as a fork of
[hyperHTML](https://github.com/WebReflection/hyperHTML) but quickly
dissolved. It has support for `Rx.Observables` as a new native 'primitive',
and provides tag functions like `html` and `svg` just like
[lit-html](https://github.com/PolymerLabs/lit-html) does. In contrast to
`lit-html`, `html` and `svg` are lazy.

## Import it

Just play with it using true ESM modules:

```
<script type="module">
  import { bind } from 'https://unpkg.com/maik.h@latest/default-maik.js'

  let render = bind(document.body)
  render`<div>Hi, how are you?</div>`
</script>
```

Or, old-school:

```
<script src="https://unpkg.com/maik@latest/default-maik-bundle.js"></script>
<script>
  let { bind } = maik

  let render = bind(document.body)
  render`<div>Hi, how are you?</div>`
</script>
```

## Basic Example

The API is really, really thin, so we just start off with another example.

```js
// Assume Rx and maik are **globally** available
let { bind, html } = maik

let clock = Rx.Observable.interval(1000).map(() =>
  new Date().toLocaleTimeString()
)

// `html` partials are lazy, they don't do anything until you attach them.
// That basically means, the clock is not ticking right now.
let greeting = html`<h1>Hello, world!</h1>`
let theTime = html`<h2>It is ${clock}.</h2>`

let render = bind(document.body)
// We call `render` once, and the clock is ticking
render`
  <div>
    ${greeting}
    ${theTime}
  </div>
`
```

## Install it

```
npm install maik.h
```

like you always do and import it directly:

```
<script type="module">
  import { bind, html } from 'node_modules/maik.h/default-maik.js'
</script>
```

## Features

* Maximally **3.8KB** (minzipped).
* Uses ESM modules.
* Direct, native DOM manipulation. No VDOM.
* No framework, just a lib.
* Efficient for list of items. `keyed` lists builtin.
* If you opt-in to use Rx, you can avoid building around a render loop.
