/*
 * 從 Google 試算表同步題庫。
 * 1. 先用上次同步存下來的題庫（沒網路也能用），沒有的話用內建的 families.js
 * 2. 每次打開 App 在背景抓最新的試算表，成功就存起來並更新畫面
 * 「科名」工作表欄位：中文科名、英文科名1、英文科名2（可再加英文科名3…）
 * 「植物特徵」工作表欄位：中文科名、特徵、備註（一個特徵一列；備註可空白，答題後會顯示）
 */
(function () {
  var CACHE_KEY = 'bank';
  App.data.traits = App.data.traits || {};
  App.bank = { source: 'builtin', updatedAt: null, error: null, syncing: false };

  var cached = App.store.get(CACHE_KEY, null);
  if (cached && cached.families && cached.families.length) {
    App.data.families = cached.families;
    App.data.traits = cached.traits || {};
    App.bank.source = 'sheet';
    App.bank.updatedAt = cached.t;
  }

  // 標準 CSV 解析（支援引號、逗號與換行）
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(function (r) { return r.map(function (x) { return x.trim(); }); })
      .filter(function (r) { return r.some(function (x) { return x; }); });
  }

  function sheetCsvUrl(sheetName) {
    var m = String(App.config.sheetUrl || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!m) return null;
    return 'https://docs.google.com/spreadsheets/d/' + m[1] +
      '/gviz/tq?tqx=out:csv&headers=1&sheet=' + encodeURIComponent(sheetName);
  }

  function fetchSheet(name) {
    return fetch(sheetCsvUrl(name), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('讀不到工作表「' + name + '」（' + r.status + '）');
      return r.text();
    }).then(parseCsv);
  }

  function col(header, name) {
    return header.findIndex(function (h) { return h.replace(/\s/g, '') === name; });
  }

  function toFamilies(rows) {
    var header = rows[0] || [];
    var zhCol = col(header, '中文科名');
    var enCols = header.map(function (h, i) { return /^英文科名/.test(h) ? i : -1; })
      .filter(function (i) { return i >= 0; });
    // 找不到欄位時通常是工作表名稱打錯（Google 會改回傳第一個工作表）
    if (zhCol < 0 || !enCols.length) throw new Error('「' + App.config.familySheet + '」工作表要有「中文科名」和「英文科名1」欄位');
    var seen = {};
    return rows.slice(1).map(function (r) {
      return { zh: r[zhCol] || '', en: enCols.map(function (i) { return r[i] || ''; }).filter(Boolean) };
    }).filter(function (f) {
      if (!f.zh || !f.en.length || seen[f.en[0]]) return false;
      seen[f.en[0]] = true;
      return true;
    });
  }

  function toTraits(rows) {
    var header = rows[0] || [];
    var zhCol = col(header, '中文科名'), tCol = col(header, '特徵'), nCol = col(header, '備註');
    if (zhCol < 0 || tCol < 0) return {};
    var out = {};
    rows.slice(1).forEach(function (r) {
      var zh = r[zhCol], t = r[tCol];
      if (!zh || !t) return;
      (out[zh] = out[zh] || []).push({ t: t, note: nCol >= 0 ? r[nCol] || '' : '' });
    });
    return out;
  }

  App.syncBank = function () {
    if (!sheetCsvUrl(App.config.familySheet)) return Promise.resolve(false);
    App.bank.syncing = true;
    App.bank.error = null;
    App.emitBank();
    return Promise.all([
      fetchSheet(App.config.familySheet),
      fetchSheet(App.config.traitSheet).catch(function () { return []; })
    ]).then(function (res) {
      var families = toFamilies(res[0]);
      if (families.length < 4) throw new Error('「' + App.config.familySheet + '」至少要有 4 科才能出題');
      var traits = toTraits(res[1]);
      var changed = JSON.stringify([families, traits]) !== JSON.stringify([App.data.families, App.data.traits]);
      App.data.families = families;
      App.data.traits = traits;
      App.bank.source = 'sheet';
      App.bank.updatedAt = Date.now();
      App.store.set(CACHE_KEY, { t: App.bank.updatedAt, families: families, traits: traits });
      return changed;
    }).catch(function (e) {
      // 連線失敗（沒網路、試算表沒開放檢視）時 fetch 會丟 TypeError
      App.bank.error = e instanceof TypeError
        ? '連不到試算表，先用' + (App.bank.source === 'sheet' ? '上次的' : '內建') + '題庫'
        : e.message;
      return false;
    }).then(function (changed) {
      App.bank.syncing = false;
      App.emitBank(changed);
      return changed;
    });
  };
})();
