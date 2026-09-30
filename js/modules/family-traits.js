/*
 * 功能模組：科名與植物特徵
 * 看科名選特徵 → 列出幾個特徵，選出屬於這一科的（複選）
 * 看特徵選科名 → 選出有這個特徵的所有科（複選；共同特徵要全選）
 * 題目來自試算表「植物特徵」工作表（App.data.traits）。
 * 同一個特徵要在每一科都用一樣的寫法，才會被當成共同特徵（括號全形半形、空白不影響）。
 * 記錄存在 App.store 的 'traitQuiz'，題目 id：'f:科名' 或 't:特徵'
 *   stats { id: { c, w } }  wrong { id: { n, t } }  sessions [ { t, mode, total, correct } ]  settings { count, dir }
 */
(function () {
  var h = App.h;
  var KEY = 'traitQuiz';
  var MIN = 5, MAX = 20, MIN_FAMS = 4, OPTS = 6;

  // ---------- 題庫整理 ----------
  var fams = [], traits = {}, items = {};
  function norm(t) {
    return String(t).replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',');
  }
  function refresh() {
    var enByZh = {};
    App.data.families.forEach(function (f) { enByZh[f.zh] = f.en || []; });
    fams = []; traits = {}; items = {};
    var raw = App.data.traits || {};
    Object.keys(raw).forEach(function (zh) {
      var list = [];
      raw[zh].forEach(function (x) {
        var t = typeof x === 'string' ? { t: x, note: '' } : x;
        var key = norm(t.t);
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
  function enough() { return fams.length >= MIN_FAMS; }

  function load() {
    var s = App.store.get(KEY, null) || {};
    s.stats = s.stats || {}; s.wrong = s.wrong || {}; s.sessions = s.sessions || [];
    s.settings = s.settings || { count: 10, dir: 'mix' };
    return s;
  }
  function save(s) { App.store.set(KEY, s); }
  function wrongIds(s) {
    // 題庫裡已刪掉的題先略過（不刪除記錄）
    return Object.keys(s.wrong).filter(function (id) { return items[id]; })
      .sort(function (a, b) { return s.wrong[b].t - s.wrong[a].t; });
  }
  function totals(s) {
    var c = 0, w = 0;
    Object.keys(s.stats).forEach(function (id) { c += s.stats[id].c; w += s.stats[id].w; });
    return { c: c, w: w, n: c + w };
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) + '%' : '—'; }
  function traitLabels(f) { return f.traits.map(function (k) { return traits[k].label; }).join('、'); }

  // ---------- 出題 ----------
  function makeQuestion(id) {
    var it = items[id];
    if (it.type === 'f') {
      var f = it.fam;
      var others = App.shuffle(Object.keys(traits).filter(function (k) { return f.traits.indexOf(k) < 0; }));
      // 正確選項 1–4 個，其餘用別科的特徵補到 6 個
      var k = Math.min(f.traits.length, 1 + Math.floor(Math.random() * 4));
      var right = App.shuffle(f.traits).slice(0, Math.max(k, OPTS - others.length));
      var opts = right.map(function (key) { return { label: traits[key].label, correct: true, key: key }; })
        .concat(others.slice(0, OPTS - right.length).map(function (key) { return { label: traits[key].label, correct: false, key: key }; }));
      return { id: id, type: 'f', fam: f, stem: f.zh, sub: f.en.join(' / '), options: App.shuffle(opts) };
    }
    var tr = it.trait;
    var rest = App.shuffle(fams.filter(function (x) { return tr.fams.indexOf(x.zh) < 0; }));
    var opts2 = tr.fams.map(function (zh) { return { label: zh, correct: true }; })
      .concat(rest.slice(0, Math.max(3, OPTS - tr.fams.length)).map(function (x) { return { label: x.zh, correct: false }; }));
    return { id: id, type: 't', trait: tr, stem: tr.label, options: App.shuffle(opts2) };
  }
  function pool(dir) {
    return Object.keys(items).filter(function (id) {
      if (dir === 'f2t' && id[0] !== 'f') return false;
      if (dir === 't2f' && id[0] !== 't') return false;
      // 看科名選特徵要有別科的特徵當干擾選項
      if (id[0] === 'f') return Object.keys(traits).length - items[id].fam.traits.length >= 2;
      return true;
    });
  }
  function buildQuiz(ids, count) {
    return App.shuffle(ids).slice(0, count).map(makeQuestion);
  }

  // ---------- 共用小元件 ----------
  function clear(el) { el.innerHTML = ''; window.scrollTo(0, 0); return el; }
  function topbar(title, right) {
    return h('div', { class: 'topbar' }, [
      h('button', { type: 'button', class: 'link-btn', text: '← 首頁', onclick: function () { App.go('home'); } }),
      h('h2', { class: 'topbar-title', text: title }),
      right || h('span')
    ]);
  }
  function stat(label, value) {
    return h('div', { class: 'stat' }, [
      h('span', { class: 'stat-label', text: label }),
      h('span', { class: 'stat-value', text: value })
    ]);
  }

  // ---------- 畫面：設定 ----------
  function renderSetup(el) {
    var s = load(), t = totals(s), wIds = wrongIds(s);
    el.appendChild(topbar('科名與植物特徵'));

    if (!enough()) {
      el.appendChild(h('section', { class: 'panel setup' }, [
        h('p', { class: 'lede', text: '試算表「植物特徵」目前有 ' + fams.length + ' 科填了特徵，至少要 ' + MIN_FAMS + ' 科才能出題。' }),
        h('p', { class: 'hint', text: '欄位：中文科名、特徵、備註。一個特徵一列；幾個科共有的特徵，每一科都用一樣的寫法填一次。' })
      ]));
      return;
    }

    var countInput = h('input', {
      id: 'trait-count', class: 'count-input', type: 'number', inputmode: 'numeric',
      min: MIN, max: MAX, step: 1, value: s.settings.count
    });
    var msg = h('p', { class: 'field-msg', role: 'status' });
    function readCount() {
      var n = parseInt(countInput.value, 10);
      if (isNaN(n) || n < MIN || n > MAX) {
        msg.textContent = '請輸入 ' + MIN + ' 到 ' + MAX + ' 之間的整數。';
        countInput.setAttribute('aria-invalid', 'true');
        return null;
      }
      msg.textContent = '';
      countInput.removeAttribute('aria-invalid');
      return n;
    }
    countInput.addEventListener('input', readCount);
    var presets = h('div', { class: 'chip-row' }, [5, 10, 15, 20].map(function (n) {
      return h('button', { type: 'button', class: 'chip', text: n + ' 題', onclick: function () { countInput.value = n; readCount(); } });
    }));

    var dirs = [{ v: 'mix', label: '混合' }, { v: 'f2t', label: '看科名選特徵' }, { v: 't2f', label: '看特徵選科名' }];
    var dirGroup = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '出題方向' }, dirs.map(function (d) {
      var id = 'tdir-' + d.v;
      return h('label', { class: 'seg-item', for: id }, [
        h('input', { type: 'radio', name: 'tdir', id: id, value: d.v, checked: s.settings.dir === d.v }),
        h('span', { text: d.label })
      ]);
    }));
    function readDir() { var c = dirGroup.querySelector('input:checked'); return c ? c.value : 'mix'; }

    function start(mode) {
      var n = readCount();
      if (n == null) { countInput.focus(); return; }
      var dir = readDir();
      var st = load();
      st.settings = { count: n, dir: dir };
      save(st);
      var ids = mode === 'review' ? wrongIds(st) : pool(dir);
      if (!ids.length) return;
      runQuiz(el, { mode: mode, questions: buildQuiz(ids, Math.min(n, ids.length)) });
    }

    el.appendChild(h('section', { class: 'panel setup' }, [
      h('div', { class: 'field' }, [
        h('label', { class: 'field-label', for: 'trait-count', text: '題數（' + MIN + '–' + MAX + '）' }),
        h('div', { class: 'count-row' }, [countInput, presets]),
        msg
      ]),
      h('div', { class: 'field' }, [h('span', { class: 'field-label', text: '出題方向' }), dirGroup]),
      h('p', { class: 'hint', text: '都是複選題，要把對的全部選到才算對。像二強雄蕊這種好幾科都有的特徵，每一科都要選。' }),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'btn primary', text: '開始測驗', onclick: function () { start('normal'); } }),
        h('button', {
          type: 'button', class: 'btn', disabled: !wIds.length,
          text: wIds.length ? '錯題複習（' + wIds.length + ' 題）' : '錯題複習（目前沒有錯題）',
          onclick: function () { start('review'); }
        })
      ])
    ]));

    el.appendChild(h('section', { class: 'stat-strip' }, [
      stat('累計作答', t.n + ' 題'),
      stat('正確率', pct(t.c, t.n)),
      stat('錯題本', wIds.length + ' 題'),
      h('button', { type: 'button', class: 'link-btn', text: '查看記錄', onclick: function () { renderRecords(clear(el)); } })
    ]));
  }

  // ---------- 畫面：作答 ----------
  function runQuiz(el, quiz) {
    quiz.index = 0;
    quiz.results = [];
    showQuestion(el, quiz);
  }

  function record(quiz, q, ok) {
    var s = load();
    var st = s.stats[q.id] || { c: 0, w: 0 };
    if (ok) st.c++; else st.w++;
    s.stats[q.id] = st;
    if (!ok) {
      var w = s.wrong[q.id] || { n: 0, t: 0 };
      w.n++; w.t = Date.now();
      s.wrong[q.id] = w;
    } else if (quiz.mode === 'review') {
      delete s.wrong[q.id];   // 錯題複習答對就移出錯題本
    }
    save(s);
    quiz.results.push({ q: q, ok: ok });
  }

  function finishSession(quiz) {
    if (!quiz.results.length) return;
    var s = load();
    s.sessions.unshift({
      t: Date.now(), mode: quiz.mode, total: quiz.results.length,
      correct: quiz.results.filter(function (r) { return r.ok; }).length
    });
    s.sessions = s.sessions.slice(0, 50);
    save(s);
  }

  function answerText(q) {
    return q.type === 'f' ? q.fam.zh + '：' + traitLabels(q.fam) : q.trait.label + '：' + q.trait.fams.join('、');
  }
  function notesOf(q) {
    if (q.type === 't') return q.trait.notes;
    return q.options.filter(function (o) { return o.correct && traits[o.key].notes.length; })
      .map(function (o) { return traits[o.key].label + '：' + traits[o.key].notes.join('；'); });
  }

  function showQuestion(el, quiz) {
    clear(el);
    var q = quiz.questions[quiz.index];
    var n = quiz.questions.length;
    var answered = false;

    el.appendChild(topbar(quiz.mode === 'review' ? '錯題複習' : '科名與植物特徵',
      h('button', { type: 'button', class: 'link-btn', text: '結束', onclick: function () { finishSession(quiz); showResult(el, quiz); } })));

    el.appendChild(h('div', { class: 'progress', 'aria-label': '第 ' + (quiz.index + 1) + ' 題，共 ' + n + ' 題' }, [
      h('span', { class: 'progress-text', text: (quiz.index + 1) + ' / ' + n }),
      h('span', { class: 'progress-bar' }, [h('span', { class: 'progress-fill', style: 'width:' + (quiz.index / n * 100) + '%' })])
    ]));

    el.appendChild(h('div', { class: 'specimen' }, [
      h('div', { class: 'specimen-head' }, [
        h('span', { text: q.type === 'f' ? '科' : '特徵' }),
        h('span', { text: 'No. ' + String(quiz.index + 1).padStart(2, '0') })
      ]),
      h('p', { class: 'specimen-name' + (q.type === 't' ? ' is-trait' : ''), text: q.stem }),
      q.sub ? h('p', { class: 'specimen-sub latin', text: q.sub }) : null,
      h('p', { class: 'specimen-ask', text: q.type === 'f' ? '選出所有屬於這一科的特徵（可複選）' : '選出所有有這個特徵的科（可複選）' })
    ]));

    var list = h('div', { class: 'options multi' });
    var buttons = q.options.map(function (o) {
      var b = h('button', {
        type: 'button', class: 'option', 'aria-pressed': 'false',
        onclick: function () {
          if (answered) return;
          b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
          confirmBtn.disabled = !list.querySelector('[aria-pressed="true"]');
        }
      }, [h('span', { class: 'option-mark', 'aria-hidden': 'true' }), h('span', { text: o.label })]);
      b._opt = o;
      list.appendChild(b);
      return b;
    });
    el.appendChild(list);

    var feedback = h('div', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
    var confirmBtn = h('button', { type: 'button', class: 'btn primary', text: '確認答案', disabled: true, onclick: submit });
    var nextBtn = h('button', {
      type: 'button', class: 'btn primary', hidden: true,
      text: quiz.index + 1 < n ? '下一題' : '看結果',
      onclick: function () {
        quiz.index++;
        if (quiz.index < n) showQuestion(el, quiz);
        else { finishSession(quiz); showResult(el, quiz); }
      }
    });
    el.appendChild(h('div', { class: 'actions sticky-actions' }, [feedback, confirmBtn, nextBtn]));

    function submit() {
      if (answered) return;
      answered = true;
      var ok = true, wrongPick = false;
      buttons.forEach(function (b) {
        var picked = b.getAttribute('aria-pressed') === 'true';
        var correct = b._opt.correct;
        b.disabled = true;
        if (correct && picked) b.classList.add('is-right');
        else if (correct && !picked) { b.classList.add('is-missed'); ok = false; }
        else if (!correct && picked) { b.classList.add('is-wrong'); ok = false; wrongPick = true; }
      });
      record(quiz, q, ok);
      feedback.className = 'feedback ' + (ok ? 'ok' : 'bad');
      feedback.innerHTML = '';
      feedback.appendChild(h('strong', { text: ok ? '答對了' : (wrongPick ? '答錯了' : '還有漏選') }));
      feedback.appendChild(h('span', { class: 'answer', text: answerText(q) }));
      notesOf(q).forEach(function (t) { feedback.appendChild(h('span', { class: 'note', text: '備註　' + t })); });
      if (!ok) feedback.appendChild(h('span', { class: 'note', text: '已加入錯題本' }));
      else if (quiz.mode === 'review') feedback.appendChild(h('span', { class: 'note', text: '已從錯題本移除' }));
      confirmBtn.hidden = true;
      nextBtn.hidden = false;
      nextBtn.focus();
    }
  }

  // ---------- 畫面：結果 ----------
  function showResult(el, quiz) {
    clear(el);
    var total = quiz.results.length;
    var right = quiz.results.filter(function (r) { return r.ok; }).length;
    var s = load();
    el.appendChild(topbar(quiz.mode === 'review' ? '複習結果' : '測驗結果'));
    el.appendChild(h('section', { class: 'result-head' }, [
      h('p', { class: 'score' }, [h('span', { class: 'score-big', text: String(right) }), h('span', { class: 'score-of', text: ' / ' + total })]),
      h('p', { class: 'lede', text: total ? '正確率 ' + pct(right, total) + '，錯題本目前有 ' + wrongIds(s).length + ' 題。' : '這次沒有作答。' })
    ]));
    var wrongs = quiz.results.filter(function (r) { return !r.ok; });
    if (wrongs.length) {
      el.appendChild(h('h3', { class: 'section-title', text: '這次答錯的' }));
      el.appendChild(h('ul', { class: 'answer-list' }, wrongs.map(function (r) {
        return h('li', {}, [h('span', { class: 'al-zh', text: answerText(r.q) })]);
      })));
    }
    el.appendChild(h('div', { class: 'actions' }, [
      h('button', { type: 'button', class: 'btn primary', text: '再練一次', onclick: function () { renderSetup(clear(el)); } }),
      wrongIds(s).length ? h('button', {
        type: 'button', class: 'btn', text: '錯題複習',
        onclick: function () {
          var st = load(), ids = wrongIds(st);
          runQuiz(el, { mode: 'review', questions: buildQuiz(ids, Math.min(st.settings.count, ids.length)) });
        }
      }) : null,
      h('button', { type: 'button', class: 'btn ghost', text: '回首頁', onclick: function () { App.go('home'); } })
    ]));
  }

  // ---------- 畫面：記錄 ----------
  function renderRecords(el) {
    var s = load(), t = totals(s), wIds = wrongIds(s);
    el.appendChild(topbar('答題記錄', h('button', {
      type: 'button', class: 'link-btn', text: '回設定', onclick: function () { renderSetup(clear(el)); }
    })));
    el.appendChild(h('section', { class: 'stat-strip' }, [
      stat('累計作答', t.n + ' 題'),
      stat('正確率', pct(t.c, t.n)),
      stat('錯題本', wIds.length + ' 題')
    ]));
    el.appendChild(h('h3', { class: 'section-title', text: '錯題本' }));
    if (wIds.length) {
      el.appendChild(h('ul', { class: 'answer-list' }, wIds.map(function (id) {
        var it = items[id];
        return h('li', {}, [
          h('span', { class: 'al-zh', text: it.type === 'f' ? it.fam.zh : it.trait.label }),
          h('span', { class: 'al-en', text: it.type === 'f' ? traitLabels(it.fam) : it.trait.fams.join('、') }),
          h('span', { class: 'al-count', text: '錯 ' + s.wrong[id].n + ' 次' })
        ]);
      })));
    } else {
      el.appendChild(h('p', { class: 'empty', text: '目前沒有錯題。答錯的題目會自動加進來，在「錯題複習」答對就會移除。' }));
    }

    // 清除記錄（頁面內確認）
    var confirmRow = h('div', { class: 'danger-confirm', hidden: true }, [
      h('span', { text: '確定要清除這個練習的答題記錄與錯題本嗎？此動作無法復原。' }),
      h('button', { type: 'button', class: 'btn danger', text: '清除', onclick: function () {
        App.store.set(KEY, { settings: load().settings });
        renderRecords(clear(el));
      } }),
      h('button', { type: 'button', class: 'btn ghost', text: '取消', onclick: function () { confirmRow.hidden = true; resetBtn.hidden = false; } })
    ]);
    var resetBtn = h('button', { type: 'button', class: 'link-btn danger-link', text: '清除所有記錄', onclick: function () { confirmRow.hidden = false; resetBtn.hidden = true; } });
    el.appendChild(h('div', { class: 'reset-area' }, [resetBtn, confirmRow]));
  }

  App.registerModule({
    id: 'family-traits',
    title: '科名與植物特徵',
    subtitle: function () {
      refresh();
      return enough()
        ? fams.length + ' 科、' + Object.keys(traits).length + ' 個特徵，看特徵選科名或看科名選特徵'
        : '看特徵選科名或看科名選特徵（目前 ' + fams.length + ' 科有特徵，滿 ' + MIN_FAMS + ' 科就能出題）';
    },
    status: 'ready',
    render: function (el) { refresh(); renderSetup(el); },
    summary: function () {
      var s = load(), t = totals(s);
      return h('span', { class: 'module-meta', text: t.n ? '已作答 ' + t.n + ' 題 · 錯題本 ' + wrongIds(s).length + ' 題' : '尚未作答' });
    }
  });
})();
