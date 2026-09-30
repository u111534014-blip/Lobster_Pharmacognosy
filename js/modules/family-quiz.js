/*
 * 功能模組：科名配對
 * 題幹中文 → 選英文科名（有兩個英文名就要全選，複選）
 * 題幹英文 → 選中文科名（單選）
 * 紀錄存在 App.store 的 'familyQuiz'：
 *   stats  { 科id: { c: 答對次數, w: 答錯次數 } }
 *   wrong  { 科id: { n: 累計答錯, t: 最近答錯時間 } }   ← 錯題本
 *   sessions [ { t, mode, total, correct } ]          ← 最近 50 次
 *   settings { count, dir }
 */
(function () {
  var h = App.h;
  var KEY = 'familyQuiz';
  var MIN = 5, MAX = 20;
  var families = App.data.families.map(function (f) {
    return { id: f.en[0], zh: f.zh, en: f.en.slice() };
  });
  var byId = {};
  families.forEach(function (f) { byId[f.id] = f; });

  function load() {
    var s = App.store.get(KEY, null) || {};
    s.stats = s.stats || {};
    s.wrong = s.wrong || {};
    s.sessions = s.sessions || [];
    s.settings = s.settings || { count: 10, dir: 'mix' };
    // 資料檔若刪掉某科，錯題本裡對應的就略過
    Object.keys(s.wrong).forEach(function (id) { if (!byId[id]) delete s.wrong[id]; });
    return s;
  }
  function save(s) { App.store.set(KEY, s); }

  function wrongIds(s) {
    return Object.keys(s.wrong).sort(function (a, b) { return s.wrong[b].t - s.wrong[a].t; });
  }

  function totals(s) {
    var c = 0, w = 0;
    Object.keys(s.stats).forEach(function (id) { c += s.stats[id].c; w += s.stats[id].w; });
    return { c: c, w: w, n: c + w };
  }

  function pct(a, b) { return b ? Math.round((a / b) * 100) + '%' : '—'; }

  // ---------- 出題 ----------
  function makeQuestion(fam, dirSetting) {
    var dir = dirSetting === 'mix' ? (Math.random() < 0.5 ? 'zh2en' : 'en2zh') : dirSetting;
    var others = App.shuffle(families.filter(function (f) { return f.id !== fam.id; }));
    if (dir === 'zh2en') {
      var opts = fam.en.map(function (n) { return { label: n, correct: true }; });
      var i = 0;
      while (opts.length < 6 && i < others.length) {
        var o = others[i++];
        // 干擾選項：多名稱的科有時兩個都放、有時只放一個，避免「成對出現」的線索
        var names = o.en.length > 1 && Math.random() < 0.5 ? o.en : [o.en[Math.floor(Math.random() * o.en.length)]];
        names.forEach(function (n) { if (opts.length < 6) opts.push({ label: n, correct: false }); });
      }
      return { fam: fam, dir: dir, stem: fam.zh, multi: true, options: App.shuffle(opts) };
    }
    var stemName = fam.en[Math.floor(Math.random() * fam.en.length)];
    var zhOpts = [{ label: fam.zh, correct: true }].concat(
      others.slice(0, 3).map(function (o) { return { label: o.zh, correct: false }; })
    );
    return { fam: fam, dir: dir, stem: stemName, multi: false, options: App.shuffle(zhOpts) };
  }

  function buildQuiz(ids, count, dir) {
    return App.shuffle(ids).slice(0, count).map(function (id) { return makeQuestion(byId[id], dir); });
  }

  // ---------- 畫面：設定 ----------
  function renderSetup(el, params) {
    var s = load();
    var t = totals(s);
    var wIds = wrongIds(s);

    el.appendChild(topbar('科名配對'));

    var countInput = h('input', {
      id: 'quiz-count', class: 'count-input', type: 'number', inputmode: 'numeric',
      min: MIN, max: MAX, step: 1, value: s.settings.count
    });
    var msg = h('p', { class: 'field-msg', id: 'count-msg', role: 'status' });

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
      return h('button', {
        type: 'button', class: 'chip', text: n + ' 題',
        onclick: function () { countInput.value = n; readCount(); }
      });
    }));

    var dirs = [
      { v: 'mix', label: '中英混合' },
      { v: 'zh2en', label: '看中文選英文' },
      { v: 'en2zh', label: '看英文選中文' }
    ];
    var dirGroup = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '出題方向' }, dirs.map(function (d) {
      var id = 'dir-' + d.v;
      return h('label', { class: 'seg-item', for: id }, [
        h('input', { type: 'radio', name: 'dir', id: id, value: d.v, checked: s.settings.dir === d.v }),
        h('span', { text: d.label })
      ]);
    }));
    function readDir() {
      var c = dirGroup.querySelector('input:checked');
      return c ? c.value : 'mix';
    }

    function start(mode) {
      var n = readCount();
      if (n == null) { countInput.focus(); return; }
      var dir = readDir();
      var st = load();
      st.settings = { count: n, dir: dir };
      save(st);
      var pool = mode === 'review' ? wrongIds(st) : families.map(function (f) { return f.id; });
      if (!pool.length) return;
      runQuiz(el, { mode: mode, questions: buildQuiz(pool, Math.min(n, pool.length), dir) });
    }

    el.appendChild(h('section', { class: 'panel setup' }, [
      h('div', { class: 'field' }, [
        h('label', { class: 'field-label', for: 'quiz-count', text: '題數（' + MIN + '–' + MAX + '）' }),
        h('div', { class: 'count-row' }, [countInput, presets]),
        msg
      ]),
      h('div', { class: 'field' }, [
        h('span', { class: 'field-label', text: '出題方向' }),
        dirGroup
      ]),
      h('p', { class: 'hint', text: '看中文選英文時是複選題：有兩個英文科名（例如 Apiaceae 與 Umbelliferae）就要兩個都選。' }),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'btn primary', text: '開始測驗', onclick: function () { start('normal'); } }),
        h('button', {
          type: 'button', class: 'btn', disabled: !wIds.length,
          text: wIds.length ? '錯題複習（' + wIds.length + ' 科）' : '錯題複習（目前沒有錯題）',
          onclick: function () { start('review'); }
        })
      ])
    ]));

    el.appendChild(h('section', { class: 'stat-strip' }, [
      stat('累計作答', t.n + ' 題'),
      stat('正確率', pct(t.c, t.n)),
      stat('錯題本', wIds.length + ' 科'),
      h('button', { type: 'button', class: 'link-btn', text: '查看紀錄', onclick: function () { renderRecords(clear(el)); } })
    ]));
  }

  function stat(label, value) {
    return h('div', { class: 'stat' }, [
      h('span', { class: 'stat-label', text: label }),
      h('span', { class: 'stat-value', text: value })
    ]);
  }

  function clear(el) { el.innerHTML = ''; window.scrollTo(0, 0); return el; }

  function topbar(title, right) {
    return h('div', { class: 'topbar' }, [
      h('button', { type: 'button', class: 'link-btn', text: '← 首頁', onclick: function () { App.go('home'); } }),
      h('h2', { class: 'topbar-title', text: title }),
      right || h('span')
    ]);
  }

  // ---------- 畫面：作答 ----------
  function runQuiz(el, quiz) {
    quiz.index = 0;
    quiz.results = [];
    showQuestion(el, quiz);
  }

  function record(quiz, q, ok) {
    var s = load();
    var st = s.stats[q.fam.id] || { c: 0, w: 0 };
    if (ok) st.c++; else st.w++;
    s.stats[q.fam.id] = st;
    if (!ok) {
      var w = s.wrong[q.fam.id] || { n: 0, t: 0 };
      w.n++; w.t = Date.now();
      s.wrong[q.fam.id] = w;
    } else if (quiz.mode === 'review') {
      delete s.wrong[q.fam.id];   // 錯題複習答對就移出錯題本
    }
    save(s);
    quiz.results.push({ q: q, ok: ok });
  }

  function finishSession(quiz) {
    if (!quiz.results.length) return;
    var s = load();
    s.sessions.unshift({
      t: Date.now(), mode: quiz.mode,
      total: quiz.results.length,
      correct: quiz.results.filter(function (r) { return r.ok; }).length
    });
    s.sessions = s.sessions.slice(0, 50);
    save(s);
  }

  function showQuestion(el, quiz) {
    clear(el);
    var q = quiz.questions[quiz.index];
    var n = quiz.questions.length;
    var answered = false;

    el.appendChild(topbar(quiz.mode === 'review' ? '錯題複習' : '科名配對',
      h('button', {
        type: 'button', class: 'link-btn', text: '結束',
        onclick: function () { finishSession(quiz); showResult(el, quiz); }
      })));

    el.appendChild(h('div', { class: 'progress', 'aria-label': '第 ' + (quiz.index + 1) + ' 題，共 ' + n + ' 題' }, [
      h('span', { class: 'progress-text', text: (quiz.index + 1) + ' / ' + n }),
      h('span', { class: 'progress-bar' }, [
        h('span', { class: 'progress-fill', style: 'width:' + ((quiz.index) / n * 100) + '%' })
      ])
    ]));

    var label = h('div', { class: 'specimen' }, [
      h('div', { class: 'specimen-head' }, [
        h('span', { text: q.dir === 'zh2en' ? '科 · 中文' : 'Familia · English' }),
        h('span', { text: 'No. ' + String(quiz.index + 1).padStart(2, '0') })
      ]),
      h('p', { class: 'specimen-name' + (q.dir === 'en2zh' ? ' latin' : ''), text: q.stem }),
      h('p', { class: 'specimen-ask', text: q.multi ? '選出所有對應的英文科名（可複選）' : '選出對應的中文科名' })
    ]);
    el.appendChild(label);

    var list = h('div', { class: 'options' + (q.multi ? ' multi' : '') });
    var buttons = q.options.map(function (o) {
      var b = h('button', {
        type: 'button', class: 'option' + (q.dir === 'zh2en' ? ' latin' : ''),
        'aria-pressed': q.multi ? 'false' : null,
        onclick: function () {
          if (answered) return;
          if (q.multi) {
            var on = b.getAttribute('aria-pressed') === 'true';
            b.setAttribute('aria-pressed', on ? 'false' : 'true');
            confirmBtn.disabled = !list.querySelector('[aria-pressed="true"]');
          } else {
            b.classList.add('picked');
            submit();
          }
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
    el.appendChild(h('div', { class: 'actions sticky-actions' }, [feedback, q.multi ? confirmBtn : null, nextBtn]));

    function submit() {
      if (answered) return;
      answered = true;
      var ok = true;
      buttons.forEach(function (b) {
        var picked = q.multi ? b.getAttribute('aria-pressed') === 'true' : b.classList.contains('picked');
        var correct = b._opt.correct;
        b.disabled = true;
        if (correct && picked) b.classList.add('is-right');
        else if (correct && !picked) { b.classList.add('is-missed'); ok = false; }
        else if (!correct && picked) { b.classList.add('is-wrong'); ok = false; }
      });
      record(quiz, q, ok);
      var answer = q.fam.zh + '　=　' + q.fam.en.join(' / ');
      feedback.className = 'feedback ' + (ok ? 'ok' : 'bad');
      feedback.innerHTML = '';
      feedback.appendChild(h('strong', { text: ok ? '答對了' : (q.multi && hasMissOnly(buttons) ? '還有漏選' : '答錯了') }));
      feedback.appendChild(h('span', { class: 'answer', text: answer }));
      if (!ok) feedback.appendChild(h('span', { class: 'note', text: '已加入錯題本' }));
      else if (quiz.mode === 'review') feedback.appendChild(h('span', { class: 'note', text: '已從錯題本移除' }));
      confirmBtn.hidden = true;
      nextBtn.hidden = false;
      nextBtn.focus();
    }
  }

  function hasMissOnly(buttons) {
    return !buttons.some(function (b) { return b.classList.contains('is-wrong'); });
  }

  // ---------- 畫面：結果 ----------
  function showResult(el, quiz) {
    clear(el);
    var total = quiz.results.length;
    var right = quiz.results.filter(function (r) { return r.ok; }).length;
    var s = load();
    el.appendChild(topbar(quiz.mode === 'review' ? '複習結果' : '測驗結果'));

    el.appendChild(h('section', { class: 'result-head' }, [
      h('p', { class: 'score' }, [
        h('span', { class: 'score-big', text: String(right) }),
        h('span', { class: 'score-of', text: ' / ' + total })
      ]),
      h('p', { class: 'lede', text: total ? '正確率 ' + pct(right, total) + '，錯題本目前有 ' + wrongIds(s).length + ' 科。' : '這次沒有作答。' })
    ]));

    var wrongs = quiz.results.filter(function (r) { return !r.ok; });
    if (wrongs.length) {
      el.appendChild(h('h3', { class: 'section-title', text: '這次答錯的' }));
      el.appendChild(answerList(wrongs.map(function (r) { return r.q.fam; })));
    }

    el.appendChild(h('div', { class: 'actions' }, [
      h('button', { type: 'button', class: 'btn primary', text: '再練一次', onclick: function () { renderSetup(clear(el)); } }),
      wrongIds(s).length ? h('button', {
        type: 'button', class: 'btn', text: '錯題複習',
        onclick: function () {
          var st = load();
          var ids = wrongIds(st);
          runQuiz(el, { mode: 'review', questions: buildQuiz(ids, Math.min(st.settings.count, ids.length), st.settings.dir) });
        }
      }) : null,
      h('button', { type: 'button', class: 'btn ghost', text: '回首頁', onclick: function () { App.go('home'); } })
    ]));
  }

  function answerList(fams) {
    return h('ul', { class: 'answer-list' }, fams.map(function (f) {
      return h('li', {}, [
        h('span', { class: 'al-zh', text: f.zh }),
        h('span', { class: 'al-en latin', text: f.en.join(' / ') })
      ]);
    }));
  }

  // ---------- 畫面：紀錄 ----------
  function renderRecords(el) {
    var s = load();
    var t = totals(s);
    var wIds = wrongIds(s);
    el.appendChild(topbar('答題紀錄', h('button', {
      type: 'button', class: 'link-btn', text: '回設定', onclick: function () { renderSetup(clear(el)); }
    })));

    var practiced = Object.keys(s.stats).length;
    el.appendChild(h('section', { class: 'stat-strip' }, [
      stat('累計作答', t.n + ' 題'),
      stat('正確率', pct(t.c, t.n)),
      stat('練過的科', practiced + ' / ' + families.length),
      stat('錯題本', wIds.length + ' 科')
    ]));

    el.appendChild(h('h3', { class: 'section-title', text: '錯題本' }));
    if (wIds.length) {
      el.appendChild(h('ul', { class: 'answer-list' }, wIds.map(function (id) {
        var f = byId[id];
        return h('li', {}, [
          h('span', { class: 'al-zh', text: f.zh }),
          h('span', { class: 'al-en latin', text: f.en.join(' / ') }),
          h('span', { class: 'al-count', text: '錯 ' + s.wrong[id].n + ' 次' })
        ]);
      })));
    } else {
      el.appendChild(h('p', { class: 'empty', text: '目前沒有錯題。答錯的科會自動加進來，在「錯題複習」答對就會移除。' }));
    }

    var weak = Object.keys(s.stats)
      .map(function (id) { var x = s.stats[id]; return { id: id, c: x.c, w: x.w }; })
      .filter(function (x) { return x.w > 0 && byId[x.id]; })
      .sort(function (a, b) { return (b.w / (b.c + b.w)) - (a.w / (a.c + a.w)) || b.w - a.w; })
      .slice(0, 10);
    if (weak.length) {
      el.appendChild(h('h3', { class: 'section-title', text: '最常錯的科' }));
      el.appendChild(h('div', { class: 'table-wrap' }, [h('table', { class: 'data-table' }, [
        h('thead', {}, [h('tr', {}, [h('th', { text: '中文' }), h('th', { text: '英文' }), h('th', { class: 'num', text: '對 / 錯' }), h('th', { class: 'num', text: '正確率' })])]),
        h('tbody', {}, weak.map(function (x) {
          var f = byId[x.id];
          return h('tr', {}, [
            h('td', { text: f.zh }), h('td', { class: 'latin', text: f.en.join(' / ') }),
            h('td', { class: 'num', text: x.c + ' / ' + x.w }), h('td', { class: 'num', text: pct(x.c, x.c + x.w) })
          ]);
        }))
      ])]));
    }

    el.appendChild(h('h3', { class: 'section-title', text: '最近的測驗' }));
    if (s.sessions.length) {
      el.appendChild(h('div', { class: 'table-wrap' }, [h('table', { class: 'data-table' }, [
        h('thead', {}, [h('tr', {}, [h('th', { text: '時間' }), h('th', { text: '類型' }), h('th', { class: 'num', text: '得分' }), h('th', { class: 'num', text: '正確率' })])]),
        h('tbody', {}, s.sessions.slice(0, 15).map(function (x) {
          return h('tr', {}, [
            h('td', { text: fmtTime(x.t) }), h('td', { text: x.mode === 'review' ? '錯題複習' : '一般測驗' }),
            h('td', { class: 'num', text: x.correct + ' / ' + x.total }), h('td', { class: 'num', text: pct(x.correct, x.total) })
          ]);
        }))
      ])]));
    } else {
      el.appendChild(h('p', { class: 'empty', text: '還沒有測驗紀錄。' }));
    }

    // 清除紀錄（頁面內確認，不用 confirm 對話框）
    var confirmRow = h('div', { class: 'danger-confirm', hidden: true }, [
      h('span', { text: '確定要清除所有答題紀錄與錯題本嗎？此動作無法復原。' }),
      h('button', { type: 'button', class: 'btn danger', text: '清除', onclick: function () {
        var st = load();
        App.store.set(KEY, { settings: st.settings });
        renderRecords(clear(el));
      } }),
      h('button', { type: 'button', class: 'btn ghost', text: '取消', onclick: function () { confirmRow.hidden = true; resetBtn.hidden = false; } })
    ]);
    var resetBtn = h('button', { type: 'button', class: 'link-btn danger-link', text: '清除所有紀錄', onclick: function () { confirmRow.hidden = false; resetBtn.hidden = true; } });
    el.appendChild(h('div', { class: 'reset-area' }, [resetBtn, confirmRow]));
  }

  function fmtTime(t) {
    var d = new Date(t);
    function p(n) { return String(n).padStart(2, '0'); }
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  App.registerModule({
    id: 'family-quiz',
    title: '科名配對',
    subtitle: families.length + ' 科中英對照，自訂題數，錯題複習',
    status: 'ready',
    render: function (el) { renderSetup(el); },
    summary: function () {
      var s = load(); var t = totals(s);
      return h('span', { class: 'module-meta', text: t.n ? '已作答 ' + t.n + ' 題 · 錯題本 ' + wrongIds(s).length + ' 科' : '尚未作答' });
    }
  });
})();
