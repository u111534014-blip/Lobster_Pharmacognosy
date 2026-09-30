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
    App.currentView = id;
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

  // 題庫同步狀態（只有設定了試算表時才顯示）
  function bankStatus() {
    var h = App.h, b = App.bank || {};
    var text = b.syncing ? '正在從試算表更新題庫…'
      : b.error ? b.error
      : b.updatedAt ? '題庫更新於 ' + new Date(b.updatedAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '題庫：內建';
    return h('p', { class: 'bank-status' + (b.error ? ' is-error' : ''), id: 'bank-status' }, [
      h('span', { text: text }),
      b.syncing ? null : h('button', { type: 'button', class: 'link-btn', text: '立即更新', onclick: function () { App.syncBank(); } })
    ]);
  }
  // 題庫狀態改變時通知畫面；目前在首頁就更新首頁
  var bankListeners = [];
  App.onBank = function (fn) { bankListeners.push(fn); };
  App.emitBank = function (changed) { bankListeners.forEach(function (fn) { fn(!!changed); }); };
  App.onBank(function (changed) {
    if (App.currentView !== 'home') return;
    if (changed) { App.go('home'); return; }
    var old = document.getElementById('bank-status');
    if (old) old.replaceWith(bankStatus());
  });

  App.renderHome = function (el) {
    var h = App.h;
    el.appendChild(h('section', { class: 'home-intro' }, [
      h('p', { class: 'lede', text: '選一個練習開始。答題記錄會留在這台裝置的瀏覽器裡。' }),
      App.config && App.config.sheetUrl ? bankStatus() : null
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
        h('span', { class: 'module-sub', text: typeof m.subtitle === 'function' ? m.subtitle() : m.subtitle }),
        ready && m.summary ? m.summary() : null
      ]);
      grid.appendChild(card);
    });
    el.appendChild(grid);
  };
})();
