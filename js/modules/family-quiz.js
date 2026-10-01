/*
 * 功能模組：科名配對
 * 題幹中文 → 選英文科名（有兩個英文名就要全選，複選）
 * 題幹英文 → 選中文科名（單選）
 * 記錄存在 App.store 的 'familyQuiz'，題目 id 是第一個英文科名
 */
(function () {
  // 題庫可能在 App 開著時從試算表更新，所以每次用到前重新整理
  var families = [], byId = {};
  function refresh() {
    families = App.data.families.filter(function (f) { return f.zh && f.en && f.en.length; })
      .map(function (f) { return { id: f.en[0], zh: f.zh, en: f.en.slice() }; });
    byId = {};
    families.forEach(function (f) { byId[f.id] = f; });
  }
  refresh();

  App.quizModule({
    id: 'family-quiz',
    title: '科名配對',
    storeKey: 'familyQuiz',
    unit: '科',
    prepare: refresh,
    ready: function () { return families.length >= 4; },
    notReady: function () { return '科名至少要 4 科才能出題'; },
    subtitle: function () { return families.length + ' 科中英對照，自訂題數，錯題複習'; },
    dirs: [
      { v: 'mix', label: '中英混合' },
      { v: 'zh2en', label: '看中文選英文' },
      { v: 'en2zh', label: '看英文選中文' }
    ],
    hint: '看中文選英文時是複選題：有兩個英文科名（例如 Apiaceae 與 Umbelliferae）就要兩個都選。',
    pool: function () { return families.map(function (f) { return f.id; }); },
    exists: function (id) { return !!byId[id]; },
    name: function (id) { return byId[id].zh; },
    detail: function (id) { return byId[id].en.join(' / '); },
    detailClass: 'latin',
    make: function (id, dirSetting) {
      var fam = byId[id];
      var dir = dirSetting === 'zh2en' || dirSetting === 'en2zh' ? dirSetting : (Math.random() < 0.5 ? 'zh2en' : 'en2zh');
      var others = App.shuffle(families.filter(function (f) { return f.id !== fam.id; }));
      var q = { id: id, answer: fam.zh + '　=　' + fam.en.join(' / ') };
      if (dir === 'zh2en') {
        var opts = fam.en.map(function (n) { return { label: n, correct: true }; });
        var i = 0;
        while (opts.length < 6 && i < others.length) {
          var o = others[i++];
          // 干擾選項：多名稱的科有時兩個都放、有時只放一個，避免「成對出現」的線索
          var names = o.en.length > 1 && Math.random() < 0.5 ? o.en : [o.en[Math.floor(Math.random() * o.en.length)]];
          names.forEach(function (n) { if (opts.length < 6) opts.push({ label: n, correct: false }); });
        }
        q.head = '科 · 中文'; q.stem = fam.zh; q.multi = true; q.optClass = 'latin';
        q.ask = '選出所有對應的英文科名（可複選）';
        q.options = App.shuffle(opts);
        return q;
      }
      q.head = 'Familia · English';
      q.stem = fam.en[Math.floor(Math.random() * fam.en.length)];
      q.stemClass = 'latin'; q.multi = false;
      q.ask = '選出對應的中文科名';
      q.options = App.shuffle([{ label: fam.zh, correct: true }].concat(
        others.slice(0, 3).map(function (o) { return { label: o.zh, correct: false }; })
      ));
      return q;
    }
  });
})();
