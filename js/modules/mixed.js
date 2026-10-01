/*
 * 功能模組：綜合練習
 * 把其他所有練習（App.quizDefs）的題目混在一起，各練習輪流抽題。
 * 答對答錯記回各自練習的記錄與錯題本；這裡只另外存測驗次數（'mixQuiz'）。
 * 題目 id：'練習id|原本的題目id'
 */
(function () {
  function sources() {
    return App.quizDefs.filter(function (d) { d.prepare && d.prepare(); return d.ready(); });
  }
  function split(id) {
    var i = id.indexOf('|');
    return { def: App.quizDefs.find(function (d) { return d.id === id.slice(0, i); }), id: id.slice(i + 1) };
  }
  function title(def) { return def.title; }

  App.quizModule({
    id: 'mixed',
    title: '綜合練習',
    storeKey: 'mixQuiz',
    unit: '題',
    mixed: true,
    noClear: true,
    prepare: function () { App.quizDefs.forEach(function (d) { d.prepare && d.prepare(); }); },
    ready: function () { return sources().length > 0; },
    notReady: function () { return '其他練習有題目後就能開始'; },
    subtitle: function () { return sources().map(title).join('、') + '的題目混在一起出'; },
    hint: '每個練習輪流抽題。答錯的題目會記到原本那個練習的錯題本。',
    pool: function () {
      var ids = [];
      sources().forEach(function (d) { d.pool('mix').forEach(function (id) { ids.push(d.id + '|' + id); }); });
      return ids;
    },
    // 各練習輪流抽，避免題目多的練習（例如科名）佔滿
    pick: function (ids, count) {
      var groups = {}, order = [];
      App.shuffle(ids).forEach(function (id) {
        var k = id.slice(0, id.indexOf('|'));
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(id);
      });
      var out = [];
      while (out.length < count) {
        var added = false;
        order.forEach(function (k) { if (out.length < count && groups[k].length) { out.push(groups[k].shift()); added = true; } });
        if (!added) break;
      }
      return App.shuffle(out);
    },
    exists: function (id) { var p = split(id); return !!p.def && p.def.ready() && p.def.exists(p.id); },
    name: function (id) { var p = split(id); return p.def.name(p.id); },
    detail: function (id) { var p = split(id); return p.def.title + '｜' + p.def.detail(p.id); },
    make: function (id) {
      var p = split(id);
      var q = p.def.make(p.id, 'mix');
      q.id = id;
      q.head = p.def.title + ' · ' + q.head;
      return q;
    },
    // 記錄：合併各練習的 stats / wrong（加上練習 id 前綴）
    records: function () {
      var out = { stats: {}, wrong: {}, sessions: [] };
      App.quizDefs.forEach(function (d) {
        var s = App.quizStore.load(d.storeKey);
        Object.keys(s.stats).forEach(function (id) { out.stats[d.id + '|' + id] = s.stats[id]; });
        Object.keys(s.wrong).forEach(function (id) { out.wrong[d.id + '|' + id] = s.wrong[id]; });
      });
      return out;
    },
    recordAnswer: function (id, ok, mode) {
      var p = split(id);
      var s = App.quizStore.load(p.def.storeKey);
      var st = s.stats[p.id] || { c: 0, w: 0 };
      if (ok) st.c++; else st.w++;
      s.stats[p.id] = st;
      if (!ok) {
        var w = s.wrong[p.id] || { n: 0, t: 0 };
        w.n++; w.t = Date.now();
        s.wrong[p.id] = w;
      } else if (mode === 'review') {
        delete s.wrong[p.id];
      }
      App.quizStore.save(p.def.storeKey, s);
    }
  });
})();
