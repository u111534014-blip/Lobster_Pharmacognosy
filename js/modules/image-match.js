/*
 * 功能模組：圖片配對
 * 「圖片」工作表一列一張圖：分組、名詞、圖片、說明。題目顯示圖片，選出它是哪一個名詞；
 * 選項只從同一個分組裡出（例如花藥的六種型態），一組最多顯示 8 個選項。
 * 圖片檔放在 GitHub 的 images 資料夾。記錄存在 App.store 的 'imageQuiz'，題目 id：'分組|名詞'
 */
(function () {
  var items = [], byId = {}, groups = {}, order = [];
  function refresh() {
    items = []; byId = {}; groups = {}; order = [];
    (App.data.images || []).forEach(function (x) {
      if (!groups[x.group]) { groups[x.group] = []; order.push(x.group); }
      groups[x.group].push(x);
    });
    // 一組至少 2 張才能出題
    order = order.filter(function (g) { return groups[g].length >= 2; });
    order.forEach(function (g) {
      groups[g].forEach(function (x) { var id = g + '|' + x.name; items.push(id); byId[id] = x; });
    });
  }
  refresh();

  App.quizModule({
    id: 'image-match',
    title: '圖片配對',
    storeKey: 'imageQuiz',
    unit: '張',
    prepare: refresh,
    ready: function () { return items.length >= 2; },
    notReady: function () { return '在試算表「圖片」工作表填上分組和名詞，就能看圖練習'; },
    subtitle: function () { return items.length + ' 張圖、' + order.length + ' 組，看圖選出是哪一個'; },
    dirLabel: '範圍',
    dirs: function () {
      return [{ v: 'mix', label: '全部' }].concat(order.map(function (g) { return { v: 'g:' + g, label: g }; }));
    },
    hint: '選項只會從同一組裡出。',
    pool: function (dir) {
      if (dir && dir.indexOf('g:') === 0) {
        var g = dir.slice(2);
        return items.filter(function (id) { return byId[id].group === g; });
      }
      return items.slice();
    },
    exists: function (id) { return !!byId[id]; },
    name: function (id) { return byId[id].name; },
    detail: function (id) { return byId[id].group; },
    make: function (id) {
      var x = byId[id];
      var others = App.shuffle(groups[x.group].filter(function (y) { return y !== x; })).slice(0, 7);
      return {
        id: id, head: x.group, image: x.image, multi: false,
        ask: '這張圖是哪一個？',
        options: App.shuffle([{ label: x.name, correct: true }].concat(others.map(function (y) { return { label: y.name, correct: false }; }))),
        answer: x.name + (x.note ? '：' + x.note : ''),
        notes: []
      };
    }
  });
})();
