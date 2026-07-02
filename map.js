// 都道府県パズル(白地図タイムアタック)

const MP = {
  mode: 'all',            // 'all' または 'r0'〜'r5'(地方)
  queue: [], target: null,
  total: 0, placed: 0, miss: 0, hints: 0,
  t0: 0, timer: null, playing: false,
  dragging: false, ghost: null,
  geo: {}                 // code → { cx, cy, thresh, bbox }
};
const MP_COLORS = ['#90caf9', '#ffab91', '#fff176', '#a5d6a7', '#ce93d8', '#f48fb1'];
const MP_PENALTY_MS = 5000; // ミス・ヒント1回につき+5びょう

function mpModeLabel(mode) {
  return mode === 'all' ? 'ぜんこく47' : JAPAN_MAP.regions[Number(mode.slice(1))];
}
function mpActiveList() {
  if (MP.mode === 'all') return JAPAN_MAP.prefs.slice();
  const r = Number(MP.mode.slice(1));
  return JAPAN_MAP.prefs.filter(p => p.region === r);
}

document.getElementById('mp-mode-row').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mpmode]');
  if (!b) return;
  MP.mode = b.dataset.mpmode;
  document.querySelectorAll('#mp-mode-row .chip').forEach(c => c.classList.toggle('sel', c === b));
  mpShowBest();
});

function mpShowSetup() {
  document.getElementById('mp-setup').classList.remove('hidden');
  document.getElementById('mp-play').classList.add('hidden');
  mpStopTimer();
  MP.playing = false;
  mpShowBest();
}

function mpShowBest() {
  const b = store.get('mpBest', {})[MP.mode];
  document.getElementById('mp-best-info').textContent =
    b ? '🏆 じこベスト:' + fmtTime(b.ms) : 'まだ きろくが ないよ。ちょうせんしよう!';
}

function mpStart() {
  const active = mpActiveList();
  MP.queue = shuffle(active);
  MP.total = active.length;
  MP.placed = 0; MP.miss = 0; MP.hints = 0;
  MP.playing = true;

  document.getElementById('mp-setup').classList.add('hidden');
  document.getElementById('mp-play').classList.remove('hidden');
  document.getElementById('mp-result').classList.add('hidden');
  document.getElementById('mp-tray').classList.remove('hidden');

  mpBuildMap(new Set(active.map(p => p.code)));
  mpMeasure(active);
  mpUpdateHead();

  MP.t0 = Date.now();
  mpStopTimer();
  MP.timer = setInterval(() => {
    document.getElementById('mp-timer').textContent = fmtTime(Date.now() - MP.t0);
  }, 100);
  document.getElementById('mp-timer').textContent = '0.0びょう';

  mpNextPiece();
}

function mpStopTimer() {
  if (MP.timer) { clearInterval(MP.timer); MP.timer = null; }
}

function mpBuildMap(activeSet) {
  const svg = document.getElementById('mp-svg');
  let html = '<g transform="' + JAPAN_MAP.wrapTransform + '"><g transform="' + JAPAN_MAP.innerTransform + '">';
  html += '<g class="mp-boundary">' + JAPAN_MAP.boundary + '</g>';
  for (const p of JAPAN_MAP.prefs) {
    const cls = activeSet.has(p.code) ? 'mp-pref active' : 'mp-pref inactive';
    html += '<g id="mp-pref-' + p.code + '" class="' + cls + '" transform="translate(' + p.tx + ',' + p.ty + ')">' + p.shapes + '</g>';
  }
  html += '</g></g><g id="mp-drag-layer"></g>';
  svg.innerHTML = html;
}

// 県グループのローカル座標 → SVGのviewBox座標への変換行列
function mpMatrix(el) {
  const svg = document.getElementById('mp-svg');
  return svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
}

// 県の中で一番大きい形(=本土)のbboxを求める
// 1つのpathに本土+離島がサブパスでまとまっている県があるので、サブパス単位で測る
function mpMainBBox(el) {
  let best = null, maxArea = -1;
  const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  temp.setAttribute('visibility', 'hidden');
  el.appendChild(temp);
  const consider = (b) => {
    if (b.width * b.height > maxArea) { maxArea = b.width * b.height; best = b; }
  };
  for (const child of el.children) {
    if (child === temp) continue;
    if (child.tagName === 'path') {
      const subs = child.getAttribute('d').split(/(?=M)/).filter(s => s.trim());
      if (subs.length > 1) {
        for (const s of subs) { temp.setAttribute('d', s); consider(temp.getBBox()); }
        continue;
      }
    }
    consider(child.getBBox());
  }
  el.removeChild(temp);
  return best;
}

// 各県の中心座標(viewBox座標系)と、はめたと判定する距離を計算
function mpMeasure(active) {
  MP.geo = {};
  for (const p of active) {
    const el = document.getElementById('mp-pref-' + p.code);
    const main = mpMainBBox(el);
    const m = mpMatrix(el);
    const bx = main.x + main.width / 2, by = main.y + main.height / 2;
    const cx = m.a * bx + m.c * by + m.e;
    const cy = m.b * bx + m.d * by + m.f;
    const diag = Math.hypot(main.width, main.height);
    MP.geo[p.code] = { cx, cy, thresh: Math.min(70, Math.max(26, diag * 0.5)), bbox: main };
  }
}

function mpUpdateHead() {
  document.getElementById('mp-count').textContent = 'のこり ' + (MP.total - MP.placed) + 'けん';
  document.getElementById('mp-miss').textContent = 'ミス ' + (MP.miss + MP.hints) + 'かい';
}

function mpNextPiece() {
  if (MP.placed >= MP.total) { mpFinish(); return; }
  MP.target = MP.queue[MP.placed];
  const p = MP.target;
  const g = MP.geo[p.code];
  const pad = Math.max(g.bbox.width, g.bbox.height) * 0.1 + 2;
  const tray = document.getElementById('mp-piece-svg');
  tray.setAttribute('viewBox',
    (g.bbox.x - pad) + ' ' + (g.bbox.y - pad) + ' ' + (g.bbox.width + pad * 2) + ' ' + (g.bbox.height + pad * 2));
  tray.innerHTML = '<g class="mp-piece-shape">' + p.shapes + '</g>';
  document.getElementById('mp-piece-name').innerHTML =
    p.name + '<br><small>' + p.kana + '</small>';
  mpUpdateHead();
}

// ---- ドラッグ操作 ----
function mpSvgPoint(clientX, clientY) {
  const svg = document.getElementById('mp-svg');
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function mpLift(e) {
  // 指で持つときはピースを指より上に表示する
  return e.pointerType === 'touch' ? 55 : 0;
}

function mpDragStart(e) {
  if (!MP.playing || !MP.target || MP.dragging) return;
  e.preventDefault();
  MP.dragging = true;
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* マウス環境などで失敗しても続行 */ }
  const layer = document.getElementById('mp-drag-layer');
  layer.innerHTML = '<g id="mp-ghost" class="mp-ghost"><g>' + MP.target.shapes + '</g></g>';
  MP.ghost = document.getElementById('mp-ghost');
  mpDragMove(e);
}

function mpDragMove(e) {
  if (!MP.dragging || !MP.ghost) return;
  e.preventDefault();
  const p = mpSvgPoint(e.clientX, e.clientY);
  const g = MP.geo[MP.target.code];
  const el = document.getElementById('mp-pref-' + MP.target.code);
  const m = mpMatrix(el);
  const px = p.x, py = p.y - mpLift(e);
  MP.ghost.setAttribute('transform',
    'translate(' + (px - g.cx) + ' ' + (py - g.cy) + ') matrix(' +
    m.a + ',' + m.b + ',' + m.c + ',' + m.d + ',' + m.e + ',' + m.f + ')');
  MP.ghost.dataset.px = px;
  MP.ghost.dataset.py = py;
}

function mpDragEnd(e) {
  if (!MP.dragging) return;
  MP.dragging = false;
  const layer = document.getElementById('mp-drag-layer');
  if (!MP.ghost) { layer.innerHTML = ''; return; }
  const px = Number(MP.ghost.dataset.px), py = Number(MP.ghost.dataset.py);
  layer.innerHTML = '';
  MP.ghost = null;
  if (isNaN(px)) return;
  const g = MP.geo[MP.target.code];
  if (Math.hypot(px - g.cx, py - g.cy) <= g.thresh) {
    mpPlace(MP.target);
  } else {
    MP.miss++;
    mpUpdateHead();
    playWrong();
  }
}

function mpPlace(p) {
  const el = document.getElementById('mp-pref-' + p.code);
  el.classList.remove('active');
  el.classList.add('placed');
  el.style.fill = MP_COLORS[p.region];
  MP.placed++;
  playCorrect();
  mpNextPiece();
}

function mpHint() {
  if (!MP.playing || !MP.target) return;
  MP.hints++;
  mpUpdateHead();
  const el = document.getElementById('mp-pref-' + MP.target.code);
  el.classList.add('hintflash');
  setTimeout(() => el.classList.remove('hintflash'), 1600);
}

function mpQuit() {
  if (MP.playing && !confirm('とちゅうで やめる?')) return;
  mpShowSetup();
}

function mpFinish() {
  const elapsed = Date.now() - MP.t0;
  const penalty = (MP.miss + MP.hints) * MP_PENALTY_MS;
  const ms = elapsed + penalty;
  mpStopTimer();
  MP.playing = false;
  MP.target = null;
  document.getElementById('mp-timer').textContent = fmtTime(ms);
  document.getElementById('mp-tray').classList.add('hidden');

  stampToday();
  const hist = store.get('mpHistory', []);
  hist.push({ d: todayStr(), mode: MP.mode, ms: ms, miss: MP.miss + MP.hints });
  if (hist.length > 30) hist.splice(0, hist.length - 30);
  store.set('mpHistory', hist);

  let msg;
  const bestAll = store.get('mpBest', {});
  const best = bestAll[MP.mode];
  if (!best || ms < best.ms) {
    bestAll[MP.mode] = { ms: ms, d: todayStr() };
    store.set('mpBest', bestAll);
    msg = best
      ? '🎉 じこベスト!まえより ' + ((best.ms - ms) / 1000).toFixed(1) + 'びょう はやい!'
      : '🎉 かんせい!はじめての きろく!';
    playFanfare();
  } else {
    msg = 'かんせい!ベストまで あと ' + ((ms - best.ms) / 1000).toFixed(1) + 'びょう';
    playCorrect();
  }

  const box = document.getElementById('mp-result');
  box.innerHTML =
    '<div class="r-time">' + fmtTime(ms) + '</div>' +
    '<div class="r-score">' + mpModeLabel(MP.mode) + ' ' + MP.total + 'けん かんせい' +
    (penalty > 0 ? '(ミス' + (MP.miss + MP.hints) + 'かい +' + (penalty / 1000) + 'びょう)' : '(ノーミス!)') +
    '</div>' +
    '<div class="r-msg">' + msg + '</div>' +
    '<button class="big-btn go" onclick="mpStart()">もういちど</button>' +
    '<button class="big-btn" onclick="mpShowSetup()">ちほうを かえる</button>' +
    '<button class="text-btn" onclick="show(\'screen-home\')">← ホームへ</button>';
  box.classList.remove('hidden');
  window.scrollTo(0, 0);
}

// トレイのピースをドラッグ
(() => {
  const tray = document.getElementById('mp-piece-svg');
  tray.addEventListener('pointerdown', mpDragStart);
  tray.addEventListener('pointermove', mpDragMove);
  tray.addEventListener('pointerup', mpDragEnd);
  tray.addEventListener('pointercancel', mpDragEnd);
})();
