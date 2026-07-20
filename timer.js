// 1秒ずつ英語で読み上げるタイマー(3分固定・カウントアップ/ダウン)

const TM = {
  dir: store.get('tmDir', 'down'),
  total: 180,
  cur: 0,
  playing: false,
  intervalId: null
};

function tmSetDir(d) {
  TM.dir = d;
  store.set('tmDir', d);
  document.querySelectorAll('#tm-dir-row .chip').forEach(c => c.classList.toggle('sel', c.dataset.dir === d));
}

function tmPad(n) { return String(n).padStart(2, '0'); }
function tmFmt(sec) { return Math.floor(sec / 60) + ':' + tmPad(sec % 60); }

function tmNumberWords(n) {
  const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  if (n < 20) return ones[n];
  if (n < 100) {
    const t = Math.floor(n / 10), r = n % 10;
    return tens[t] + (r ? '-' + ones[r] : '');
  }
  const h = Math.floor(n / 100), r = n % 100;
  return ones[h] + ' hundred' + (r ? ' ' + tmNumberWords(r) : '');
}

function tmSpeak(text) {
  if (!soundOn || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.95;
    speechSynthesis.speak(u);
  } catch (e) { /* 読み上げできない環境でも動作は続ける */ }
}

function tmShowSetup() {
  clearInterval(TM.intervalId);
  TM.playing = false;
  ['tm-play', 'tm-result'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('tm-setup').classList.remove('hidden');
  document.querySelectorAll('#tm-dir-row .chip').forEach(c => c.classList.toggle('sel', c.dataset.dir === TM.dir));
}

function tmBackToMenu() { tmShowSetup(); }

function tmRender(sec, speak) {
  document.getElementById('tm-display').textContent = tmFmt(sec);
  document.getElementById('tm-word').textContent = tmNumberWords(sec);
  if (speak) tmSpeak(tmNumberWords(sec));
}

function tmStart() {
  clearInterval(TM.intervalId);
  TM.cur = TM.dir === 'down' ? TM.total : 0;
  TM.playing = true;

  ['tm-setup', 'tm-result'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('tm-play').classList.remove('hidden');
  tmRender(TM.cur, false);
  tmSpeak('Start!');
  TM.intervalId = setInterval(tmTick, 1000);
}

function tmTick() {
  if (TM.dir === 'down') {
    TM.cur--;
    if (TM.cur <= 0) {
      clearInterval(TM.intervalId);
      tmRender(0, false);
      tmFinish();
      return;
    }
    tmRender(TM.cur, true);
  } else {
    TM.cur++;
    tmRender(TM.cur, true);
    if (TM.cur >= TM.total) {
      clearInterval(TM.intervalId);
      setTimeout(tmFinish, 700);
    }
  }
}

function tmFinish() {
  TM.playing = false;
  stampToday();
  playFanfare();
  tmSpeak("Time's up!");
  document.getElementById('tm-play').classList.add('hidden');
  document.getElementById('tm-result').classList.remove('hidden');
  document.getElementById('tm-result-title').textContent = '🎉 タイマー しゅうりょう!';
}

function tmQuit() {
  if (!confirm('とちゅうで やめる?')) return;
  clearInterval(TM.intervalId);
  TM.playing = false;
  tmBackToMenu();
}
