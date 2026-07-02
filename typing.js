// ローマ字タイピング(訓令式を基本表示、ヘボン式の入力も受け付ける)

const TY_KANA = {
  'あ': ['a'], 'い': ['i'], 'う': ['u'], 'え': ['e'], 'お': ['o'],
  'か': ['ka'], 'き': ['ki'], 'く': ['ku'], 'け': ['ke'], 'こ': ['ko'],
  'さ': ['sa'], 'し': ['si', 'shi'], 'す': ['su'], 'せ': ['se'], 'そ': ['so'],
  'た': ['ta'], 'ち': ['ti', 'chi'], 'つ': ['tu', 'tsu'], 'て': ['te'], 'と': ['to'],
  'な': ['na'], 'に': ['ni'], 'ぬ': ['nu'], 'ね': ['ne'], 'の': ['no'],
  'は': ['ha'], 'ひ': ['hi'], 'ふ': ['hu', 'fu'], 'へ': ['he'], 'ほ': ['ho'],
  'ま': ['ma'], 'み': ['mi'], 'む': ['mu'], 'め': ['me'], 'も': ['mo'],
  'や': ['ya'], 'ゆ': ['yu'], 'よ': ['yo'],
  'ら': ['ra'], 'り': ['ri'], 'る': ['ru'], 'れ': ['re'], 'ろ': ['ro'],
  'わ': ['wa'], 'を': ['wo', 'o'],
  'が': ['ga'], 'ぎ': ['gi'], 'ぐ': ['gu'], 'げ': ['ge'], 'ご': ['go'],
  'ざ': ['za'], 'じ': ['zi', 'ji'], 'ず': ['zu'], 'ぜ': ['ze'], 'ぞ': ['zo'],
  'だ': ['da'], 'で': ['de'], 'ど': ['do'],
  'ば': ['ba'], 'び': ['bi'], 'ぶ': ['bu'], 'べ': ['be'], 'ぼ': ['bo'],
  'ぱ': ['pa'], 'ぴ': ['pi'], 'ぷ': ['pu'], 'ぺ': ['pe'], 'ぽ': ['po']
};
const TY_YOUON = {
  'きゃ': ['kya'], 'きゅ': ['kyu'], 'きょ': ['kyo'],
  'しゃ': ['sya', 'sha'], 'しゅ': ['syu', 'shu'], 'しょ': ['syo', 'sho'],
  'ちゃ': ['tya', 'cha'], 'ちゅ': ['tyu', 'chu'], 'ちょ': ['tyo', 'cho'],
  'にゃ': ['nya'], 'にゅ': ['nyu'], 'にょ': ['nyo'],
  'ひゃ': ['hya'], 'ひゅ': ['hyu'], 'ひょ': ['hyo'],
  'みゃ': ['mya'], 'みゅ': ['myu'], 'みょ': ['myo'],
  'りゃ': ['rya'], 'りゅ': ['ryu'], 'りょ': ['ryo'],
  'ぎゃ': ['gya'], 'ぎゅ': ['gyu'], 'ぎょ': ['gyo'],
  'じゃ': ['zya', 'ja', 'jya'], 'じゅ': ['zyu', 'ju', 'jyu'], 'じょ': ['zyo', 'jo', 'jyo'],
  'びゃ': ['bya'], 'びゅ': ['byu'], 'びょ': ['byo'],
  'ぴゃ': ['pya'], 'ぴゅ': ['pyu'], 'ぴょ': ['pyo']
};

// ひらがなの単語 → 入力ユニットの配列に分解
// 「っ」は次の音の子音を重ねる、「ん」は次の音しだいで n / nn
function tyParse(word) {
  const units = [];
  let i = 0, soku = false;
  while (i < word.length) {
    const c = word[i];
    if (c === 'っ') { soku = true; i++; continue; }
    if (c === 'ん') { units.push({ kana: 'ん', n: true, sp: null }); i++; continue; }
    let sp, kana = c;
    if (i + 1 < word.length && 'ゃゅょ'.includes(word[i + 1])) {
      kana = word.slice(i, i + 2);
      sp = TY_YOUON[kana]; i += 2;
    } else {
      sp = TY_KANA[c]; i += 1;
    }
    sp = sp.slice();
    if (soku) { sp = sp.map(s => s[0] + s); kana = 'っ' + kana; soku = false; }
    units.push({ kana: kana, sp: sp });
  }
  units.forEach((u, idx) => {
    if (!u.n) return;
    const next = units[idx + 1];
    const canSingle = next && !next.n && next.sp.every(s => !'aiueony'.includes(s[0]));
    u.sp = canSingle ? ['n', 'nn'] : ['nn'];
  });
  return units;
}

const TY = {
  course: 'easy',
  words: [], wIdx: 0,
  units: [], uIdx: 0, buf: '', typedStr: '',
  miss: 0, t0: 0, timer: null, playing: false
};
const TY_COURSE_LABEL = { easy: 'かんたん', normal: 'ふつう' };
const TY_WORDS_PER_RUN = 10;

document.getElementById('ty-course-row').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-course]');
  if (!b) return;
  TY.course = b.dataset.course;
  document.querySelectorAll('#ty-course-row .chip').forEach(c => c.classList.toggle('sel', c === b));
  tyShowBest();
});

function tyShowSetup() {
  document.getElementById('ty-setup').classList.remove('hidden');
  document.getElementById('ty-play').classList.add('hidden');
  tyStopTimer();
  TY.playing = false;
  tyShowBest();
}

function tyShowBest() {
  const b = store.get('tyBest', {})[TY.course];
  document.getElementById('ty-best-info').textContent =
    b ? '🏆 じこベスト:' + fmtTime(b.ms) : 'まだ きろくが ないよ。ちょうせんしよう!';
}

function tyStart() {
  TY.words = shuffle(TYPING_WORDS[TY.course]).slice(0, TY_WORDS_PER_RUN);
  TY.wIdx = 0;
  TY.miss = 0;
  TY.playing = true;

  document.getElementById('ty-setup').classList.add('hidden');
  document.getElementById('ty-play').classList.remove('hidden');
  document.getElementById('ty-result').classList.add('hidden');
  document.getElementById('ty-card').classList.remove('hidden');
  document.getElementById('ty-keyboard').classList.remove('hidden');
  tyRenderKeyboard();
  tyLoadWord();

  TY.t0 = Date.now();
  tyStopTimer();
  TY.timer = setInterval(() => {
    document.getElementById('ty-timer').textContent = fmtTime(Date.now() - TY.t0);
  }, 100);
  document.getElementById('ty-timer').textContent = '0.0びょう';
}

function tyStopTimer() {
  if (TY.timer) { clearInterval(TY.timer); TY.timer = null; }
}

function tyLoadWord() {
  TY.units = tyParse(TY.words[TY.wIdx]);
  TY.uIdx = 0; TY.buf = ''; TY.typedStr = '';
  document.getElementById('ty-kana').textContent = TY.words[TY.wIdx];
  document.getElementById('ty-progress').textContent = (TY.wIdx + 1) + ' / ' + TY.words.length + ' もん';
  document.getElementById('ty-miss').textContent = 'ミス ' + TY.miss;
  tyRenderRomaji();
}

// 残りの表示:今のユニットは入力中バッファに合うつづりの続き、その先は基本形(訓令式)
function tyRenderRomaji() {
  let rest = '';
  const u = TY.units[TY.uIdx];
  if (u) {
    const cand = u.sp.filter(s => s.startsWith(TY.buf)).sort((a, b) => a.length - b.length)[0];
    rest += cand.slice(TY.buf.length);
    for (let i = TY.uIdx + 1; i < TY.units.length; i++) rest += TY.units[i].sp[0];
  }
  document.getElementById('ty-romaji').innerHTML =
    '<span class="done">' + TY.typedStr + TY.buf + '</span><span class="rest">' + rest + '</span>';
}

function tyKey(ch) {
  if (!TY.playing) return;
  const u = TY.units[TY.uIdx];
  if (!u) return;
  const nb = TY.buf + ch;
  if (u.sp.some(s => s.startsWith(nb))) {
    TY.buf = nb;
    // これで完成し、かつ もっと長いつづりの途中でもない場合は次のユニットへ
    if (u.sp.includes(nb) && !u.sp.some(s => s !== nb && s.startsWith(nb))) tyUnitDone();
    else tyRenderRomaji();
  } else if (u.sp.includes(TY.buf)) {
    // 「ん」を n 1文字で確定して、今のキーは次のユニットに回す
    tyUnitDone();
    tyKey(ch);
  } else {
    TY.miss++;
    document.getElementById('ty-miss').textContent = 'ミス ' + TY.miss;
    beep(196, .08, 'square');
    const ro = document.getElementById('ty-romaji');
    ro.classList.remove('flash-ng');
    void ro.offsetWidth;
    ro.classList.add('flash-ng');
  }
}

function tyUnitDone() {
  TY.typedStr += TY.buf;
  TY.buf = '';
  TY.uIdx++;
  if (TY.uIdx >= TY.units.length) {
    beep(1046, .07);
    TY.wIdx++;
    if (TY.wIdx >= TY.words.length) tyFinish();
    else tyLoadWord();
  } else {
    tyRenderRomaji();
  }
}

function tyRenderKeyboard() {
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  document.getElementById('ty-keyboard').innerHTML = rows.map(row =>
    '<div class="ty-krow">' + row.split('').map(k =>
      '<button class="ty-key" onclick="tyKey(\'' + k + '\')">' + k + '</button>').join('') + '</div>'
  ).join('');
}

function tyQuit() {
  if (TY.playing && !confirm('とちゅうで やめる?')) return;
  tyShowSetup();
}

function tyFinish() {
  const ms = Date.now() - TY.t0;
  tyStopTimer();
  TY.playing = false;
  document.getElementById('ty-timer').textContent = fmtTime(ms);
  document.getElementById('ty-card').classList.add('hidden');
  document.getElementById('ty-keyboard').classList.add('hidden');

  stampToday();
  const hist = store.get('tyHistory', []);
  hist.push({ d: todayStr(), course: TY.course, ms: ms, miss: TY.miss });
  if (hist.length > 30) hist.splice(0, hist.length - 30);
  store.set('tyHistory', hist);

  let msg;
  const bestAll = store.get('tyBest', {});
  const best = bestAll[TY.course];
  if (!best || ms < best.ms) {
    bestAll[TY.course] = { ms: ms, d: todayStr() };
    store.set('tyBest', bestAll);
    msg = best
      ? '🎉 じこベスト!まえより ' + ((best.ms - ms) / 1000).toFixed(1) + 'びょう はやい!'
      : '🎉 クリア!はじめての きろく!';
    playFanfare();
  } else {
    msg = 'クリア!ベストまで あと ' + ((ms - best.ms) / 1000).toFixed(1) + 'びょう';
    playCorrect();
  }

  const box = document.getElementById('ty-result');
  box.innerHTML =
    '<div class="r-time">' + fmtTime(ms) + '</div>' +
    '<div class="r-score">' + TY_COURSE_LABEL[TY.course] + ' ' + TY.words.length + 'もん' +
    (TY.miss > 0 ? '(ミス' + TY.miss + 'かい)' : '(ノーミス!)') + '</div>' +
    '<div class="r-msg">' + msg + '</div>' +
    rkBuildUI('ty_' + TY.course, ms) +
    '<button class="big-btn go" onclick="tyStart()">もういちど</button>' +
    '<button class="big-btn" onclick="tyShowSetup()">コースを かえる</button>' +
    '<button class="text-btn" onclick="show(\'screen-home\')">← ホームへ</button>';
  box.classList.remove('hidden');
  window.scrollTo(0, 0);
}
