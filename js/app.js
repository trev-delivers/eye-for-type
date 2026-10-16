import { lessons, typeLabel, leadingBand } from './lessons.js';
import { kernPairs, kernScore, worstPair, pairReason, bandScore, cleanScores } from './scoring.js';
import { createKern } from './kern.js';
import { createPara, createRag, measureFont, fmtSpace, maxMeasure } from './text.js';
import { createRivers } from './rivers.js';

const $ = (id) => document.getElementById(id);
const LAST = lessons.length - 1;
const STORE = 'eye-for-type:v2';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- state --------------------------------------------------------------
// scores persist per browser; work in progress lives for the visit, so
// switching between Learn and Practise never throws it away.
const state = { index: 0, mode: 'learn', scores: {}, work: {} };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || localStorage.getItem('eye-for-type:v1') || '{}');
    if (Number.isInteger(raw.index) && raw.index >= 0 && raw.index <= LAST) state.index = raw.index;
    if (raw.mode === 'learn' || raw.mode === 'test') state.mode = raw.mode;
    state.scores = cleanScores(raw.scores, lessons.length);
  } catch (e) { /* storage unavailable or corrupt: start fresh */ }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ index: state.index, mode: state.mode, scores: state.scores })); } catch (e) { /* fine */ }
}

function work() {
  const l = lessons[state.index];
  if (!state.work[state.index]) {
    state.work[state.index] =
      l.type === 'kern' ? { offsets: { ...l.start } } :
      l.type === 'rag' ? { text: l.sample } :
      l.type === 'score' ? {} : { value: l.start };
  }
  return state.work[state.index];
}

// ---- components ---------------------------------------------------------
const slider = $('slider');
const kern = createKern(
  { svg: $('kernSvg'), flipG: $('kernFlip'), solution: $('solutionText'), markers: $('markers'), glyphs: $('editableGlyphs') },
  { onChange: ({ selected, value }) => {
    if (lessons[state.index].type !== 'kern') return;
    slider.disabled = selected == null || !!work().result;
    if (selected == null) { $('controlLabel').textContent = 'Select a letter to adjust'; $('controlValue').textContent = ''; slider.value = 0; return; }
    $('controlLabel').textContent = `Letter ${lessons[state.index].word[selected]}`;
    slider.value = value;
    const r = Math.round(value);
    $('controlValue').textContent = r === 0 ? 'on its start mark' : `${Math.abs(r)} ${r < 0 ? 'left' : 'right'}`;
  } },
);
const para = createPara({ card: $('paraCard'), title: $('paraTitle'), sample: $('paraSample'), noteA: $('paraNoteA'), noteB: $('paraNoteB') });
const rag = createRag(
  { editor: $('ragEditor'), viz: $('ragViz'), words: $('ragWords'), lines: $('ragLines'), issue: $('ragIssue'), coach: $('ragCoach') },
  { onChange: (text) => { if (lessons[state.index].type === 'rag') work().text = text; } },
);

// Rain over the practise paragraph (after scoring) and the Learn demo.
const rivers = createRivers($('paraSample'), $('paraCard'));
const DEMO_TEXT = 'Rivers are channels of white space that run down through a paragraph when the gaps between words on neighbouring lines happen to line up. They are most common in justified text, where the spacing stretches to fill every line, and they pull the eye downwards when it should be moving along the line. Once you have seen one, it is very hard to stop seeing it, which is exactly why they are worth catching before anyone else does.';
const demo = createRivers($('riverSample'), $('riverDemo'), {
  onCount: (n) => { $('riverNote').textContent = n ? `${n} river${n === 1 ? '' : 's'}: gaps on three or more lines in a row line up, so the rain runs straight down through them.` : 'No rivers: the gaps don’t line up from one line to the next, so the rain lands on words and stops.'; },
});
function setDemo(mode) {
  const el = $('riverSample');
  el.style.wordSpacing = mode === 'wide' ? '0.32em' : '0em';
  el.style.textAlign = mode === 'wide' ? 'justify' : 'left';
  document.querySelectorAll('[data-demo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.demo === mode)));
  requestAnimationFrame(() => demo.refresh());
}
$('riverSample').textContent = DEMO_TEXT;
document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => setDemo(b.dataset.demo)));

// ---- static chrome ------------------------------------------------------
$('lessonList').innerHTML = lessons.map((l, i) =>
  `<li><button class="lesson" type="button" data-i="${i}"><span>${l.title}</span><small><span class="done hidden" aria-label="scored"></span>${String(i + 1).padStart(2, '0')}</small></button></li>`).join('');
$('lessonPicker').innerHTML = lessons.map((l, i) => `<option value="${i}">${String(i + 1).padStart(2, '0')} · ${l.title}</option>`).join('');

// ---- render -------------------------------------------------------------
const show = (id, on) => $(id).classList.toggle('hidden', !on);

// Nav, progress and mode buttons: safe to refresh at any time.
function chrome() {
  const i = state.index, practise = state.mode === 'test';
  save();
  document.querySelectorAll('.lesson').forEach((b) => {
    const n = +b.dataset.i;
    b.setAttribute('aria-current', n === i ? 'true' : 'false');
    b.querySelector('.done').classList.toggle('hidden', state.scores[n] == null);
  });
  $('lessonPicker').value = String(i);
  const done = Object.keys(state.scores).length;
  $('progressText').textContent = `${done} / ${LAST} scored`;
  $('progressBar').style.width = (done / LAST) * 100 + '%';
  $('learnMode').setAttribute('aria-pressed', String(!practise));
  $('testMode').setAttribute('aria-pressed', String(practise));
}

function render() {
  const i = state.index, l = lessons[i], practise = state.mode === 'test';
  kern.stop(); rivers.stop(); demo.stop();
  chrome();

  $('eyebrow').textContent = `Lesson ${String(i + 1).padStart(2, '0')} · ${typeLabel[l.type]}`;
  $('title').textContent = l.title;
  $('desc').textContent = l.desc;
  $('pill').textContent = l.type === 'score' ? 'results' : practise ? 'practise' : 'learn';

  ['readingWork', 'kernWork', 'paraWork', 'ragWork', 'scoreWork', 'rangeWrap', 'band', 'blurBtn', 'flipBtn', 'resetBtn', 'checkBtn', 'nextBtn', 'feedback'].forEach((id) => show(id, false));
  ['blurBtn', 'flipBtn'].forEach((id) => $(id).setAttribute('aria-pressed', 'false'));
  slider.disabled = false;

  show('learnPanel', !practise && l.type !== 'score');
  show('testPanel', practise && l.type !== 'score');
  $('whatMatters').textContent = l.matters || '';
  $('whyCare').textContent = l.why || '';
  $('tips').innerHTML = (l.tips || []).map((t) => `<li>${t}</li>`).join('');

  if (l.type === 'score') return renderFinal();
  if (!practise) return renderLearn(l);

  const w = work();
  show('resetBtn', true);
  show('checkBtn', !w.result);

  if (l.type === 'kern') {
    show('kernWork', true); show('rangeWrap', true); show('blurBtn', true); show('flipBtn', true);
    slider.min = -36; slider.max = 36; slider.step = 1; slider.value = 0; slider.disabled = true;
    $('controlLabel').textContent = 'Select a letter to adjust'; $('controlValue').textContent = '';
    kern.build(l, w.offsets).then((ok) => {
      if (!ok || state.index !== i || state.mode !== 'test') return;
      if (w.result) { kern.lock(); showResult(w.result, false); }
    });
  } else if (l.type === 'rag') {
    show('ragWork', true);
    rag.show(l, w.text);
    $('ragEditor').setAttribute('contenteditable', w.result ? 'false' : 'plaintext-only');
    if (w.result) showResult(w.result, false);
  } else {
    show('paraWork', true); show('rangeWrap', true);
    const f = para.show(l, w.value);
    if (l.type === 'leading') { slider.min = l.min; slider.max = l.max; slider.step = 0.01; $('controlLabel').textContent = 'Line height'; }
    if (l.type === 'wordspacing') { slider.min = l.min; slider.max = l.max; slider.step = 0.01; $('controlLabel').textContent = 'Word spacing'; }
    if (l.type === 'measure') {
      slider.min = l.min; slider.step = 1; $('controlLabel').textContent = 'Measure';
      slider.max = Math.max(80, Math.min(l.max, maxMeasure(f.avail, f.size)));
    }
    slider.value = w.value;
    slider.disabled = !!w.result;
    setValueLabel(l, w.value);
    if (w.result) showResult(w.result, false);
  }
}

function setValueLabel(l, v) {
  $('controlValue').textContent = l.type === 'leading' ? v.toFixed(2) : l.type === 'wordspacing' ? fmtSpace(v) : Math.round(v) + ' characters';
}

const LEARN = {
  kern: [['What to see', 'Treat the gaps as shapes. Practise starts by knocking a few letters out of place; a perfect score means restoring the typeface’s own spacing.'], ['What to do', 'Compare one gap at a time, then step back to the whole word. When you see your score, you can flick between your spacing and the answer.']],
  leading: [['What to see', 'The horizontal bands of white between lines, and the overall grey of the paragraph.'], ['What to do', 'Judge how easily you find the next line and whether it still reads as one block. You’re aiming for a comfortable range, not one number.']],
  measure: [['What to see', 'How far your eye travels along a line, and how hard it is to find the start of the next.'], ['What to do', 'Widen or narrow the paragraph until reading feels effortless. Most people settle somewhere around 50 to 75 characters.']],
  wordspacing: [['What to see', 'Rivers: vertical channels of white that start linking up between lines.'], ['What to do', 'Keep words distinct without each one floating on its own.']],
  rag: [['What to see', 'The silhouette of the line endings. A good rag moves in small, varied steps rather than big jumps.'], ['What to do', 'In Practise, edit the words themselves. A small rewrite usually beats forcing line breaks.']],
};
function renderLearn(l) {
  show('readingWork', true);
  show('riverDemo', l.type === 'wordspacing');
  if (l.type === 'wordspacing') { setDemo('wide'); demo.start(); }
  $('readingLead').textContent = l.matters;
  $('readingExamples').innerHTML = (LEARN[l.type] || []).map(([h, p]) => `<div><h3>${h}</h3><p>${p}</p></div>`).join('');
}

function renderFinal() {
  show('scoreWork', true);
  const scored = Object.entries(state.scores);
  const avg = scored.length ? Math.round(scored.reduce((a, [, v]) => a + v, 0) / scored.length) : null;
  $('finalScore').textContent = avg == null ? '–' : '0';
  if (avg != null) countUp($('finalScore'), avg);
  $('finalCopy').textContent =
    avg == null ? 'Practise at least one lesson and your eye score will appear here.' :
    `Across the ${scored.length} of ${LAST} lessons you’ve practised. ` +
    (scored.length < LAST ? 'Practise the rest for a fuller picture. ' : '') +
    (avg >= 90 ? 'A very sharp eye: you’re landing in the comfortable zone almost every time.' :
      avg >= 75 ? 'Strong judgement. The next step is spotting smaller differences faster.' :
        'Read the guided lessons again, then take another pass in Practise.');
  $('finalList').innerHTML = lessons.slice(0, LAST).map((l, i) =>
    `<li><span>${l.title}</span><b>${state.scores[i] == null ? '–' : state.scores[i]}</b></li>`).join('');
  show('startPractise', avg == null);
}

// ---- scoring ------------------------------------------------------------
function grade() {
  const l = lessons[state.index], w = work();
  let result;
  if (l.type === 'kern') {
    if (!kern.ready) return;
    const pairs = kernPairs(l.word, w.offsets, l.movable);
    const worst = worstPair(pairs);
    result = { score: kernScore(pairs), pairs, worst };
    kern.lock();
  } else if (l.type === 'rag') {
    const res = rag.analyse();
    result = { score: res.score, issue: res.issues[0] };
    $('ragEditor').setAttribute('contenteditable', 'false');
  } else {
    const v = +slider.value;
    const band = l.type === 'leading' ? leadingBand(l.measure) : l.band;
    const falloff = l.type === 'leading' ? 0.15 : l.type === 'measure' ? 14 : l.falloff;
    result = { score: bandScore(v, band, falloff), value: v, band };
    slider.disabled = true;
  }
  w.result = result;
  state.scores[state.index] = result.score;
  chrome();
  showResult(result, true);
}

function showResult(r, fresh) {
  const l = lessons[state.index];
  const fb = $('feedback');
  show('checkBtn', false);
  show('nextBtn', state.index < LAST);
  $('resetBtn').textContent = 'Try again';
  let html = `<span class="score">${fresh ? 0 : r.score}</span>`;

  if (l.type === 'kern') {
    show('rangeWrap', false);
    const w = r.worst;
    const verdict = r.score >= 95 ? 'Spot on. Your spacing matches the typeface’s own.' :
      r.score >= 80 ? 'Very close. One or two gaps could use a tiny nudge.' :
        r.score >= 60 ? 'In the right zone, but a gap or two still stands out.' : 'A couple of gaps are still visibly off.';
    html += `<p>${verdict} Blue is the answer: the typeface’s own kerning, set by its designers.</p>`;
    html += `<div class="view-switch" role="group" aria-label="Show">${['both', 'mine', 'expert'].map((v) => `<button type="button" data-view="${v}" aria-pressed="${v === 'both'}">${v === 'both' ? 'Both' : v === 'mine' ? 'Mine' : 'Answer'}</button>`).join('')}</div>`;
    html += `<div class="fb-actions"><button type="button" id="holdBtn">Hold to compare</button><button type="button" id="slideBtn" aria-pressed="false">Slide to answer</button></div>`;
    html += `<div class="pairs">${r.pairs.map((p) => { const e = Math.abs(p.err); return `<span class="pair-chip ${e <= 2 ? 'good' : e <= 6 ? 'close' : 'off'}">${p.pair} ${e <= 2 ? '✓' : (p.err > 0 ? '+' : '−') + Math.round(e)}</span>`; }).join('')}</div>`;
    if (w && Math.abs(w.err) > 2) {
      html += `<p class="why"><b>${w.pair}</b> was ${Math.round(Math.abs(w.err))} units too ${w.err > 0 ? 'open' : 'tight'}. ${pairReason(w.pair)}</p>`;
    }
  } else if (l.type === 'rag') {
    html += `<p>${rag.coachFor(r.issue)}</p><p class="why">Scored on the shape of the right edge, so any good rag passes. There’s no single secret answer.</p>`;
  } else {
    const [lo, hi] = r.band, v = r.value;
    const inBand = v >= lo && v <= hi;
    if (l.type === 'leading') {
      html += `<p>${inBand ? 'Comfortable.' : v < lo ? 'Too tight: the lines crowd each other.' : 'Too loose: the paragraph starts to fall apart into strips.'} You chose ${v.toFixed(2)}.</p>`;
      html += `<p class="why">For a ${l.measure}-character line, about <b>${lo.toFixed(2)} to ${hi.toFixed(2)}</b> is comfortable. Longer lines want more leading, so the eye can find its way back.</p>`;
    } else if (l.type === 'measure') {
      html += `<p>${inBand ? 'Comfortable.' : v < lo ? 'Too short: your eye keeps jumping back to the start.' : 'Too long: it’s easy to lose your place on the way back.'} You chose ${Math.round(v)} characters.</p>`;
      html += `<p class="why">Most comfortable reading sits around <b>${lo} to ${hi} characters</b> a line, roughly two to three alphabets.</p>`;
    } else {
      rivers.refresh();
      const n = rivers.count;
      html += `<p>${inBand ? 'Even texture.' : v > hi ? 'Too open: gaps are starting to line up into rivers.' : 'Too tight: words are starting to run together.'} You chose ${fmtSpace(v)}.</p>`;
      const riverLine = v <= hi
        ? 'No rivers: the gaps are too narrow to line up into channels, so the rain lands on words.'
        : n ? `Your setting makes <b>${n} river${n === 1 ? '' : 's'}</b>. Watch the rain run down through ${n === 1 ? 'it' : 'them'}.`
          : 'No full rivers yet, but the gaps are wide enough that one could open with a different line break.';
      html += `<p>${riverLine}</p>`;
      html += `<div class="fb-actions"><button type="button" id="rainBtn" aria-pressed="true">Rain</button></div>`;
      html += `<p class="why">Anything from <b>${fmtSpace(lo)} to ${fmtSpace(hi)}</b> keeps an even grey. The typeface’s own spacing is usually close to right.</p>`;
    }
    showBand(r.band);
  }

  fb.innerHTML = html;
  show('feedback', true);
  if (l.type === 'kern') wireReveal(fb);
  if (l.type === 'wordspacing') {
    rivers.start();
    const rb = fb.querySelector('#rainBtn');
    rb.addEventListener('click', () => { if (rivers.running) rivers.stop(); else rivers.start(); rb.setAttribute('aria-pressed', String(rivers.running)); });
  }
  if (fresh) {
    countUp(fb.querySelector('.score'), r.score);
    const b = fb.getBoundingClientRect();
    if (b.top > innerHeight - 80 || b.bottom < 0) fb.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }
}

function showBand([lo, hi]) {
  const min = +slider.min, max = +slider.max, span = max - min;
  const a = Math.max(0, (lo - min) / span), b = Math.min(1, (hi - min) / span);
  const band = $('band');
  band.style.left = `calc(${a * 100}% + ${8 - a * 16}px)`;
  band.style.width = `calc(${(b - a) * 100}% - ${(b - a) * 16}px)`;
  show('band', true);
}

let view = 'both';
function wireReveal(fb) {
  view = 'both'; kern.setView('both');
  fb.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    view = b.dataset.view; kern.setView(view);
    fb.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  const hold = fb.querySelector('#holdBtn');
  const on = () => kern.setView('expert'), off = () => kern.setView(view);
  hold.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => hold.addEventListener(ev, off));
  hold.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); on(); } });
  hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') off(); });
  const slideBtn = fb.querySelector('#slideBtn');
  slideBtn.addEventListener('click', () => slideBtn.setAttribute('aria-pressed', String(kern.slideToAnswer())));
}

// Hold Shift to flick to the answer once a kerning lesson is scored.
addEventListener('keydown', (e) => { if (e.key === 'Shift' && lessons[state.index].type === 'kern' && work().result && state.mode === 'test') kern.setView('expert'); });
addEventListener('keyup', (e) => { if (e.key === 'Shift' && lessons[state.index].type === 'kern') kern.setView(view); });

function countUp(el, to) {
  if (!el) return;
  if (reduceMotion()) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 700;
  const tick = (t) => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

// ---- events -------------------------------------------------------------
function go(i) { state.index = Math.max(0, Math.min(LAST, i)); $('resetBtn').textContent = 'Reset'; render(); }
function setMode(m) { state.mode = m; $('resetBtn').textContent = 'Reset'; render(); }

document.querySelectorAll('.lesson').forEach((b) => b.addEventListener('click', () => go(+b.dataset.i)));
$('lessonPicker').addEventListener('change', (e) => go(+e.target.value));
$('learnMode').addEventListener('click', () => setMode('learn'));
$('testMode').addEventListener('click', () => setMode('test'));
$('startPractise').addEventListener('click', () => { state.mode = 'test'; go(0); });
$('checkBtn').addEventListener('click', grade);
$('nextBtn').addEventListener('click', () => { go(state.index + 1); $('title').scrollIntoView({ block: 'nearest' }); });
$('resetBtn').addEventListener('click', () => { delete state.work[state.index]; $('resetBtn').textContent = 'Reset'; render(); });
$('blurBtn').addEventListener('click', () => $('blurBtn').setAttribute('aria-pressed', String(kern.toggleSquint())));
$('flipBtn').addEventListener('click', () => $('flipBtn').setAttribute('aria-pressed', String(kern.toggleFlip())));

slider.addEventListener('input', () => {
  const l = lessons[state.index], v = +slider.value;
  if (l.type === 'kern') { kern.setSelected(v); return; }
  if (work().result) return;
  work().value = v; para.apply(v); setValueLabel(l, v);
});

let rt = 0;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    const l = lessons[state.index];
    if (state.mode !== 'test') return;
    if (l.type === 'rag') rag.fit();
    if (['leading', 'measure', 'wordspacing'].includes(l.type)) { para.fit(); para.apply(work().value); }
  }, 120);
});

load();
measureFont().then(render);
render();
