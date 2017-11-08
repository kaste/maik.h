
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

# maik.h

HTML templating without the render loop; based on [hyperHTML](https://github.com/WebReflection/hyperHTML) v1.

`maik` started as a fork of `hyperHTML` but quickly dissolved, and now deserves its own name. It adds support for `Rx.Observables` as a new native 'primitive', and provides new tag functions `html` and `svg` which kinda replace hyperHTML's `wire` functionality


## Basic Example

The API is really, really thin, so we just start off with an example.

```js

let { bind, html } = maik;

// Assume Rx is globally available
let clock =
  Rx.Observable
    .interval(1000)
    .map(() => new Date().toLocaleTimeString())

let greeting = html`<h1>Hello, world!</h1>`
let theTime = html`<h2>It is ${clock}.</h2>`

let render = bind(document.body)
render`
  <div>
    ${greeting}
    ${theTime}
  </div>
`
```

## Features

  * Maximally **5KB** (minzipped).
  * Uses ESM modules, and with treeshaking bundling can be even less.
  * Direct, native DOM manipulation. No diffing, no VDOM.
  * No framework.
  * Efficient for list of items, builtin.
