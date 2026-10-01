/*
 * 功能模組：科名與植物特徵
 * 看科名選特徵 → 列出幾個特徵，選出屬於這一科的（複選）
 * 看特徵選科名 → 選出有這個特徵的所有科（複選；共同特徵要全選）
 * 題目來自試算表「植物特徵」工作表（App.data.traits）。
 * 同一個特徵要在每一科都用一樣的寫法，才會被當成共同特徵（括號全形半形、空白不影響）。
 * 記錄存在 App.store 的 'traitQuiz'，題目 id：'f:科名' 或 't:特徵'
 */
(function () {
  var MIN_FAMS = 4, OPTS = 6;
  var fams = [], traits = {}, items = {};

  function refresh() {
    var enByZh = {};
    App.data.families.forEach(function (f) { enByZh[f.zh] = f.en || []; });
    fams = []; traits = {}; items = {};
    var raw = App.data.traits || {};
    Object.keys(raw).forEach(function (zh) {
      var list = [];
      raw[zh].forEach(function (x) {
        var t = typeof x === 'string' ? { t: x, note: '' } : x;
        var key = App.factNorm(t.t);
        if (!key || list.indexOf(key) >= 0) return;
        list.push(key);
        var tr = traits[key] || (traits[key] = { key: key, label: t.t, fams: [], notes: [] });
        tr.fams.push(zh);
        if (t.note && tr.notes.indexOf(t.note) < 0) tr.notes.push(t.note);
      });
      if (list.length) fams.push({ zh: zh, en: enByZh[zh] || [], traits: list });
    });
    fams.forEach(function (f) { items['f:' + f.zh] = { type: 'f', fam: f }; });
    Object.keys(traits).forEach(function (k) { items['t:' + k] = { type: 't', trait: traits[k] }; });
  }
  refresh();

  function traitLabels(f) { return f.traits.map(function (k) { return traits[k].label; }).join('、'); }

  App.quizModule({
    id: 'family-traits',
    title: '科名與植物特徵',
    storeKey: 'traitQuiz',
    unit: '題',
    prepare: refresh,
    ready: function () { return fams.length >= MIN_FAMS; },
    notReady: function () { return '目前 ' + fams.length + ' 科有特徵，在試算表填滿 ' + MIN_FAMS + ' 科就能開始練習'; },
    subtitle: function () { return fams.length + ' 科、' + Object.keys(traits).length + ' 個特徵，看特徵選科名或看科名選特徵'; },
    dirs: [{ v: 'mix', label: '混合' }, { v: 'f2t', label: '看科名選特徵' }, { v: 't2f', label: '看特徵選科名' }],
    hint: '都是複選題，要把對的全部選到才算對。像二強雄蕊這種好幾科都有的特徵，每一科都要選。',
    pool: function (dir) {
      return Object.keys(items).filter(function (id) {
        if (dir === 'f2t' && id[0] !== 'f') return false;
        if (dir === 't2f' && id[0] !== 't') return false;
        // 看科名選特徵要有別科的特徵當干擾選項
        if (id[0] === 'f') return Object.keys(traits).length - items[id].fam.traits.length >= 2;
        return true;
      });
    },
    exists: function (id) { return !!items[id]; },
    name: function (id) { var it = items[id]; return it.type === 'f' ? it.fam.zh : it.trait.label; },
    detail: function (id) { var it = items[id]; return it.type === 'f' ? traitLabels(it.fam) : it.trait.fams.join('、'); },
    make: function (id) {
      var it = items[id];
      if (it.type === 'f') {
        var f = it.fam;
        var others = App.shuffle(Object.keys(traits).filter(function (k) { return f.traits.indexOf(k) < 0; }));
        // 正確選項 1–4 個，其餘用別科的特徵補到 6 個
        var k = Math.min(f.traits.length, 1 + Math.floor(Math.random() * 4));
        var right = App.shuffle(f.traits).slice(0, Math.max(k, OPTS - others.length));
        var opts = right.map(function (key) { return { label: traits[key].label, correct: true, key: key }; })
          .concat(others.slice(0, OPTS - right.length).map(function (key) { return { label: traits[key].label, correct: false }; }));
        return {
          id: id, head: '科', stem: f.zh, sub: f.en.join(' / '), multi: true,
          ask: '選出所有屬於這一科的特徵（可複選）',
          options: App.shuffle(opts),
          answer: f.zh + '：' + traitLabels(f),
          notes: right.filter(function (key) { return traits[key].notes.length; })
            .map(function (key) { return traits[key].label + '：' + traits[key].notes.join('；'); })
        };
      }
      var tr = it.trait;
      var rest = App.shuffle(fams.filter(function (x) { return tr.fams.indexOf(x.zh) < 0; }));
      return {
        id: id, head: '特徵', stem: tr.label, stemClass: 'is-trait', multi: true,
        ask: '選出所有有這個特徵的科（可複選）',
        options: App.shuffle(tr.fams.map(function (zh) { return { label: zh, correct: true }; })
          .concat(rest.slice(0, Math.max(3, OPTS - tr.fams.length)).map(function (x) { return { label: x.zh, correct: false }; }))),
        answer: tr.label + '：' + tr.fams.join('、'),
        notes: tr.notes
      };
    }
  });
})();
