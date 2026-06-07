// Loads "Editable Text Content.json" and populates the page.
// Two patterns:
//
//   1. Single fields:
//      <h1 data-content="preproduction.title">…</h1>
//      <p  data-content="site.email">…</p>
//
//   2. Lists rendered from <template>:
//      <div data-template="filmTpl" data-source="preproduction.films"
//           data-item-prefix="scene"></div>
//      <template id="filmTpl">
//        <div class="scene" data-modifier>
//          <span data-field="sceneNum"></span>
//          <span data-field="scene"></span>
//          ...
//        </div>
//      </template>
//
// `data-modifier` elements get a CSS class added per item (scene--01, scene--02, …),
// cycling every 5 items so colors keep working past 5 films.
//
// When loading is complete, fires a `content:loaded` event so other scripts can
// safely query / wire up the rendered DOM.

(() => {
  const get = (obj, path) =>
    path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

  const setField = (el, value) => {
    if (value == null) return;
    if (el.dataset.contentHtml !== undefined) el.innerHTML = value;
    else el.textContent = value;
  };

  const applyAttrs = (el, item) => {
    // data-attr-href, data-attr-style, etc. — copy from item.<key>
    for (const a of el.attributes) {
      if (!a.name.startsWith('data-attr-')) continue;
      const target = a.name.slice('data-attr-'.length);
      const fieldName = a.value;
      const v = item[fieldName];
      if (v != null) el.setAttribute(target, v);
    }
  };

  const renderItem = (tpl, item, idx, prefix) => {
    const node = tpl.content.cloneNode(true);

    // simple text fields
    node.querySelectorAll('[data-field]').forEach(el => {
      const f = el.dataset.field;
      // dotted path support, e.g. data-field="position.top"
      const v = f.includes('.') ? get(item, f) : item[f];
      setField(el, v);
    });

    // attribute targets
    node.querySelectorAll('[data-attr-href], [data-attr-style], [data-attr-src]').forEach(el => {
      applyAttrs(el, item);
    });

    // per-item modifier — adds e.g. scene--01, work-thumb--05, etc., cycling
    if (prefix) {
      const modCount = parseInt(tpl.dataset.modifierCount || '5', 10);
      const num = String((idx % modCount) + 1).padStart(2, '0');
      node.querySelectorAll('[data-modifier]').forEach(el => {
        el.classList.add(`${prefix}--${num}`);
      });
    }

    // inline style assembly for coffin position objects
    node.querySelectorAll('[data-style-from]').forEach(el => {
      const f = el.dataset.styleFrom;
      const obj = item[f];
      if (!obj) return;
      const css = Object.entries(obj)
        .map(([k, v]) => k === 'rot' ? `--rot: ${v}` : `${k}: ${v}`)
        .join('; ');
      el.setAttribute('style', css);
    });

    return node;
  };

  const populate = (data) => {
    // simple fields
    document.querySelectorAll('[data-content]').forEach(el => {
      setField(el, get(data, el.dataset.content));
    });

    // attribute targets at top level
    document.querySelectorAll('[data-content-attr]').forEach(el => {
      const [path, attr] = el.dataset.contentAttr.split('|');
      const v = get(data, path);
      if (v != null) el.setAttribute(attr, v);
    });

    // titles
    if (data && data.site) document.documentElement.lang = 'en';

    // template-rendered lists
    document.querySelectorAll('[data-template]').forEach(container => {
      const tpl = document.getElementById(container.dataset.template);
      const items = get(data, container.dataset.source);
      const prefix = container.dataset.itemPrefix || '';
      if (!tpl || !Array.isArray(items)) return;
      // optional anchor — append before this child if specified
      const anchor = container.dataset.anchor
        ? container.querySelector(container.dataset.anchor)
        : null;
      items.forEach((item, idx) => {
        const node = renderItem(tpl, item, idx, prefix);
        if (anchor) container.insertBefore(node, anchor);
        else container.appendChild(node);
      });
    });
  };

  // URL-encoded because the filename has spaces; the actual file on disk
  // is named "Editable Text Content.json" (Charlie can read it at a glance).
  fetch('Editable%20Text%20Content.json', { cache: 'no-cache' })
    .then(r => r.json())
    .then(data => {
      window.__CONTENT__ = data;
      populate(data);
      document.dispatchEvent(new CustomEvent('content:loaded', { detail: data }));
    })
    .catch(err => {
      console.error('Editable Text Content.json failed to load:', err);
      document.dispatchEvent(new CustomEvent('content:loaded', { detail: null }));
    });
})();
