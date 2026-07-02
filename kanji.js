// 漢字れんしゅう(読み3択クイズ)

const KJ_GRADES = {
  1: { data: KANJI_G1, key: 'kanjiState_g1', label: '1年生' },
  2: { data: KANJI_G2, key: 'kanjiState_g2', label: '2年生' },
  3: { data: KANJI_G3, key: 'kanjiState_g3', label: '3年生' }
};

const KJ = {
  grade: store.get('kjGrade', 1),
  drillType: 'normal',
  queue: [],       // 出題する漢字エントリの配列
  qIdx: 0,
  correctCount: 0,
  wrongList: [],
  answered: false,
  choices: []
};

function kjDataOf(g) { return KJ_GRADES[g].data; }
function kjStateOf(g) { return store.get(KJ_GRADES[g].key, {}); }

function kjProgressOf(g) {
  const data = kjDataOf(g);
  const st = kjStateOf(g);
  let mastered = 0, nigate = 0;
  for (const e of data) {
    const s = st[e.k];
    if (!s || !s.seen) continue;
    if (s.streak >= 2) mastered++;
    else if (s.streak === 0) nigate++;
  }
  return { mastered: mastered, nigate: nigate, total: data.length };
}

function kjState() { return kjStateOf(KJ.grade); }
function kjProgress() { return kjProgressOf(KJ.grade); }

function kjNigatePool() {
  const st = kjState();
  return kjDataOf(KJ.grade).filter(e => {
    const s = st[e.k];
    return s && s.seen > 0 && s.streak === 0;
  });
}

function kjSetGrade(g) {
  KJ.grade = g;
  store.set('kjGrade', g);
  document.querySelectorAll('#kj-grade-row .chip').forEach(c => c.classList.toggle('sel', Number(c.dataset.grade) === g));
  kjRefreshMenu();
}

function kjRefreshMenu() {
  document.getElementById('kj-menu-title').textContent =
    '✏️ かんじれんしゅう(' + KJ_GRADES[KJ.grade].label + ')';
  const prog = kjProgress();
  document.getElementById('kj-gauge-fill').style.width = (prog.mastered / prog.total * 100) + '%';
  document.getElementById('kj-gauge-text').textContent =
    'おぼえた:' + prog.mastered + '字 / ' + prog.total + '字';
}

function kjBackToMenu() {
  ['kj-quiz', 'kj-result', 'kj-nigate'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('kj-menu').classList.remove('hidden');
  document.querySelectorAll('#kj-grade-row .chip').forEach(c => c.classList.toggle('sel', Number(c.dataset.grade) === KJ.grade));
  kjRefreshMenu();
}

// 苦手な字ほど出やすい重みづけ
function kjWeight(s) {
  if (!s || !s.seen) return 3;   // まだやっていない
  if (s.streak === 0) return 5;  // 前に間違えた
  if (s.streak === 1) return 2;  // あと1回で「おぼえた」
  return 1;                      // おぼえた字もたまに出す
}

function kjPickQueue(count) {
  const st = kjState();
  const pool = kjDataOf(KJ.grade).map(e => ({ e: e, w: kjWeight(st[e.k]) }));
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

function kjStart(type) {
  KJ.drillType = type;
  if (type === 'nigate') {
    const pool = kjNigatePool();
    if (pool.length === 0) {
      alert('にがてな かんじは ないよ!すごい!');
      return;
    }
    KJ.queue = shuffle(pool).slice(0, 10);
  } else {
    KJ.queue = kjPickQueue(10);
  }
  KJ.qIdx = 0;
  KJ.correctCount = 0;
  KJ.wrongList = [];

  ['kj-menu', 'kj-result', 'kj-nigate'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('kj-quiz').classList.remove('hidden');
  kjShowQuestion();
}

function kjMakeChoices(entry) {
  // 正解と長さの近い読みをダミーにえらぶ
  const data = kjDataOf(KJ.grade);
  let cands = data.filter(e =>
    e.r !== entry.r && Math.abs(e.r.length - entry.r.length) <= 1);
  if (cands.length < 2) cands = data.filter(e => e.r !== entry.r);
  const used = new Set([entry.r]);
  const wrongs = [];
  for (const e of shuffle(cands)) {
    if (!used.has(e.r)) { used.add(e.r); wrongs.push(e.r); }
    if (wrongs.length === 2) break;
  }
  return shuffle([entry.r, ...wrongs]);
}

function kjShowQuestion() {
  const entry = KJ.queue[KJ.qIdx];
  KJ.answered = false;
  KJ.choices = kjMakeChoices(entry);

  document.getElementById('kj-progress').textContent = (KJ.qIdx + 1) + ' / ' + KJ.queue.length + ' もん';
  document.getElementById('kj-word').innerHTML =
    entry.w.replace(entry.k, '<span class="target">' + entry.k + '</span>');
  document.getElementById('kj-feedback').innerHTML = '';
  document.getElementById('kj-choices').innerHTML = KJ.choices.map((c, i) =>
    '<button class="choice-btn" id="kj-choice-' + i + '" onclick="kjAnswer(' + i + ')">' + c + '</button>'
  ).join('');
}

function kjAnswer(i) {
  if (KJ.answered) return;
  KJ.answered = true;
  const entry = KJ.queue[KJ.qIdx];
  const chosen = KJ.choices[i];
  const ok = chosen === entry.r;

  // ボタンの色づけ
  KJ.choices.forEach((c, j) => {
    const btn = document.getElementById('kj-choice-' + j);
    btn.disabled = true;
    if (c === entry.r) btn.classList.add('ok');
    else if (j === i) btn.classList.add('ng');
  });

  // 習熟度の更新
  const st = kjState();
  const s = st[entry.k] || { seen: 0, streak: 0, ng: 0 };
  s.seen++;
  if (ok) s.streak++;
  else { s.streak = 0; s.ng++; }
  st[entry.k] = s;
  store.set(KJ_GRADES[KJ.grade].key, st);

  const fb = document.getElementById('kj-feedback');
  if (ok) {
    KJ.correctCount++;
    playCorrect();
    fb.innerHTML = '<div class="fb-ok">⭕ せいかい!</div>';
    setTimeout(kjNextQuestion, 900);
  } else {
    KJ.wrongList.push(entry);
    playWrong();
    fb.innerHTML = '<div class="fb-ng">❌ こたえは「' + entry.r + '」</div>' +
      '<button class="big-btn go" onclick="kjNextQuestion()">つぎへ</button>';
  }
}

function kjNextQuestion() {
  if (!KJ.answered) return;
  if (document.getElementById('kj-quiz').classList.contains('hidden')) return;
  KJ.qIdx++;
  if (KJ.qIdx >= KJ.queue.length) kjFinish();
  else kjShowQuestion();
}

function kjKeyChoice(i) { if (!KJ.answered && i < KJ.choices.length) kjAnswer(i); }
function kjKeyNext() { kjNextQuestion(); }

function kjQuit() {
  if (!confirm('とちゅうで やめる?')) return;
  kjBackToMenu();
}

function kjFinish() {
  stampToday();
  document.getElementById('kj-quiz').classList.add('hidden');
  document.getElementById('kj-result').classList.remove('hidden');

  const total = KJ.queue.length;
  const title = document.getElementById('kj-result-title');
  if (KJ.correctCount === total) {
    title.textContent = '🎉 ぜんもん せいかい!';
    playFanfare();
  } else {
    title.textContent = total + 'もん中 ' + KJ.correctCount + 'もん せいかい!';
  }

  let html = '';
  if (KJ.wrongList.length > 0) {
    html += '<p class="note">まちがえた かんじ(にがてちょうに はいったよ)</p>';
    html += KJ.wrongList.map(e =>
      '<span class="nigate-item">' + e.w + ' <small>(' + e.r + ')</small></span>').join('');
  }
  const prog = kjProgress();
  html += '<p class="note">おぼえた:' + prog.mastered + '字 / ' + prog.total + '字</p>';
  document.getElementById('kj-result-body').innerHTML = html;
}

function kjShowNigate() {
  document.getElementById('kj-menu').classList.add('hidden');
  document.getElementById('kj-nigate').classList.remove('hidden');
  const pool = kjNigatePool();
  const list = document.getElementById('kj-nigate-list');
  if (pool.length === 0) {
    list.innerHTML = '<p class="note">にがてな かんじは ないよ!すごい!</p>';
  } else {
    list.innerHTML = '<p class="note">' + pool.length + '字 あるよ。とっくんで なくそう!</p>' +
      pool.map(e => '<span class="nigate-item">' + e.w + ' <small>(' + e.r + ')</small></span>').join('');
  }
}
