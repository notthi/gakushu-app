// 英検5級たいさく(たんご4択・あなうめ・ならべかえ)

const EK_STATE_KEYS = { word: 'ekWordState', fill: 'ekFillState', sort: 'ekSortState' };
const EK_MODE_LABEL = { word: 'たんご', nigate: 'にがてたんご', fill: 'あなうめ', sort: 'ならべかえ' };

const EK = {
  mode: 'word',
  dir: store.get('ekDir', 'e2j'),   // e2j: えいご→いみ / j2e: いみ→えいご
  queue: [],
  qIdx: 0,
  correctCount: 0,
  wrongList: [],
  answered: false,
  choices: [],
  sortPicked: []                    // ならべかえで選んだ単語のindex列
};

function ekWordStateAll() { return store.get('ekWordState', {}); }

function ekProgress() {
  const st = ekWordStateAll();
  let mastered = 0, nigate = 0;
  for (const e of EIKEN5_WORDS) {
    const s = st[e.e];
    if (!s || !s.seen) continue;
    if (s.streak >= 2) mastered++;
    else if (s.streak === 0) nigate++;
  }
  return { mastered: mastered, nigate: nigate, total: EIKEN5_WORDS.length };
}

function ekNigatePool() {
  const st = ekWordStateAll();
  return EIKEN5_WORDS.filter(e => {
    const s = st[e.e];
    return s && s.seen > 0 && s.streak === 0;
  });
}

// ---- 発音(えいごの読み上げ) ----
function ekSpeak(text) {
  if (!soundOn || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/A:|B:/g, ''));
    u.lang = 'en-US';
    u.rate = 0.85;
    speechSynthesis.speak(u);
  } catch (e) { /* 読み上げできない環境でも動作は続ける */ }
}

// ---- メニュー ----
function ekSetDir(d) {
  EK.dir = d;
  store.set('ekDir', d);
  document.querySelectorAll('#ek-dir-row .chip').forEach(c => c.classList.toggle('sel', c.dataset.dir === d));
}

function ekRefreshMenu() {
  const prog = ekProgress();
  document.getElementById('ek-gauge-fill').style.width = (prog.mastered / prog.total * 100) + '%';
  document.getElementById('ek-gauge-text').textContent =
    'おぼえた:' + prog.mastered + 'ご / ' + prog.total + 'ご';
  document.querySelectorAll('#ek-dir-row .chip').forEach(c => c.classList.toggle('sel', c.dataset.dir === EK.dir));
}

function ekBackToMenu() {
  ['ek-quiz', 'ek-sort', 'ek-result', 'ek-nigate'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('ek-menu').classList.remove('hidden');
  ekRefreshMenu();
}

// ---- 出題えらび(にがてなものほど出やすい重みづけ) ----
function ekWeight(s) {
  if (!s || !s.seen) return 3;
  if (s.streak === 0) return 5;
  if (s.streak === 1) return 2;
  return 1;
}

function ekPickWeighted(items, stateKey, idOf, count) {
  const st = store.get(stateKey, {});
  const pool = items.map(e => ({ e: e, w: ekWeight(st[idOf(e)]) }));
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) { idx = i; break; }
    }
    picked.push(pool[idx].e);
    pool.splice(idx, 1);
  }
  return picked;
}

function ekMarkState(stateKey, id, ok) {
  const st = store.get(stateKey, {});
  const s = st[id] || { seen: 0, streak: 0, ng: 0 };
  s.seen++;
  if (ok) s.streak++;
  else { s.streak = 0; s.ng++; }
  st[id] = s;
  store.set(stateKey, st);
}

// ---- スタート ----
function ekStart(mode) {
  EK.mode = mode;
  if (mode === 'word') {
    EK.queue = ekPickWeighted(EIKEN5_WORDS, EK_STATE_KEYS.word, e => e.e, 10);
  } else if (mode === 'nigate') {
    const pool = ekNigatePool();
    if (pool.length === 0) {
      alert('にがてな たんごは ないよ!すごい!');
      return;
    }
    EK.queue = shuffle(pool).slice(0, 10);
  } else if (mode === 'fill') {
    EK.queue = ekPickWeighted(EIKEN5_FILL, EK_STATE_KEYS.fill, e => e.id, 10);
  } else if (mode === 'sort') {
    EK.queue = ekPickWeighted(EIKEN5_SORT, EK_STATE_KEYS.sort, e => e.id, 5);
  }
  EK.qIdx = 0;
  EK.correctCount = 0;
  EK.wrongList = [];

  ['ek-menu', 'ek-result', 'ek-nigate', 'ek-quiz', 'ek-sort'].forEach(id => document.getElementById(id).classList.add('hidden'));
  if (mode === 'sort') {
    document.getElementById('ek-sort').classList.remove('hidden');
    ekShowSort();
  } else {
    document.getElementById('ek-quiz').classList.remove('hidden');
    ekShowQuestion();
  }
}

// ---- 4択クイズ(たんご・あなうめ) ----
function ekWordChoices(entry) {
  const keyF = EK.dir === 'e2j' ? (x => x.j) : (x => x.e);
  const correct = keyF(entry);
  let cands = EIKEN5_WORDS.filter(x => x.c === entry.c && keyF(x) !== correct);
  if (cands.length < 3) cands = EIKEN5_WORDS.filter(x => keyF(x) !== correct);
  const used = new Set([correct]);
  const wrongs = [];
  for (const x of shuffle(cands)) {
    const v = keyF(x);
    if (!used.has(v)) { used.add(v); wrongs.push(v); }
    if (wrongs.length === 3) break;
  }
  return { correct: correct, list: shuffle([correct, ...wrongs]) };
}

function ekFillHtml(entry, filled) {
  const blank = filled
    ? '<span class="ek-blank ok">' + escapeHtml(filled) + '</span>'
    : '<span class="ek-blank">(? )</span>'.replace('? ', '&nbsp;?&nbsp;');
  return escapeHtml(entry.q).replace('( )', blank);
}

function ekShowQuestion() {
  const entry = EK.queue[EK.qIdx];
  EK.answered = false;

  document.getElementById('ek-progress').textContent = (EK.qIdx + 1) + ' / ' + EK.queue.length + ' もん';
  const qEl = document.getElementById('ek-question');
  const subEl = document.getElementById('ek-sub');
  document.getElementById('ek-feedback').innerHTML = '';

  if (EK.mode === 'fill') {
    const opts = shuffle([entry.a, ...entry.w]);
    EK.choices = opts;
    EK.correctChoice = entry.a;
    qEl.className = 'ek-question sentence';
    qEl.innerHTML = ekFillHtml(entry, null);
    subEl.textContent = '(  )に はいるのは どれかな?';
  } else {
    const ch = ekWordChoices(entry);
    EK.choices = ch.list;
    EK.correctChoice = ch.correct;
    if (EK.dir === 'e2j') {
      qEl.className = 'ek-question';
      qEl.innerHTML = escapeHtml(entry.e) +
        ' <button class="speak-btn" onclick="ekSpeak(\'' + entry.e.replace(/'/g, "\\'") + '\')">🔊</button>';
      subEl.textContent = 'いみは どれかな?';
      ekSpeak(entry.e);
    } else {
      qEl.className = 'ek-question sentence';
      qEl.textContent = entry.j;
      subEl.textContent = 'えいごで どれかな?';
    }
  }

  document.getElementById('ek-choices').innerHTML = EK.choices.map((c, i) =>
    '<button class="choice-btn ek" id="ek-choice-' + i + '" onclick="ekAnswer(' + i + ')">' + escapeHtml(c) + '</button>'
  ).join('');
}

function ekAnswer(i) {
  if (EK.answered) return;
  EK.answered = true;
  const entry = EK.queue[EK.qIdx];
  const ok = EK.choices[i] === EK.correctChoice;

  EK.choices.forEach((c, j) => {
    const btn = document.getElementById('ek-choice-' + j);
    btn.disabled = true;
    if (c === EK.correctChoice) btn.classList.add('ok');
    else if (j === i) btn.classList.add('ng');
  });

  if (EK.mode === 'fill') {
    ekMarkState(EK_STATE_KEYS.fill, entry.id, ok);
    document.getElementById('ek-question').innerHTML = ekFillHtml(entry, entry.a);
    ekSpeak(entry.q.replace('( )', entry.a));
  } else {
    ekMarkState(EK_STATE_KEYS.word, entry.e, ok);
    if (EK.dir === 'j2e') ekSpeak(entry.e);
  }

  const fb = document.getElementById('ek-feedback');
  let info = '';
  if (EK.mode === 'fill') info = '<p class="ek-jp">' + escapeHtml(entry.j) + '</p>';
  else info = '<p class="ek-jp">' + escapeHtml(entry.e) + ' = ' + escapeHtml(entry.j) + '</p>';

  if (ok) {
    EK.correctCount++;
    playCorrect();
    fb.innerHTML = '<div class="fb-ok">⭕ せいかい!</div>' + info;
    setTimeout(ekNextQuestion, 1200);
  } else {
    EK.wrongList.push(entry);
    playWrong();
    fb.innerHTML = '<div class="fb-ng">❌ こたえは「' + escapeHtml(EK.correctChoice) + '」</div>' + info +
      '<button class="big-btn go" onclick="ekNextQuestion()">つぎへ</button>';
  }
}

function ekNextQuestion() {
  if (!EK.answered) return;
  if (document.getElementById('ek-quiz').classList.contains('hidden')) return;
  EK.qIdx++;
  if (EK.qIdx >= EK.queue.length) ekFinish();
  else ekShowQuestion();
}

function ekKeyChoice(i) { if (!EK.answered && i < EK.choices.length) ekAnswer(i); }
function ekKeyNext() { ekNextQuestion(); }

// ---- ならべかえ ----
function ekShowSort() {
  const entry = EK.queue[EK.qIdx];
  EK.answered = false;
  EK.sortPicked = [];

  // 正しい順と同じ並びにならないようにシャッフル
  let order = shuffle(entry.w.map((_, i) => i));
  for (let t = 0; t < 10 && order.every((v, i) => v === i); t++) order = shuffle(order);
  EK.sortOrder = order;   // pool表示順 → 元のindex

  document.getElementById('ek-sort-progress').textContent = (EK.qIdx + 1) + ' / ' + EK.queue.length + ' もん';
  document.getElementById('ek-sort-jp').textContent = entry.j;
  document.getElementById('ek-sort-feedback').innerHTML = '';
  const ans = document.getElementById('ek-sort-answer');
  ans.className = '';
  ekRenderSort();
}

function ekRenderSort() {
  const entry = EK.queue[EK.qIdx];
  const ans = document.getElementById('ek-sort-answer');
  const pool = document.getElementById('ek-sort-pool');

  ans.innerHTML = EK.sortPicked.map((wi, p) =>
    '<button class="sort-chip in-answer" onclick="ekSortRemove(' + p + ')">' + escapeHtml(entry.w[wi]) + '</button>'
  ).join('') + '<span class="ek-end-mark">' + entry.end + '</span>';

  pool.innerHTML = EK.sortOrder.map(wi =>
    EK.sortPicked.includes(wi)
      ? '<span class="sort-chip used">' + escapeHtml(entry.w[wi]) + '</span>'
      : '<button class="sort-chip" onclick="ekSortPick(' + wi + ')">' + escapeHtml(entry.w[wi]) + '</button>'
  ).join('');
}

function ekSortPick(wi) {
  if (EK.answered || EK.sortPicked.includes(wi)) return;
  EK.sortPicked.push(wi);
  ekRenderSort();
  const entry = EK.queue[EK.qIdx];
  if (EK.sortPicked.length === entry.w.length) ekSortCheck();
}

function ekSortRemove(p) {
  if (EK.answered) return;
  EK.sortPicked.splice(p, 1);
  ekRenderSort();
}

function ekSortCheck() {
  const entry = EK.queue[EK.qIdx];
  EK.answered = true;
  const made = EK.sortPicked.map(wi => entry.w[wi]).join(' ');
  const correctText = entry.w.join(' ');
  const ok = made === correctText || (entry.alt || []).includes(made);

  ekMarkState(EK_STATE_KEYS.sort, entry.id, ok);
  const ans = document.getElementById('ek-sort-answer');
  const fb = document.getElementById('ek-sort-feedback');
  ekSpeak(correctText);

  if (ok) {
    EK.correctCount++;
    playCorrect();
    ans.className = 'ok';
    fb.innerHTML = '<div class="fb-ok">⭕ せいかい!</div>';
    setTimeout(ekNextSort, 1200);
  } else {
    EK.wrongList.push(entry);
    playWrong();
    ans.className = 'ng';
    fb.innerHTML = '<div class="fb-ng">❌ せいかいは…</div>' +
      '<p class="ek-jp big">' + escapeHtml(correctText + entry.end) + '</p>' +
      '<button class="big-btn go" onclick="ekNextSort()">つぎへ</button>';
  }
}

function ekNextSort() {
  if (!EK.answered) return;
  if (document.getElementById('ek-sort').classList.contains('hidden')) return;
  EK.qIdx++;
  if (EK.qIdx >= EK.queue.length) ekFinish();
  else ekShowSort();
}

// ---- おわり・にがてちょう ----
function ekQuit() {
  if (!confirm('とちゅうで やめる?')) return;
  ekBackToMenu();
}

function ekFinish() {
  stampToday();
  ['ek-quiz', 'ek-sort'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('ek-result').classList.remove('hidden');

  const total = EK.queue.length;
  const title = document.getElementById('ek-result-title');
  if (EK.correctCount === total) {
    title.textContent = '🎉 ぜんもん せいかい!';
    playFanfare();
  } else {
    title.textContent = total + 'もん中 ' + EK.correctCount + 'もん せいかい!';
  }

  let html = '';
  if (EK.wrongList.length > 0) {
    html += '<p class="note">まちがえた もんだい</p>';
    html += EK.wrongList.map(e => {
      if (EK.mode === 'fill') return '<span class="nigate-item">' + escapeHtml(e.q.replace('( )', e.a)) + '<br><small>' + escapeHtml(e.j) + '</small></span>';
      if (EK.mode === 'sort') return '<span class="nigate-item">' + escapeHtml(e.w.join(' ') + e.end) + '<br><small>' + escapeHtml(e.j) + '</small></span>';
      return '<span class="nigate-item">' + escapeHtml(e.e) + ' <small>(' + escapeHtml(e.j) + ')</small></span>';
    }).join('');
  }
  const prog = ekProgress();
  html += '<p class="note">おぼえた たんご:' + prog.mastered + 'ご / ' + prog.total + 'ご</p>';
  document.getElementById('ek-result-body').innerHTML = html;
}

function ekShowNigate() {
  document.getElementById('ek-menu').classList.add('hidden');
  document.getElementById('ek-nigate').classList.remove('hidden');
  const pool = ekNigatePool();
  const list = document.getElementById('ek-nigate-list');
  if (pool.length === 0) {
    list.innerHTML = '<p class="note">にがてな たんごは ないよ!すごい!</p>';
  } else {
    list.innerHTML = '<p class="note">' + pool.length + 'ご あるよ。とっくんで なくそう!</p>' +
      pool.map(e => '<span class="nigate-item">' + escapeHtml(e.e) + ' <small>(' + escapeHtml(e.j) + ')</small></span>').join('');
  }
}
