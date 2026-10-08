/*
 * 從 Google 試算表同步題庫。
 * 1. 先用上次同步存下來的題庫（沒網路也能用），沒有的話用內建的 families.js
 * 2. 每次打開 App 在背景抓最新的試算表，成功就存起來並更新畫面
 * 「科名」工作表欄位：中文科名、英文科名1、英文科名2（可再加英文科名3…）
 * 「植物特徵」工作表欄位：中文科名、特徵、備註（一個特徵一列；備註可空白，答題後會顯示）
 * 「植物個論」工作表：第一欄「中文植物名」是題幹，其他欄（學名、科別、藥用功效1…）都是答案
 * 「概論通則」工作表：第一欄「名詞」是題幹，其他欄（內容1、內容2…）都是答案
 * 「圖片」工作表：分組、名詞、圖片（檔名，空白時用「名詞.png」；可再加「圖片2」…）、說明（可空白）；看圖選名詞，選項只從同一組出
 * 「花」工作表：第一欄「名詞」（或「名詞/圖示」）是題幹，其他欄是答案
 */
(function () {
  var CACHE_KEY = 'bank';
  App.data.traits = App.data.traits || {};
  App.data.plants = App.data.plants || [];
  App.data.concepts = App.data.concepts || [];
  App.data.flowers = App.data.flowers || [];
  App.data.images = App.data.images || [];
  App.bank = { source: 'builtin', updatedAt: null, error: null, syncing: false };

  var cached = App.store.get(CACHE_KEY, null);
  if (cached && cached.families && cached.families.length) {
    App.data.families = cached.families;
    App.data.traits = cached.traits || {};
    App.data.plants = cached.plants || [];
    App.data.concepts = cached.concepts || [];
    App.data.flowers = cached.flowers || [];
    App.data.images = cached.images || [];
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

  // 第一欄名稱以題幹欄名開頭就算對上（例如「名詞/圖示」）
  function stemOk(header, stemHeader) {
    return !!header.length && header[0].replace(/\s/g, '').indexOf(stemHeader) === 0;
  }

  // 一列一題：第一欄（stemHeader）是題幹，其他有填的格子都是答案；欄名去掉數字當分類（藥用功效1 → 藥用功效）
  // 圖片：格子裡寫圖片檔名（例如 花托.jpg，圖放在 GitHub 的 images 資料夾），或放在「圖示」「圖片」欄
  //   第一欄是圖片 → 看圖選內容；其他欄是圖片 → 這一題有時改成看圖選名詞
  // 「分組」欄：同一組的名詞互相當選項，並多出「看內容選名詞」的題目
  var IMG = /\.(png|jpe?g|webp|gif|svg)$/i;
  function toEntries(rows, stemHeader) {
    var header = rows[0] || [];
    // 工作表名稱打錯時 Google 會回傳第一個工作表，所以要檢查第一欄
    if (!stemOk(header, stemHeader)) return [];
    var seen = {};
    return rows.slice(1).map(function (r) {
      var e = { stem: r[0] || '', facts: [] };
      if (IMG.test(e.stem)) { e.image = e.stem; e.stemIsImage = true; }
      r.forEach(function (cell, i) {
        var name = header[i] || '';
        if (i === 0 || !r[i]) return;
        if (name.replace(/\s/g, '') === '分組') { e.group = r[i]; return; }
        if (IMG.test(r[i]) || /圖示|圖片/.test(name)) { if (!e.image && IMG.test(r[i])) e.image = r[i]; return; }
        e.facts.push({ cat: name.replace(/\d+$/, '').trim(), v: r[i] });
      });
      return e;
    }).filter(function (e) {
      if (!e.stem || !e.facts.length || seen[e.stem]) return false;
      seen[e.stem] = true;
      return true;
    });
  }

  // 圖片配對：一張圖一筆 { group, name, image, note }
  // 同一個名詞有好幾張圖時，可以多加「圖片2」「圖片3」欄，或另外寫一列同樣的名詞
  function toImages(rows) {
    var header = rows[0] || [];
    var g = col(header, '分組'), n = col(header, '名詞'), note = col(header, '說明');
    var imgCols = header.map(function (x, i) { return /圖片|圖示|檔名/.test(x) ? i : -1; })
      .filter(function (i) { return i >= 0; });
    if (g < 0 || n < 0) return [];
    var seen = {}, out = [];
    rows.slice(1).forEach(function (r) {
      var group = r[g] || '', name = r[n] || '';
      if (!group || !name) return;
      var files = imgCols.map(function (i) { return r[i] || ''; }).filter(Boolean)
        .map(function (f) { return IMG.test(f) ? f : f + '.png'; });
      if (!files.length) files = [name + '.png'];
      files.forEach(function (file) {
        var k = group + '|' + file;
        if (seen[k]) return;
        seen[k] = true;
        out.push({ group: group, name: name, image: file, note: note >= 0 ? r[note] || '' : '' });
      });
    });
    return out;
  }
  function fetchImages(names) {
    var i = 0;
    function next() {
      if (i >= names.length) return Promise.resolve([]);
      return fetchSheet(names[i++]).catch(function () { return []; }).then(function (rows) {
        var list = toImages(rows);
        return list.length ? list : next();
      });
    }
    return next();
  }

  // 分頁名稱可能有不同寫法（例如「概論/通則」），依序試到第一欄對上為止
  function fetchEntries(names, stemHeader) {
    var i = 0;
    function next() {
      if (i >= names.length) return Promise.resolve([]);
      return fetchSheet(names[i++]).catch(function () { return []; }).then(function (rows) {
        var header = rows[0] || [];
        return stemOk(header, stemHeader) ? toEntries(rows, stemHeader) : next();
      });
    }
    return next();
  }

  App.syncBank = function () {
    if (!sheetCsvUrl(App.config.familySheet)) return Promise.resolve(false);
    App.bank.syncing = true;
    App.bank.error = null;
    App.emitBank();
    return Promise.all([
      fetchSheet(App.config.familySheet),
      fetchSheet(App.config.traitSheet).catch(function () { return []; }),
      fetchEntries([App.config.plantSheet, '植物個論', '個論'], '中文植物名'),
      fetchEntries([App.config.conceptSheet, '概論通則', '概論/通則', '概論、通則', '概論與通則', '概論 通則', '概論'], '名詞'),
      fetchEntries([App.config.flowerSheet, '花', '植物構造-花', '植物構造－花', '花的構造'], '名詞'),
      fetchImages([App.config.imageSheet, '圖片', '圖片配對', '圖'])
    ]).then(function (res) {
      var families = toFamilies(res[0]);
      if (families.length < 4) throw new Error('「' + App.config.familySheet + '」至少要有 4 科才能出題');
      var traits = toTraits(res[1]);
      var plants = res[2];
      var concepts = res[3];
      var flowers = res[4];
      var images = res[5];
      var changed = JSON.stringify([families, traits, plants, concepts, flowers, images]) !==
        JSON.stringify([App.data.families, App.data.traits, App.data.plants, App.data.concepts, App.data.flowers, App.data.images]);
      App.data.families = families;
      App.data.traits = traits;
      App.data.plants = plants;
      App.data.concepts = concepts;
      App.data.flowers = flowers;
      App.data.images = images;
      App.bank.source = 'sheet';
      App.bank.updatedAt = Date.now();
      App.store.set(CACHE_KEY, { t: App.bank.updatedAt, families: families, traits: traits, plants: plants, concepts: concepts, flowers: flowers, images: images });
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
