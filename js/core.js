/*
 * 核心：功能模組註冊、畫面切換、本機儲存。
 * 新增功能：在 js/modules/ 建一個檔案，呼叫 App.registerModule({...})，
 * 再到 index.html 加一行 <script>。首頁會自動出現它的卡片。
 */
window.App = window.App || {};

(function () {
  var modules = [];
  var root = null;

  App.registerModule = function (mod) {
    // mod: { id, title, subtitle, status: 'ready' | 'soon', render(el, params), summary() }
    modules.push(mod);
  };

  App.getModule = function (id) {
    return modules.find(function (m) { return m.id === id; });
  };

  App.modules = function () { return modules.slice(); };

  // go('home') 或 go('family-quiz', { view: 'setup' })
  App.go = function (id, params) {
    if (!root) root = document.getElementById('view');
    root.innerHTML = '';
    window.scrollTo(0, 0);
    if (id === 'home') { App.renderHome(root); return; }
    var mod = App.getModule(id);
    if (mod && mod.status === 'ready') mod.render(root, params || {});
    else App.renderHome(root);
  };

  // 小工具：建立元素
  App.h = function (tag, attrs, children) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    [].concat(children || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  };

  App.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  // 本機儲存：每個模組用自己的 key，讀寫失敗時不讓頁面壞掉
  var PREFIX = 'yaozhi.';
  App.store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove: function (key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) {}
    }
  };

  App.renderHome = function (el) {
    var h = App.h;
    el.appendChild(h('section', { class: 'home-intro' }, [
      h('p', { class: 'lede', text: '選一個練習開始。答題記錄會留在這台裝置的瀏覽器裡。' })
    ]));
    var grid = h('div', { class: 'module-grid' });
    modules.forEach(function (m) {
      var ready = m.status === 'ready';
      var card = h(ready ? 'button' : 'div', {
        class: 'module-card' + (ready ? '' : ' is-soon'),
        type: ready ? 'button' : null,
        onclick: ready ? function () { App.go(m.id); } : null
      }, [
        h('span', { class: 'module-tag', text: ready ? '可以練習' : '即將推出' }),
        h('span', { class: 'module-title', text: m.title }),
        h('span', { class: 'module-sub', text: m.subtitle }),
        ready && m.summary ? m.summary() : null
      ]);
      grid.appendChild(card);
    });
    el.appendChild(grid);
  };
})();
