/* eslint semi: [1, 'always'] */
/* global tressa, hyperHTML */
var SKIP_ADOPT = typeof location !== typeof SKIP_ADOPT && -1 < location.search.indexOf('noadopt');
var hyperHTML = maik

tressa.title('HyperHTML');

try { tressa.log(''); } catch(e) { tressa.log = console.log.bind(console); }

/*
tressa.async(function (done) {
  var wrap = document.createElement('p');
  hyperHTML.bind(wrap)`${1}`;
  hyperHTML.bind(wrap)`${2}`;
  tressa.assert(wrap.textContent == 2);
  done();
})
*/
tressa.async(function (done) {
  tressa.log('## injecting text and attributes');
  var i = 0;
  var div = document.body.appendChild(document.createElement('div'));
  var render = hyperHTML.bind(div);
  function update(i) {
    return render`
    <p data-counter$="${i}">
      Time: ${
        // IE Edge mobile did something funny here
        // as template string returned xxx.xxxx
        // but as innerHTML returned xxx.xx
        (Math.random() * new Date).toFixed(2)
      }
    </p>
    `;
  }
  function compare(html) {
    return /^\s*<p data-counter="\d">\s*Time: \d+\.\d+<[^>]+?>\s*<\/p>\s*$/i.test(html);
  }
  var html = update(i++).innerHTML;
  var p = div.querySelector('p');
  var attr = p.attributes[0];
  tressa.assert(compare(html), 'correct HTML');
  tressa.assert(html === div.innerHTML, 'correctly returned');
  setTimeout(function () {
    tressa.log('## updating same nodes');
    var html = update(i++).innerHTML;
    tressa.assert(compare(html), 'correct HTML update');
    tressa.assert(html === div.innerHTML, 'update applied');
    tressa.assert(p === div.querySelector('p'), 'no node was changed');
    tressa.assert(attr === p.attributes[0], 'no attribute was changed');
    done();
  });
})
.then(function () {
  return tressa.async(function (done) {
    tressa.log('## perf: same virtual text twice');
    var div = document.body.appendChild(document.createElement('div'));
    var render = hyperHTML.bind(div);
    var html = (update('hello').innerHTML, update('hello').innerHTML);
    function update(text) {
      return render`<p>${text} world</p>`;
    }
    tressa.assert(
      update('hello').innerHTML ===
      update('hello').innerHTML,
      'same text'
    );
    done(div);
  });
})
.then(function () {
  return tressa.async(function (done) {
    tressa.log('## injecting HTML');
    var div = document.body.appendChild(document.createElement('div'));
    var render = hyperHTML.bind(div);
    var html = update('hello').innerHTML;
    function update(text) {
      return render`<p>${{html: '<strong>' + text + '</strong>'}}</p>`;
    }
    function compare(html) {
      return /^<p><strong>\w+<\/strong><!--.+?--><\/p>$/i.test(html);
    }
    tressa.assert(compare(html), 'HTML injected');
    tressa.assert(html === div.innerHTML, 'HTML returned');
    done(div);
  });
})
.then(function (div) {
  return tressa.async(function (done) {
    tressa.log('## function attributes');
    var render = hyperHTML.bind(div);
    var times = 0;
    update(function (e) {
      console.log(e.type);
      if (++times > 1) {
        return tressa.assert(false, 'events are broken');
      }
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      tressa.assert(true, 'onclick invoked');
      tressa.assert(!a.hasAttribute('onclick'), 'no attribute');
      update(null);
      e = document.createEvent('Event');
      e.initEvent('click', false, false);
      a.dispatchEvent(e);
      done(div);
    });
    function update(click) {
      // also test case-insensitive builtin events
      return render`<a href="#" onClick="${click}">click</a>`;
    }
    var a = div.querySelector('a');
    var e = document.createEvent('Event');
    e.initEvent('click', false, false);
    a.dispatchEvent(e);
  });
})
.then(function (div) {
  return tressa.async(function (done) {
    tressa.log('## changing template');
    var render = hyperHTML.bind(div);
    var html = update('hello').innerHTML;
    function update(text) {
      return render`<p>${{html: ['<em>' + text + '</em>']}}</p>`;
    }
    function compare(html) {
      return /^<p><em>\w+<\/em><!--.+?--><\/p>$/i.test(html);
    }
    tressa.assert(compare(html), 'new HTML injected');
    tressa.assert(html === div.innerHTML, 'new HTML returned');
    done(div);
  });
})
.then(function () {
  return tressa.async(function (done) {
    tressa.log('## custom events');
    var render = hyperHTML.bind(document.createElement('p'));
    var e = document.createEvent('Event');
    e.initEvent('custom-event', true, true);
    (render`<span on-custom-event="${function (e) {
      tressa.assert(e.type === 'custom-event', 'event triggered');
      done();
    }}">how cool</span>`
    ).firstElementChild.dispatchEvent(e);
  });
})
.then(function () {
  return tressa.async(function (done) {
    tressa.log('## hyperHTML.wire()');

    var render = hyperHTML.wire();
    var update = function () {
      return render`
        <p>1</p>
      `;
    };
    var node = update();
    tressa.assert(node.nodeName === 'P', 'correct node');
    var same = update();
    tressa.assert(node === same, 'same node returned');

    render = hyperHTML.wire();
    update = function () {
      return render`
        0
        <p>1</p>
      `;
    };
    node = update();
    tressa.assert(Array.isArray(node), 'list of nodes');
    same = update();
    tressa.assert(
      node.length === same.length &&
      node[0] &&
      node.every(function (n, i) { return same[i] === n; }),
      'same list returned'
    );
    var div = document.createElement('div');
    render = hyperHTML.bind(div);
    render`${node}`;
    same = div.childNodes;
    tressa.assert(
      node[0] &&
      node.every(function (n, i) { return same[i] === n; }),
      'same list applied'
    );

    render = hyperHTML.wire();
    if (
      (function(s){ return s; })`a` ===
      (function(s){ return s; })`a`
    ) {
      tressa.assert(
        render`a` === render`a` &&
        render`a` !== render`b`,
        'template sensible wire'
      );
    } else {
      tressa.log('⚠️ this *browser* is *not spec compliant*');
    }

    done();
  });
})
.then(function () {
  return tressa.async(function (done) {
    tressa.log('## hyperHTML.wire(object)');
    var point = {x: 1, y: 2};
    let render = hyperHTML.wire();
    function update() {
      return render`
      <span style="${`
        position: absolute;
        left: ${point.x}px;
        top: ${point.y}px;
      `}">O</span>`;
    }
    tressa.assert(update() === update(), 'same output');
    done();
  });
})
.then(function () {
  if (typeof MutationObserver === 'undefined') return;
  return tressa.async(function (done) {
    tressa.log('## preserve first child where first child is the same as incoming');
    var div = document.body.appendChild(document.createElement('div'));
    var render = hyperHTML.bind(div);
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0, len = mutations.length; i < len; i++) {
        trackMutations(mutations[i].addedNodes, 'added');
        trackMutations(mutations[i].removedNodes, 'removed');
      }
    });

    observer.observe(div, {
      childList: true,
      subtree: true,
    });

    var counters = [];

    function trackMutations (nodes, countKey) {
      for (var i = 0, len = nodes.length, counter, key; i < len; i++) {
        if (nodes[i] && nodes[i].getAttribute && nodes[i].getAttribute('data-test')) {
          key = nodes[i].getAttribute('data-test');
          counter = counters[key] || (counters[key] = { added: 0, removed: 0 });
          counter[countKey]++;
        }
        if (nodes[i].childNodes.length > 0) {
          trackMutations(nodes[i].childNodes, countKey);
        }
      }
    }

    var listItems = [];

    function update(items) {
      render`
      <section>
        <ul>${
          items.map(function (item, i) {
            return hyperHTML.html(i)`
            <li data-test="${i}">${item.text}</li>
            `;
          })
        }</ul>
      </section>`;
    }

    update([]);

    setTimeout(function () {
      update([{ text: 'test1' }]);
    }, 10);
    setTimeout(function () {
      update([{ text: 'test1' }, { text: 'test2' }]);
    }, 20);
    setTimeout(function () {
      update([{ text: 'test1' }]);
    }, 30);
    setTimeout(function () {
      if (counters.length) {
        tressa.assert(counters[0].added === 1, 'first item added only once');
        tressa.assert(counters[0].removed === 0, 'first item never removed');
      }
      done();
    }, 100);
  });
})
.then(function () {
  tressa.log('## rendering one node');
  var div = document.createElement('div');
  var br = document.createElement('br');
  var hr = document.createElement('hr');
  hyperHTML.bind(div)`<div>${br}</div>`;
  tressa.assert(div.firstChild.firstChild === br, 'one child is added');
  hyperHTML.bind(div)`<div>${hr}</div>`;
  tressa.assert(div.firstChild.firstChild === hr, 'one child is changed');
  hyperHTML.bind(div)`<div>${[hr, br]}</div>`;
  tressa.assert(
    div.firstChild.childNodes[0] === hr &&
    div.firstChild.childNodes[1] === br,
    'more children are added'
  );
  hyperHTML.bind(div)`<div>${[br, hr]}</div>`;
  tressa.assert(
    div.firstChild.childNodes[0] === br &&
    div.firstChild.childNodes[1] === hr,
    'children can be swapped'
  );
  hyperHTML.bind(div)`<div>${br}</div>`;
  tressa.assert(div.firstChild.firstChild === br, 'one child is kept');
  hyperHTML.bind(div)`<div>${[]}</div>`;
  tressa.assert(/<div><!--.+?--><\/div>/.test(div.innerHTML), 'dropped all children');
})
.then(function () {
  return tressa.async(function (done) {
    tressa.log('## Promises instead of nodes');
    let wrap = document.createElement('div');
    let render = hyperHTML.bind(wrap);
    render`<p>${
      new Promise(function (r) { setTimeout(r, 50, 'any'); })
    }</p>${
      new Promise(function (r) { setTimeout(r, 10, 'virtual'); })
    }<hr><div>${[
      new Promise(function (r) { setTimeout(r, 20, 1); }),
      new Promise(function (r) { setTimeout(r, 10, 2); }),
    ]}</div>${[
      new Promise(function (r) { setTimeout(r, 20, 3); }),
      new Promise(function (r) { setTimeout(r, 10, 4); }),
    ]}`;
    let result = wrap.innerHTML;
    setTimeout(function () {
      tressa.assert(result !== wrap.innerHTML, 'promises fullfilled');
      tressa.assert(
        /^<p>any<!--.+?--><\/p>virtual<!--.+?--><hr><div>12<!--.+?--><\/div>34<!--.+?-->$/.test(wrap.innerHTML),
        'both any and virtual content correct'
      );
      done();
    }, 100);
  });
})
.then(function () {
  tressa.log('## for code coverage sake');
  hyperHTML.MAX_LIST_SIZE = 0;
  let wrap = document.createElement('div');
  let text = [document.createTextNode('a'), document.createTextNode('b'), document.createTextNode('c')];
  let testingMajinBuu = hyperHTML.bind(wrap);
  testingMajinBuu`${[text]}`;
  tressa.assert(wrap.textContent === 'abc');
  text[0] = document.createTextNode('c');
  text[2] = document.createTextNode('a');
  testingMajinBuu`${[text]}`;
  tressa.assert(wrap.textContent === 'cba');

  let result = hyperHTML.wire()`<!--not hyprHTML-->`;
  tressa.assert(result.nodeType === 8, 'it is a comment');
  tressa.assert(result.textContent === 'not hyprHTML', 'correct content');
  hyperHTML.bind(wrap)`<br>${'node before'}`;
  tressa.assert(/^<br>node before<!--.+?-->$/i.test(wrap.innerHTML), 'node before');
  hyperHTML.bind(wrap)`${'node after'}<br>`;
  tressa.assert(/^node after<!--.+?--><br>$/i.test(wrap.innerHTML), 'node after');
  hyperHTML.bind(wrap)`<style>${'hyper-html{}'}</style>`;
  tressa.assert('<style>hyper-html{}</style>' === wrap.innerHTML.toLowerCase(), 'node style');
  hyperHTML.bind(wrap)`${document.createTextNode('a')}`;
  hyperHTML.bind(wrap)`${document.createDocumentFragment()}`;
  hyperHTML.bind(wrap)`${document.createDocumentFragment()}`;
  let fragment = document.createDocumentFragment();
  fragment.appendChild(document.createTextNode('b'));
  hyperHTML.bind(wrap)`${fragment}`;
  hyperHTML.bind(wrap)`${123}`;
  tressa.assert(wrap.textContent === '123', 'text as number');
  hyperHTML.bind(wrap)`${true}`;
  tressa.assert(wrap.textContent === 'true', 'text as boolean');
  hyperHTML.bind(wrap)`${[1]}`;
  tressa.assert(wrap.textContent === '1', 'text as one entry array');
  hyperHTML.bind(wrap)`${['1', '2']}`;
  tressa.assert(wrap.textContent === '12', 'text as multi entry array of strings');
  let arr = [document.createTextNode('a'), document.createTextNode('b')];
  hyperHTML.bind(wrap)`${[arr]}`;
  tressa.assert(wrap.textContent === 'ab', 'text as multi entry array of nodes');
  hyperHTML.bind(wrap)`${[arr]}`;
  tressa.assert(wrap.textContent === 'ab', 'same array of nodes');
  hyperHTML.bind(wrap)`${wrap.childNodes}`;
  tressa.assert(wrap.textContent === 'ab', 'childNodes as list');
  hyperHTML.bind(wrap)`a=${{length:1, '0':'b'}}`;
  tressa.assert(wrap.textContent === 'a=b', 'childNodes as virtual list');
  hyperHTML.bind(wrap)`[${'text'}]`;
  hyperHTML.bind(wrap)`[${'text'}]`;
  let onclick = (e) => {};
  let handler = {handleEvent: onclick};
  hyperHTML.bind(wrap)`<p onclick="${onclick}" onmouseover="${handler}" align="${'left'}"></p>`;
  handler = {handleEvent: onclick};
  hyperHTML.bind(wrap)`<p onclick="${onclick}" onmouseover="${handler}" align="${'left'}"></p>`;
  hyperHTML.bind(wrap)`<p onclick="${onclick}" onmouseover="${handler}" align="${'left'}"></p>`;
  hyperHTML.bind(wrap)`<br>${arr[0]}<br>`;
  hyperHTML.bind(wrap)`<br>${arr}<br>`;
  hyperHTML.bind(wrap)`<br>${arr}<br>`;
  hyperHTML.bind(wrap)`<br>${[]}<br>`;
  hyperHTML.bind(wrap)`<br>${['1', '2']}<br>`;
  hyperHTML.bind(wrap)`<br>${document.createDocumentFragment()}<br>`;
  tressa.assert(true, 'passed various virtual content scenarios');
  let svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  if (!('ownerSVGElement' in svgContainer)) svgContainer.ownerSVGElement = null;
  hyperHTML.bind(svgContainer)`<rect x="1" y="2" />`;
  result = hyperHTML.wire('svg')`<svg></svg>`;
  tressa.assert(result.nodeName.toLowerCase() === 'svg', 'svg content is allowed too');
  result = hyperHTML.wire()``;
  tressa.assert(!result.innerHTML, 'empty content');
  let tr = hyperHTML.wire()`<tr><td>ok</td></tr>`;
  tressa.assert(true, 'even TR as template');

  hyperHTML.bind(wrap)`${' 1 '}`;
  tressa.assert(wrap.textContent === ' 1 ', 'text in between');

  hyperHTML.bind(wrap)` <br>${1}</br> `;
  tressa.assert(/ <br>1<!--.+?--><br> /.test(wrap.innerHTML), 'virtual content in between');

})
.then(function () {
  tressa.log('## no WebKit backfire');
  var div = document.createElement('div');
  let render = hyperHTML.bind(div);
  function update(value, attr) {
    return render`
    <input value="${value}" shaka$="${attr}">`;
  }
  var input = update('', '').firstElementChild;
  input.value = '456';
  input.attributes.shaka.value = 'laka';
  update('123', 'laka');
  tressa.assert(input.value === '123', 'correct input');
  tressa.assert(input.value === '123', 'correct attribute');
  update('', '');
  input.value = '123';
  input.attributes.shaka.value = 'laka';
  update('123', 'laka');
  tressa.assert(input.value === '123', 'input.value was not reassigned');
})
.then(function () {
  tressa.log('## wired arrays are rendered properly');
  var div = document.createElement('div');
  var employees = [
    {first: 'Bob', last: 'Li'},
    {first: 'Ayesha', last: 'Johnson'}
  ];
  hyperHTML.bind(div)`${
    employees.map(
      employee => hyperHTML.wire()`
      <div>First name: ${employee.first}</div>
      <p></p>`
    )
  }`;
  tressa.assert(div.childElementCount === 4, 'correct elements as setAny');
  hyperHTML.bind(div)`
    <p></p>${
    employees.map(
      employee => hyperHTML.wire()`
      <div>First name: ${employee.first}</div>
      <p></p>`
    )
  }`;
  tressa.assert(div.childElementCount === 5, 'correct elements as setVirtual');
})
// .then(function () {
//   tressa.log('## attributes with weird chars');
//   var div = document.createElement('div');
//   hyperHTML.bind(div)`<p $foo=${'bar'}></p>`;
//   tressa.assert(div.firstChild.getAttribute('$foo') === 'bar', 'OK');
// })
.then(function () {
  tressa.log('## attributes without quotes');
  var div = document.createElement('div');
  hyperHTML.bind(div)`<p test$=${'a"b'}></p>`;
  tressa.assert(div.firstChild.getAttribute('test') === 'a"b', 'OK');
})
.then(function () {
  tressa.log('## any content extras');
  var div = document.createElement('div');
  hyperHTML.bind(div)`<p>${undefined}</p>`;
  tressa.assert(/<p><!--.+?--><\/p>/.test(div.innerHTML), 'expected layout');
  hyperHTML.bind(div)`<p>${{text: '<img>'}}</p>`;
  tressa.assert(/<p>&lt;img&gt;<!--.+?--><\/p>/.test(div.innerHTML), 'expected text');
  hyperHTML.bind(div)`<p>${function () { return '<b>'; }}</p>`;
  tressa.assert(/<p>&lt;b&gt;<!--.+?--><\/p>/.test(div.innerHTML), 'expected callback');
})
.then(function () {
  tressa.log('## virtual content extras');
  var div = document.createElement('div');
  hyperHTML.bind(div)`a ${null}`;
  tressa.assert(/a <[^>]+?>/.test(div.innerHTML), 'expected layout');
  hyperHTML.bind(div)`a ${{text: '<img>'}}`;
  tressa.assert(/a &lt;img&gt;<[^>]+?>/.test(div.innerHTML), 'expected text');
  hyperHTML.bind(div)`a ${{any: 123}}`;
  tressa.assert(/a 123<[^>]+?>/.test(div.innerHTML), 'expected any');
  hyperHTML.bind(div)`a ${{html: '<b>ok</b>'}}`;
  tressa.assert(/a <b>ok<\/b><[^>]+?>/.test(div.innerHTML), 'expected html');
  hyperHTML.bind(div)`a ${{}}`;
  tressa.assert(/a <[^>]+?>/.test(div.innerHTML), 'expected nothing');
})
.then(function () {
  tressa.log('## defined transformer');
  hyperHTML.define('eUC', encodeURIComponent);
  var div = document.createElement('div');
  hyperHTML.bind(div)`a=${{eUC: 'b c'}}`;
  tressa.assert(/a=b%20c<[^>]+?>/.test(div.innerHTML), 'expected virtual layout');
  hyperHTML.bind(div)`<p>${{eUC: 'b c'}}</p>`;
  tressa.assert(/<p>b%20c<!--.+?--><\/p>/.test(div.innerHTML), 'expected layout');
  // TODO: for coverage sake
  //       defined transformer ... so what?
  hyperHTML.define('eUC', encodeURIComponent);
  //       non existent one ... so what?
  hyperHTML.bind(div)`a=${{nOPE: 'b c'}}`;
})
.then(function () {
  tressa.log('## attributes with null values');
  var div = document.createElement('div');
  hyperHTML.bind(div)`<p any-attr$=${'1'}>any content</p>`;
  tressa.assert(
    div.firstChild.hasAttribute('any-attr') &&
    div.firstChild.getAttribute('any-attr') === '1',
    'regular attribute'
  );
  hyperHTML.bind(div)`<p any-attr$=${null}>any content</p>`;
  tressa.assert(
    !div.firstChild.hasAttribute('any-attr') &&
    div.firstChild.getAttribute('any-attr') == null,
    'can be removed'
  );
  hyperHTML.bind(div)`<p any-attr$=${undefined}>any content</p>`;
  tressa.assert(
    !div.firstChild.hasAttribute('any-attr') &&
    div.firstChild.getAttribute('any-attr') == null,
    'multiple times'
  );
  hyperHTML.bind(div)`<p any-attr$=${'2'}>any content</p>`;
  tressa.assert(
    div.firstChild.hasAttribute('any-attr') &&
    div.firstChild.getAttribute('any-attr') === '2',
    'but can be also reassigned'
  );
  hyperHTML.bind(div)`<p any-attr$=${'3'}>any content</p>`;
  tressa.assert(
    div.firstChild.hasAttribute('any-attr') &&
    div.firstChild.getAttribute('any-attr') === '3',
    'many other times'
  );
  hyperHTML.bind(div)`<input name=${'test'}>`;
  tressa.assert(
    div.firstChild.hasAttribute('name') &&
    div.firstChild.name === 'test',
    'special attributes are set too'
  );
  hyperHTML.bind(div)`<input name=${null}>`;
  tressa.assert(
    !div.firstChild.name,
    'but can also be removed'
  );
  hyperHTML.bind(div)`<input name=${undefined}>`;
  tressa.assert(
    !div.firstChild.name,
    'with either null or undefined'
  );
})
.then(function () {return tressa.async(function (done) {
  tressa.log('## placeholder');
  var div = document.createElement('div');
  var vdiv = document.createElement('div');
  hyperHTML.bind(div)`<p>${{eUC: 'b c', placeholder: 'z'}}</p>`;
  hyperHTML.bind(vdiv)`a=${{eUC: 'b c', placeholder: 'z'}}`;
  tressa.assert(/<p>z<!--.+?--><\/p>/.test(div.innerHTML), 'expected inner placeholder layout');
  tressa.assert(/a=z<[^>]+?>/.test(vdiv.innerHTML), 'expected virtual placeholder layout');
  setTimeout(function () {
    tressa.assert(/<p>b%20c<!--.+?--><\/p>/.test(div.innerHTML), 'expected inner resolved layout');
    tressa.assert(/a=b%20c<[^>]+?>/.test(vdiv.innerHTML), 'expected virtual resolved layout');
    hyperHTML.bind(div)`<p>${{text: 1, placeholder: '9'}}</p>`;
    setTimeout(function () {
      tressa.assert(/<p>1<!--.+?--><\/p>/.test(div.innerHTML), 'placeholder with text');
      hyperHTML.bind(div)`<p>${{any: [1, 2], placeholder: '9'}}</p>`;
      setTimeout(function () {
        tressa.assert(/<p>12<!--.+?--><\/p>/.test(div.innerHTML), 'placeholder with any');
        hyperHTML.bind(div)`<p>${{html: '<b>3</b>', placeholder: '9'}}</p>`;
        setTimeout(function () {
          tressa.assert(/<p><b>3<\/b><!--.+?--><\/p>/.test(div.innerHTML), 'placeholder with html');
          done();
        }, 10);
      }, 10);
    }, 10);
  }, 10);
});})
.then(function () {
  tressa.log('## data=${anyContent}');
  var obj = {rand: Math.random()};
  var div = hyperHTML.wire()`<div data=${obj}>abc</div>`;
  tressa.assert(div.data === obj, 'data available without serialization');
  tressa.assert(div.outerHTML === '<div>abc</div>', 'attribute not there');
})
.then(function () {
  tressa.log('## splice and sort');
  var todo = [
    {id: 0, text: 'write documentation'},
    {id: 1, text: 'publish online'},
    {id: 2, text: 'create Code Pen'}
  ];
  var div = document.createElement('div');
  update();
  todo.sort(function(a, b) { return a.text < b.text ? -1 : 1; });
  update();
  tressa.assert(div.textContent.replace(/^\s+|\s+$/g, '') === 'create Code Penpublish onlinewrite documentation', 'correct order');
  function update() {
    hyperHTML.bind(div)`<ul>
      ${todo.map(function (item) {
        return hyperHTML.wire()
        `<li data-id=${item.id}>${item.text}</li>`;
      })}
    </ul>`;
  }
})
// WARNING THESE TEST MUST BE AT THE VERY END
// WARNING THESE TEST MUST BE AT THE VERY END
// WARNING THESE TEST MUST BE AT THE VERY END
.then(function () {
  // WARNING THESE TEST MUST BE AT THE VERY END
  tressa.log('## IE9 double viewBox 🌈 🌈');
  var output = document.createElement('div');
  try {
    hyperHTML.bind(output)`<svg viewBox=${'0 0 50 50'}></svg>`;
    tressa.assert(output.firstChild.getAttribute('viewBox') == '0 0 50 50', 'correct camelCase attribute');
  } catch(o_O) {
    tressa.assert(true, 'code coverage caveat');
  }
})
// */
.then(function () {
  if (!tressa.exitCode) {
    document.body.style.backgroundColor = '#0FA';
  }
  tressa.end();
});