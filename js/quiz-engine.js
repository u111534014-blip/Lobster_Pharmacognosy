/*
 * 共用測驗引擎：設定畫面、作答、結果、答題記錄都在這裡。
 * 每個練習只要描述「題庫有哪些題目、怎麼出一題」，用 App.quizModule({...}) 註冊：
 *   id, title, storeKey          模組 id、名稱、記錄存放的 key
 *   unit                         錯題本單位（'科'、'題'…）
 *   subtitle()                   首頁卡片說明
 *   prepare()                    用題庫前先整理（試算表可能剛更新）
 *   ready()                      題目夠不夠出題；不夠時首頁顯示「準備中」，notReady() 說明原因
 *   dirs  [{v,label}]            出題方向（可省略）
 *   hint                         設定畫面的提示
 *   pool(dir)                    題目 id 清單
 *   make(id, dir)                出一題，回傳：
 *        { id, head, stem, stemClass, sub, ask, multi, optClass, options:[{label, correct}], answer, notes:[] }
 *   name(id), detail(id), detailClass   錯題本與記錄裡顯示的文字
 * 記錄格式（App.store[storeKey]）：stats { id: {c,w} }、wrong { id: {n,t} }、sessions [ {t, mode, total, correct} ]、settings { count, dir }
 * 綜合練習會透過 App.quizDefs 拿到每個練習，題目答對答錯記回各自的記錄。
 */
(function () {
  var h = App.h;
  var MIN = 5, MAX = 20;
  App.quizDefs = [];

  function loadKey(key) {
    var s = App.store.get(key, null) || {};
    s.stats = s.stats || {}; s.wrong = s.wrong || {}; s.sessions = s.sessions || [];
    s.settings = s.settings || { count: 10, dir: 'mix' };
    return s;
  }
  App.quizStore = { load: loadKey, save: function (key, s) { App.store.set(key, s); } };

  function pct(a, b) { return b ? Math.round((a / b) * 100) + '%' : '—'; }
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
  // 題目圖片放在 images/ 資料夾，試算表只寫檔名
  App.imageUrl = function (name) {
    return (App.config.imageDir || 'images/') + name.split('/').map(encodeURIComponent).join('/');
  };
  function imageEl(name) {
    var img = h('img', { class: 'specimen-img', src: App.imageUrl(name), alt: '題目圖片' });
    img.addEventListener('error', function () {
      img.replaceWith(h('p', { class: 'img-missing', text: '找不到圖片「' + name + '」，請確認 GitHub 的 images 資料夾裡有這個檔名（大小寫要一樣）。' }));
    });
    return img;
  }

  function fmtTime(t) {
    var d = new Date(t);
    function p(n) { return String(n).padStart(2, '0'); }
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  App.quizModule = function (def) {
    def.unit = def.unit || '題';
    def.ready = def.ready || function () { return true; };

    // 記錄存取；綜合練習會覆寫 records / recordAnswer
    function own() { return loadKey(def.storeKey); }
    var records = def.records || function () { return own(); };
    var recordAnswer = def.recordAnswer || function (id, ok, mode) {
      var s = own();
      var st = s.stats[id] || { c: 0, w: 0 };
      if (ok) st.c++; else st.w++;
      s.stats[id] = st;
      if (!ok) {
        var w = s.wrong[id] || { n: 0, t: 0 };
        w.n++; w.t = Date.now();
        s.wrong[id] = w;
      } else if (mode === 'review') {
        delete s.wrong[id];   // 錯題複習答對就移出錯題本
      }
      App.quizStore.save(def.storeKey, s);
    };
    var exists = def.exists || function (id) { return def.pool('mix').indexOf(id) >= 0; };
    function wrongIds(s) {
      // 題庫裡已刪掉的題先略過（不刪除記錄，加回來時會再出現）
      return Object.keys(s.wrong).filter(exists).sort(function (a, b) { return s.wrong[b].t - s.wrong[a].t; });
    }
    function totals(s) {
      var c = 0, w = 0;
      Object.keys(s.stats).forEach(function (id) { c += s.stats[id].c; w += s.stats[id].w; });
      return { c: c, w: w, n: c + w };
    }
    var pick = def.pick || function (ids, count) { return App.shuffle(ids).slice(0, count); };
    function buildQuiz(ids, count, dir) {
      return pick(ids, count).map(function (id) { return def.make(id, dir); });
    }

    // ---------- 設定 ----------
    function renderSetup(el) {
      var s = records(), t = totals(s), wIds = wrongIds(s);
      var settings = loadKey(def.storeKey).settings;
      el.appendChild(topbar(def.title));

      var countInput = h('input', {
        id: 'quiz-count', class: 'count-input', type: 'number', inputmode: 'numeric',
        min: MIN, max: MAX, step: 1, value: settings.count
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

      var dirs = typeof def.dirs === 'function' ? def.dirs() : def.dirs;
      var dirOk = dirs && dirs.some(function (d) { return d.v === settings.dir; });
      var dirGroup = dirs ? h('div', { class: 'seg', role: 'radiogroup', 'aria-label': def.dirLabel || '出題方向' }, dirs.map(function (d, i) {
        var id = 'dir-' + d.v;
        return h('label', { class: 'seg-item', for: id }, [
          h('input', { type: 'radio', name: 'dir', id: id, value: d.v, checked: dirOk ? settings.dir === d.v : i === 0 }),
          h('span', { text: d.label })
        ]);
      })) : null;
      function readDir() { var c = dirGroup && dirGroup.querySelector('input:checked'); return c ? c.value : 'mix'; }

      function start(mode) {
        var n = readCount();
        if (n == null) { countInput.focus(); return; }
        var dir = readDir();
        var st = loadKey(def.storeKey);
        st.settings = { count: n, dir: dir };
        App.quizStore.save(def.storeKey, st);
        var ids = mode === 'review' ? wrongIds(records()) : def.pool(dir);
        if (!ids.length) return;
        runQuiz(el, { mode: mode, questions: buildQuiz(ids, Math.min(n, ids.length), dir) });
      }

      el.appendChild(h('section', { class: 'panel setup' }, [
        h('div', { class: 'field' }, [
          h('label', { class: 'field-label', for: 'quiz-count', text: '題數（' + MIN + '–' + MAX + '）' }),
          h('div', { class: 'count-row' }, [countInput, presets]),
          msg
        ]),
        dirGroup ? h('div', { class: 'field' }, [h('span', { class: 'field-label', text: def.dirLabel || '出題方向' }), dirGroup]) : null,
        def.hint ? h('p', { class: 'hint', text: def.hint }) : null,
        h('div', { class: 'actions' }, [
          h('button', { type: 'button', class: 'btn primary', text: '開始測驗', onclick: function () { start('normal'); } }),
          h('button', {
            type: 'button', class: 'btn', disabled: !wIds.length,
            text: wIds.length ? '錯題複習（' + wIds.length + ' ' + def.unit + '）' : '錯題複習（目前沒有錯題）',
            onclick: function () { start('review'); }
          })
        ])
      ]));

      el.appendChild(h('section', { class: 'stat-strip' }, [
        stat('累計作答', t.n + ' 題'),
        stat('正確率', pct(t.c, t.n)),
        stat('錯題本', wIds.length + ' ' + def.unit),
        h('button', { type: 'button', class: 'link-btn', text: '查看記錄', onclick: function () { renderRecords(clear(el)); } })
      ]));
    }

    // ---------- 作答 ----------
    function runQuiz(el, quiz) {
      quiz.index = 0;
      quiz.results = [];
      showQuestion(el, quiz);
    }

    function finishSession(quiz) {
      if (!quiz.results.length) return;
      var s = loadKey(def.storeKey);
      s.sessions.unshift({
        t: Date.now(), mode: quiz.mode, total: quiz.results.length,
        correct: quiz.results.filter(function (r) { return r.ok; }).length
      });
      s.sessions = s.sessions.slice(0, 50);
      App.quizStore.save(def.storeKey, s);
    }

    function showQuestion(el, quiz) {
      clear(el);
      var q = quiz.questions[quiz.index];
      var n = quiz.questions.length;
      var answered = false;

      el.appendChild(topbar(quiz.mode === 'review' ? '錯題複習' : def.title,
        h('button', { type: 'button', class: 'link-btn', text: '結束', onclick: function () { finishSession(quiz); showResult(el, quiz); } })));

      el.appendChild(h('div', { class: 'progress', 'aria-label': '第 ' + (quiz.index + 1) + ' 題，共 ' + n + ' 題' }, [
        h('span', { class: 'progress-text', text: (quiz.index + 1) + ' / ' + n }),
        h('span', { class: 'progress-bar' }, [h('span', { class: 'progress-fill', style: 'width:' + (quiz.index / n * 100) + '%' })])
      ]));

      el.appendChild(h('div', { class: 'specimen' }, [
        h('div', { class: 'specimen-head' }, [
          h('span', { text: q.head }),
          h('span', { text: 'No. ' + String(quiz.index + 1).padStart(2, '0') })
        ]),
        q.image ? imageEl(q.image) : null,
        q.stem ? h('p', { class: 'specimen-name' + (q.stemClass ? ' ' + q.stemClass : ''), text: q.stem }) : null,
        q.sub ? h('p', { class: 'specimen-sub latin', text: q.sub }) : null,
        h('p', { class: 'specimen-ask', text: q.ask })
      ]));

      var list = h('div', { class: 'options' + (q.multi ? ' multi' : '') });
      var buttons = q.options.map(function (o) {
        var b = h('button', {
          type: 'button', class: 'option' + (q.optClass ? ' ' + q.optClass : ''),
          'aria-pressed': q.multi ? 'false' : null,
          onclick: function () {
            if (answered) return;
            if (q.multi) {
              b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
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
        var ok = true, wrongPick = false;
        buttons.forEach(function (b) {
          var picked = q.multi ? b.getAttribute('aria-pressed') === 'true' : b.classList.contains('picked');
          var correct = b._opt.correct;
          b.disabled = true;
          if (correct && picked) b.classList.add('is-right');
          else if (correct && !picked) { b.classList.add('is-missed'); ok = false; }
          else if (!correct && picked) { b.classList.add('is-wrong'); ok = false; wrongPick = true; }
        });
        recordAnswer(q.id, ok, quiz.mode);
        quiz.results.push({ q: q, ok: ok });
        feedback.className = 'feedback ' + (ok ? 'ok' : 'bad');
        feedback.innerHTML = '';
        feedback.appendChild(h('strong', { text: ok ? '答對了' : (wrongPick ? '答錯了' : '還有漏選') }));
        feedback.appendChild(h('span', { class: 'answer', text: q.answer }));
        (q.notes || []).forEach(function (t) { feedback.appendChild(h('span', { class: 'note', text: '備註　' + t })); });
        if (!ok) feedback.appendChild(h('span', { class: 'note', text: '已加入錯題本' }));
        else if (quiz.mode === 'review') feedback.appendChild(h('span', { class: 'note', text: '已從錯題本移除' }));
        confirmBtn.hidden = true;
        nextBtn.hidden = false;
        nextBtn.focus();
      }
    }

    // ---------- 結果 ----------
    function showResult(el, quiz) {
      clear(el);
      var total = quiz.results.length;
      var right = quiz.results.filter(function (r) { return r.ok; }).length;
      var wCount = wrongIds(records()).length;
      el.appendChild(topbar(quiz.mode === 'review' ? '複習結果' : '測驗結果'));
      el.appendChild(h('section', { class: 'result-head' }, [
        h('p', { class: 'score' }, [h('span', { class: 'score-big', text: String(right) }), h('span', { class: 'score-of', text: ' / ' + total })]),
        h('p', { class: 'lede', text: total ? '正確率 ' + pct(right, total) + '，錯題本目前有 ' + wCount + ' ' + def.unit + '。' : '這次沒有作答。' })
      ]));
      var wrongs = quiz.results.filter(function (r) { return !r.ok; });
      if (wrongs.length) {
        el.appendChild(h('h3', { class: 'section-title', text: '這次答錯的' }));
        el.appendChild(answerList(wrongs.map(function (r) { return r.q.id; })));
      }
      el.appendChild(h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'btn primary', text: '再練一次', onclick: function () { renderSetup(clear(el)); } }),
        wCount ? h('button', {
          type: 'button', class: 'btn', text: '錯題複習',
          onclick: function () {
            var st = loadKey(def.storeKey), ids = wrongIds(records());
            runQuiz(el, { mode: 'review', questions: buildQuiz(ids, Math.min(st.settings.count, ids.length), st.settings.dir) });
          }
        }) : null,
        h('button', { type: 'button', class: 'btn ghost', text: '回首頁', onclick: function () { App.go('home'); } })
      ]));
    }

    function answerList(ids, extra) {
      return h('ul', { class: 'answer-list' }, ids.map(function (id) {
        return h('li', {}, [
          h('span', { class: 'al-zh', text: def.name(id) }),
          h('span', { class: 'al-en' + (def.detailClass ? ' ' + def.detailClass : ''), text: def.detail(id) }),
          extra ? extra(id) : null
        ]);
      }));
    }

    // ---------- 記錄 ----------
    function renderRecords(el) {
      var s = records(), t = totals(s), wIds = wrongIds(s);
      var own_ = loadKey(def.storeKey);
      el.appendChild(topbar('答題記錄', h('button', {
        type: 'button', class: 'link-btn', text: '回設定', onclick: function () { renderSetup(clear(el)); }
      })));
      el.appendChild(h('section', { class: 'stat-strip' }, [
        stat('累計作答', t.n + ' 題'),
        stat('正確率', pct(t.c, t.n)),
        stat('錯題本', wIds.length + ' ' + def.unit)
      ]));

      el.appendChild(h('h3', { class: 'section-title', text: '錯題本' }));
      if (wIds.length) {
        el.appendChild(answerList(wIds, function (id) { return h('span', { class: 'al-count', text: '錯 ' + s.wrong[id].n + ' 次' }); }));
      } else {
        el.appendChild(h('p', { class: 'empty', text: '目前沒有錯題。答錯的題目會自動加進來，在「錯題複習」答對就會移除。' }));
      }

      var weak = Object.keys(s.stats)
        .map(function (id) { var x = s.stats[id]; return { id: id, c: x.c, w: x.w }; })
        .filter(function (x) { return x.w > 0 && exists(x.id); })
        .sort(function (a, b) { return (b.w / (b.c + b.w)) - (a.w / (a.c + a.w)) || b.w - a.w; })
        .slice(0, 10);
      if (weak.length) {
        el.appendChild(h('h3', { class: 'section-title', text: '最常錯的' }));
        el.appendChild(h('div', { class: 'table-wrap' }, [h('table', { class: 'data-table' }, [
          h('thead', {}, [h('tr', {}, [h('th', { text: '題目' }), h('th', { class: 'num', text: '對 / 錯' }), h('th', { class: 'num', text: '正確率' })])]),
          h('tbody', {}, weak.map(function (x) {
            return h('tr', {}, [
              h('td', { text: def.name(x.id) }),
              h('td', { class: 'num', text: x.c + ' / ' + x.w }), h('td', { class: 'num', text: pct(x.c, x.c + x.w) })
            ]);
          }))
        ])]));
      }

      el.appendChild(h('h3', { class: 'section-title', text: '最近的測驗' }));
      if (own_.sessions.length) {
        el.appendChild(h('div', { class: 'table-wrap' }, [h('table', { class: 'data-table' }, [
          h('thead', {}, [h('tr', {}, [h('th', { text: '時間' }), h('th', { text: '類型' }), h('th', { class: 'num', text: '得分' }), h('th', { class: 'num', text: '正確率' })])]),
          h('tbody', {}, own_.sessions.slice(0, 15).map(function (x) {
            return h('tr', {}, [
              h('td', { text: fmtTime(x.t) }), h('td', { text: x.mode === 'review' ? '錯題複習' : '一般測驗' }),
              h('td', { class: 'num', text: x.correct + ' / ' + x.total }), h('td', { class: 'num', text: pct(x.correct, x.total) })
            ]);
          }))
        ])]));
      } else {
        el.appendChild(h('p', { class: 'empty', text: '還沒有測驗記錄。' }));
      }

      if (def.noClear) return;
      // 清除記錄（頁面內確認，不用 confirm 對話框）
      var confirmRow = h('div', { class: 'danger-confirm', hidden: true }, [
        h('span', { text: '確定要清除「' + def.title + '」的答題記錄與錯題本嗎？此動作無法復原。' }),
        h('button', { type: 'button', class: 'btn danger', text: '清除', onclick: function () {
          App.store.set(def.storeKey, { settings: loadKey(def.storeKey).settings });
          renderRecords(clear(el));
        } }),
        h('button', { type: 'button', class: 'btn ghost', text: '取消', onclick: function () { confirmRow.hidden = true; resetBtn.hidden = false; } })
      ]);
      var resetBtn = h('button', { type: 'button', class: 'link-btn danger-link', text: '清除所有記錄', onclick: function () { confirmRow.hidden = false; resetBtn.hidden = true; } });
      el.appendChild(h('div', { class: 'reset-area' }, [resetBtn, confirmRow]));
    }

    def.wrongIds = function () { def.prepare && def.prepare(); return wrongIds(records()); };
    if (!def.mixed) App.quizDefs.push(def);
    App.registerModule({
      id: def.id,
      title: def.title,
      subtitle: function () { def.prepare && def.prepare(); return def.ready() ? def.subtitle() : def.notReady(); },
      status: function () { def.prepare && def.prepare(); return def.ready() ? 'ready' : 'waiting'; },
      render: function (el) { def.prepare && def.prepare(); renderSetup(el); },
      summary: function () {
        var s = records(), t = totals(s);
        return h('span', { class: 'module-meta', text: t.n ? '已作答 ' + t.n + ' 題 · 錯題本 ' + wrongIds(s).length + ' ' + def.unit : '尚未作答' });
      }
    });
    return def;
  };

  // 「看題幹，選出所有對的內容」的通用出題：entries = [{ key, stem, facts:[{cat, v}] }]
  // 選項 6 個，正確 1–4 個，其餘用別的題目的內容；同樣的內容出現在好幾題時，都算對
  App.factNorm = function (t) {
    return String(t).replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',');
  };
  App.factQuestion = function (entry, allEntries) {
    var mine = {}, myVals = [];
    entry.facts.forEach(function (f) { var k = App.factNorm(f.v); if (!mine[k]) { mine[k] = f.v; myVals.push(k); } });
    var seen = {}, others = [];
    allEntries.forEach(function (e) {
      e.facts.forEach(function (f) {
        var k = App.factNorm(f.v);
        if (mine[k] || seen[k]) return;
        seen[k] = true; others.push(f.v);
      });
    });
    others = App.shuffle(others);
    var k = Math.min(myVals.length, 1 + Math.floor(Math.random() * 4));
    var right = App.shuffle(myVals).slice(0, Math.max(k, 6 - others.length));
    return right.map(function (key) { return { label: mine[key], correct: true }; })
      .concat(others.slice(0, 6 - right.length).map(function (v) { return { label: v, correct: false }; }));
  };
  App.factDistractors = function (entry, allEntries) {
    var mine = {};
    entry.facts.forEach(function (f) { mine[App.factNorm(f.v)] = true; });
    var seen = {}, n = 0;
    allEntries.forEach(function (e) {
      e.facts.forEach(function (f) { var k = App.factNorm(f.v); if (!mine[k] && !seen[k]) { seen[k] = true; n++; } });
    });
    return n;
  };
  App.factAnswer = function (entry) {
    var groups = [], byCat = {};
    entry.facts.forEach(function (f) {
      if (!byCat[f.cat]) { byCat[f.cat] = []; groups.push(f.cat); }
      byCat[f.cat].push(f.v);
    });
    return groups.map(function (c) { return (groups.length > 1 || c ? c + '：' : '') + byCat[c].join('、'); }).join('\n');
  };
  // 「題幹 → 選出所有對的內容」的練習（植物個論、概論/通則…）
  // 資料：App.data[dataKey] = [{ stem, facts:[{cat, v}] }]，來自試算表一列一題
  App.factModule = function (o) {
    var MIN_ENTRIES = 4;
    var entries = [], byStem = {};
    function refresh() {
      entries = (App.data[o.dataKey] || []).filter(function (e) { return e.stem && e.facts && e.facts.length; });
      byStem = {};
      entries.forEach(function (e) { byStem[e.stem] = e; });
    }
    refresh();
    return App.quizModule({
      id: o.id, title: o.title, storeKey: o.storeKey, unit: o.unit,
      prepare: refresh,
      ready: function () { return entries.length >= MIN_ENTRIES; },
      notReady: function () { return '目前 ' + entries.length + ' ' + o.unit + o.noun + '，在試算表填滿 ' + MIN_ENTRIES + ' ' + o.unit + '就能開始練習'; },
      subtitle: function () { return entries.length + ' ' + o.unit + o.noun + '，' + o.blurb; },
      hint: '複選題，要把對的全部選到才算對。',
      pool: function () {
        return entries.filter(function (e) { return App.factDistractors(e, entries) >= 2; })
          .map(function (e) { return e.stem; });
      },
      exists: function (id) { return !!byStem[id]; },
      name: function (id) { var e = byStem[id]; return e.stemIsImage ? '（圖）' + e.facts[0].v : id; },
      detail: function (id) { return byStem[id].facts.map(function (f) { return f.v; }).join('、'); },
      make: function (id) {
        var e = byStem[id];
        var list = e.facts.map(function (f) { return f.v; }).join('、');
        if (e.stemIsImage) {
          return {
            id: id, head: o.head + ' · 圖', image: e.image, multi: true,
            ask: '選出所有符合這張圖的內容（可複選）', options: App.shuffle(App.factQuestion(e, entries)),
            answer: o.grouped ? App.factAnswer(e) : list
          };
        }
        // 有附圖的題目，一半機會改成看圖選名詞
        var named = entries.filter(function (x) { return x !== e && !x.stemIsImage; });
        if (e.image && named.length >= 3 && Math.random() < 0.5) {
          return {
            id: id, head: o.head + ' · 圖', image: e.image, multi: false,
            ask: '這張圖是哪一個？',
            options: App.shuffle([{ label: e.stem, correct: true }].concat(
              App.shuffle(named).slice(0, 3).map(function (x) { return { label: x.stem, correct: false }; }))),
            answer: e.stem + '：' + list
          };
        }
        return {
          id: id, head: o.head, stem: e.stem, stemClass: e.stem.length > 8 ? 'is-trait' : '', multi: true,
          ask: o.ask, options: App.shuffle(App.factQuestion(e, entries)),
          answer: o.grouped ? e.stem + '\n' + App.factAnswer(e) : e.stem + '：' + list
        };
      }
    });
  };
})();
