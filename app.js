// 共通:画面切り替え・保存・音・記録表示

const store = {
  get(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'screen-records') renderRecords();
  if (id === 'screen-hyakumasu') hmShowSetup();
  if (id === 'screen-kanji') kjBackToMenu();
  if (id === 'screen-map') mpShowSetup();
  if (id === 'screen-home') renderHome();
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function stampToday() {
  const days = store.get('practiceDays', []);
  const t = todayStr();
  if (!days.includes(t)) { days.push(t); store.set('practiceDays', days); }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- 音 ----
let soundOn = store.get('soundOn', true);
let _actx = null;
function audioCtx() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  return _actx;
}
function beep(freq, dur, type = 'sine', delay = 0) {
  if (!soundOn) return;
  try {
    const ctx = audioCtx();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  } catch (e) { /* 音が出せない環境でも動作は続ける */ }
}
function playCorrect() { beep(880, .12); beep(1318, .18, 'sine', .1); }
function playWrong() { beep(196, .3, 'square'); }
function playFanfare() { beep(784, .15); beep(988, .15, 'sine', .15); beep(1175, .35, 'sine', .3); }

function toggleSound() {
  soundOn = !soundOn;
  store.set('soundOn', soundOn);
  updateSoundBtn();
}
function updateSoundBtn() {
  document.getElementById('sound-toggle').textContent = soundOn ? '🔊 おと:ON' : '🔇 おと:OFF';
}

// ---- ホーム ----
function renderHome() {
  const days = store.get('practiceDays', []);
  const msg = document.getElementById('home-message');
  if (days.includes(todayStr())) {
    msg.textContent = 'きょうも れんしゅう したね!えらい!⭐';
  } else if (days.length > 0) {
    msg.textContent = 'きょうも がんばろう!(れんしゅうした日:' + days.length + '日)';
  } else {
    msg.textContent = 'すきな べんきょうを えらんでね';
  }
}

// ---- きろく画面 ----
const HM_MODE_LABEL = { add: 'たし算', sub: 'ひき算', mul: 'かけ算' };

function fmtTime(ms) {
  const s = ms / 1000;
  if (s >= 60) {
    const m = Math.floor(s / 60);
    return m + 'ぷん' + (s - m * 60).toFixed(1) + 'びょう';
  }
  return s.toFixed(1) + 'びょう';
}

function renderRecords() {
  // 自己ベスト表
  const best = store.get('hmBest', {});
  let html = '<tr><th></th><th>100ます</th><th>25ます</th></tr>';
  for (const mode of ['add', 'sub', 'mul']) {
    html += '<tr><td>' + HM_MODE_LABEL[mode] + '</td>';
    for (const size of [10, 5]) {
      const b = best[mode + '_' + size];
      html += '<td>' + (b ? fmtTime(b.ms) : 'ー') + '</td>';
    }
    html += '</tr>';
  }
  document.getElementById('rec-best').innerHTML = html;

  // 地図パズルのベスト
  const mpBest = store.get('mpBest', {});
  const mpModes = ['all', 'r0', 'r1', 'r2', 'r3', 'r4', 'r5'];
  let mpHtml = '';
  for (let i = 0; i < mpModes.length; i += 2) {
    mpHtml += '<tr>';
    for (const mode of [mpModes[i], mpModes[i + 1]]) {
      if (!mode) { mpHtml += '<th></th><td></td>'; continue; }
      const b = mpBest[mode];
      mpHtml += '<th>' + mpModeLabel(mode) + '</th><td>' + (b ? fmtTime(b.ms) : 'ー') + '</td>';
    }
    mpHtml += '</tr>';
  }
  document.getElementById('rec-map').innerHTML = mpHtml;

  // 漢字ゲージ
  const prog = kjProgress();
  document.getElementById('rec-kj-fill').style.width = (prog.mastered / prog.total * 100) + '%';
  document.getElementById('rec-kj-text').textContent =
    'おぼえた:' + prog.mastered + '字 / ' + prog.total + '字 (にがて:' + prog.nigate + '字)';

  renderCalendar();

  // 履歴(100ます+地図パズル)
  const hmHist = store.get('hmHistory', []).map(h => ({
    d: h.d,
    text: HM_MODE_LABEL[h.mode] + ' ' + (h.size * h.size) + 'ます ' + h.score + 'てん ' + fmtTime(h.ms)
  }));
  const mpHist = store.get('mpHistory', []).map(h => ({
    d: h.d,
    text: '🗾 ' + mpModeLabel(h.mode) + ' ' + fmtTime(h.ms) + (h.miss > 0 ? '(ミス' + h.miss + ')' : '(ノーミス)')
  }));
  const hist = hmHist.concat(mpHist).sort((a, b) => a.d < b.d ? -1 : 1).slice(-10).reverse();
  const hEl = document.getElementById('rec-history');
  if (hist.length === 0) {
    hEl.innerHTML = '<p class="note">まだ きろくが ないよ</p>';
  } else {
    hEl.innerHTML = hist.map(h =>
      '<div class="hist-item"><span class="h-date">' + h.d.slice(5).replace('-', '/') + '</span>' + h.text + '</div>'
    ).join('');
  }
}

function renderCalendar() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const days = store.get('practiceDays', []);
  const first = new Date(y, m, 1).getDay();
  const last = new Date(y, m + 1, 0).getDate();
  let html = '<div class="cal-title">' + (m + 1) + '月</div><div class="cal-grid">';
  for (const w of ['日', '月', '火', '水', '木', '金', '土']) {
    html += '<div class="cal-cell dow">' + w + '</div>';
  }
  for (let i = 0; i < first; i++) html += '<div class="cal-cell"></div>';
  for (let d = 1; d <= last; d++) {
    const key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const cls = ['cal-cell'];
    if (days.includes(key)) cls.push('stamp');
    if (key === todayStr()) cls.push('today');
    html += '<div class="' + cls.join(' ') + '">' + (days.includes(key) ? '⭐' : d) + '</div>';
  }
  html += '</div>';
  document.getElementById('rec-cal').innerHTML = html;
}

// ---- 物理キーボード(Chromebook用) ----
document.addEventListener('keydown', (e) => {
  const hmPlaying = document.getElementById('screen-hyakumasu').classList.contains('active') &&
    !document.getElementById('hm-play').classList.contains('hidden') && HM.playing;
  if (hmPlaying) {
    if (e.key >= '0' && e.key <= '9') { hmKey(Number(e.key)); e.preventDefault(); }
    else if (e.key === 'Enter') { hmNext(); e.preventDefault(); }
    else if (e.key === 'Backspace') { hmClear(); e.preventDefault(); }
    return;
  }
  const kjActive = document.getElementById('screen-kanji').classList.contains('active') &&
    !document.getElementById('kj-quiz').classList.contains('hidden');
  if (kjActive) {
    if (e.key >= '1' && e.key <= '3') kjKeyChoice(Number(e.key) - 1);
    else if (e.key === 'Enter') kjKeyNext();
  }
});

updateSoundBtn();
renderHome();
