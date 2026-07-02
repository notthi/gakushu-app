// 100ます計算 タイムアタック

const HM = {
  mode: 'add', size: 10,
  rows: [], cols: [], inputs: [],
  idx: 0, buf: '', t0: 0, timer: null, playing: false
};
const HM_OP = { add: '+', sub: '−', mul: '×' };

// 種類・ますの数の選択チップ
document.getElementById('hm-mode-row').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (!b) return;
  HM.mode = b.dataset.mode;
  document.querySelectorAll('#hm-mode-row .chip').forEach(c => c.classList.toggle('sel', c === b));
  hmShowBest();
});
document.getElementById('hm-size-row').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-size]');
  if (!b) return;
  HM.size = Number(b.dataset.size);
  document.querySelectorAll('#hm-size-row .chip').forEach(c => c.classList.toggle('sel', c === b));
  hmShowBest();
});

function hmShowSetup() {
  document.getElementById('hm-setup').classList.remove('hidden');
  document.getElementById('hm-play').classList.add('hidden');
  hmStopTimer();
  HM.playing = false;
  hmShowBest();
}

function hmShowBest() {
  const b = store.get('hmBest', {})[HM.mode + '_' + HM.size];
  document.getElementById('hm-best-info').textContent =
    b ? '🏆 じこベスト:' + fmtTime(b.ms) : 'まだ きろくが ないよ。ちょうせんしよう!';
}

function hmMaxAnswer() {
  return HM.mode === 'mul' ? 81 : HM.mode === 'sub' ? 19 : 18;
}
function hmAnswer(r, c) {
  return HM.mode === 'add' ? r + c : HM.mode === 'sub' ? r - c : r * c;
}

function hmStart() {
  const n = HM.size;
  const digits = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  HM.cols = digits.slice(0, n);
  // ひき算は左の数を10〜19にして、こたえがマイナスにならないようにする
  HM.rows = (HM.mode === 'sub')
    ? shuffle([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]).slice(0, n)
    : shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, n);
  HM.inputs = new Array(n * n).fill(null);
  HM.idx = 0;
  HM.buf = '';
  HM.playing = true;

  document.getElementById('hm-setup').classList.add('hidden');
  document.getElementById('hm-play').classList.remove('hidden');
  document.getElementById('hm-result').classList.add('hidden');
  document.getElementById('hm-keypad').classList.remove('hidden');

  hmRenderGrid();
  hmRenderKeypad();
  hmHighlight();

  HM.t0 = Date.now();
  hmStopTimer();
  HM.timer = setInterval(() => {
    document.getElementById('hm-timer').textContent = fmtTime(Date.now() - HM.t0);
  }, 100);
  document.getElementById('hm-timer').textContent = '0.0びょう';
}

function hmStopTimer() {
  if (HM.timer) { clearInterval(HM.timer); HM.timer = null; }
}

function hmRenderGrid() {
  const n = HM.size;
  const grid = document.getElementById('hm-grid');
  const avail = Math.min(window.innerWidth, 520) - 28;
  const cell = Math.min(n === 10 ? 40 : 56, Math.floor(avail / (n + 1)) - 2);
  grid.style.gridTemplateColumns = 'repeat(' + (n + 1) + ', ' + cell + 'px)';
  grid.style.gridAutoRows = cell + 'px';
  grid.style.fontSize = Math.floor(cell * 0.42) + 'px';

  let html = '<div class="hm-cell corner">' + HM_OP[HM.mode] + '</div>';
  for (let c = 0; c < n; c++) html += '<div class="hm-cell head">' + HM.cols[c] + '</div>';
  for (let r = 0; r < n; r++) {
    html += '<div class="hm-cell head">' + HM.rows[r] + '</div>';
    for (let c = 0; c < n; c++) {
      html += '<div class="hm-cell" id="hm-cell-' + (r * n + c) + '"></div>';
    }
  }
  grid.innerHTML = html;
}

function hmRenderKeypad() {
  const pad = document.getElementById('hm-keypad');
  const keys = [7, 8, 9, 4, 5, 6, 1, 2, 3];
  let html = keys.map(k => '<button onclick="hmKey(' + k + ')">' + k + '</button>').join('');
  html += '<button class="func" onclick="hmClear()">けす</button>';
  html += '<button onclick="hmKey(0)">0</button>';
  html += '<button class="func" onclick="hmNext()">つぎ</button>';
  pad.innerHTML = html;
}

function hmCell(i) { return document.getElementById('hm-cell-' + i); }

function hmHighlight() {
  document.querySelectorAll('.hm-cell.cur').forEach(c => c.classList.remove('cur'));
  const cell = hmCell(HM.idx);
  if (cell) {
    cell.classList.add('cur');
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function hmKey(d) {
  if (!HM.playing) return;
  if (HM.buf === '' && d === 0) {
    // 0から始まる2けたの数はないので、0はすぐ確定
    HM.buf = '0';
    hmCommit();
    return;
  }
  HM.buf += d;
  hmCell(HM.idx).textContent = HM.buf;
  // これ以上けたを増やせないなら自動で確定
  if (HM.buf.length >= 2 || Number(HM.buf) * 10 > hmMaxAnswer()) hmCommit();
}

function hmClear() {
  if (!HM.playing) return;
  HM.buf = '';
  hmCell(HM.idx).textContent = '';
}

function hmNext() {
  if (!HM.playing) return;
  hmCommit();
}

function hmCommit() {
  const n = HM.size;
  HM.inputs[HM.idx] = HM.buf === '' ? null : Number(HM.buf);
  hmCell(HM.idx).textContent = HM.buf;
  HM.buf = '';
  HM.idx++;
  if (HM.idx >= n * n) {
    hmFinish();
  } else {
    hmHighlight();
  }
}

function hmQuit() {
  if (HM.playing && !confirm('とちゅうで やめる?')) return;
  hmShowSetup();
}

function hmFinish() {
  const ms = Date.now() - HM.t0;
  hmStopTimer();
  HM.playing = false;
  document.getElementById('hm-timer').textContent = fmtTime(ms);
  document.getElementById('hm-keypad').classList.add('hidden');
  document.querySelectorAll('.hm-cell.cur').forEach(c => c.classList.remove('cur'));

  // 採点
  const n = HM.size;
  let correct = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const ans = hmAnswer(HM.rows[r], HM.cols[c]);
      if (HM.inputs[i] === ans) {
        correct++;
        hmCell(i).classList.add('right');
      } else {
        hmCell(i).classList.add('wrong');
        hmCell(i).innerHTML = (HM.inputs[i] === null ? '' : HM.inputs[i]) + '<span class="ans">' + ans + '</span>';
      }
    }
  }
  const total = n * n;
  const perfect = correct === total;

  // 記録の保存
  stampToday();
  const hist = store.get('hmHistory', []);
  hist.push({ d: todayStr(), mode: HM.mode, size: n, ms: ms, score: correct });
  if (hist.length > 50) hist.splice(0, hist.length - 50);
  store.set('hmHistory', hist);

  let msg;
  const bestAll = store.get('hmBest', {});
  const key = HM.mode + '_' + n;
  const best = bestAll[key];
  if (perfect) {
    if (!best || ms < best.ms) {
      bestAll[key] = { ms: ms, d: todayStr() };
      store.set('hmBest', bestAll);
      msg = best
        ? '🎉 じこベスト!まえより ' + ((best.ms - ms) / 1000).toFixed(1) + 'びょう はやい!'
        : '🎉 ぜんもんせいかい!はじめての きろく!';
      playFanfare();
    } else {
      msg = 'ぜんもんせいかい!ベストまで あと ' + ((ms - best.ms) / 1000).toFixed(1) + 'びょう';
      playCorrect();
    }
  } else {
    msg = 'あかい ますの こたえを かくにんしよう';
    playWrong();
  }

  const box = document.getElementById('hm-result');
  box.innerHTML =
    '<div class="r-time">' + fmtTime(ms) + '</div>' +
    '<div class="r-score">' + correct + ' / ' + total + ' せいかい</div>' +
    '<div class="r-msg">' + msg + '</div>' +
    (perfect ? rkBuildUI('hm_' + HM.mode + '_' + n, ms) : '') +
    '<button class="big-btn go" onclick="hmStart()">もういちど</button>' +
    '<button class="big-btn" onclick="hmShowSetup()">しゅるいを かえる</button>' +
    '<button class="text-btn" onclick="show(\'screen-home\')">← ホームへ</button>';
  box.classList.remove('hidden');
  window.scrollTo(0, 0);
}
