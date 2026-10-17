// Paragraph exercises: leading, measure and word spacing (one slider each),
// and the rag editor. Type is sized so the measure in ch is honest at any
// screen width: on a narrow screen the text gets smaller and the line keeps
// its length in characters, so the lesson means the same thing everywhere.

import { ragAnalysis, keptRatio } from './scoring.js';

const BREAKS = 'Line breaks fall apart on other screen sizes, so change the words instead.';

let chRatio = 0.5;
export async function measureFont() {
  try { await document.fonts.load('20px "Source Serif 4"'); } catch (e) { /* fall back */ }
  const c = document.createElement('canvas').getContext('2d');
  c.font = '100px "Source Serif 4", Georgia, serif';
  const w = c.measureText('0').width / 100;
  if (w > 0.2 && w < 1) chRatio = w;
}

// Largest font size (up to max) at which `measure` characters fit in `avail` px.
export function fitSize(avail, measure, max) {
  return Math.max(9, Math.min(max, Math.floor((avail / (measure * chRatio)) * 10) / 10));
}
export function maxMeasure(avail, size) { return Math.floor(avail / (size * chRatio)); }

// ---- slider paragraphs --------------------------------------------------
export function createPara(els) {
  const { card, title, sample, noteA, noteB } = els;
  let lesson = null, size = 20;

  function fit() {
    if (!lesson) return;
    const avail = card.clientWidth - parseFloat(getComputedStyle(card).paddingLeft) * 2;
    const need = lesson.type === 'measure' ? 80 : lesson.type === 'wordspacing' ? 34 : lesson.measure;
    size = fitSize(avail, need, lesson.type === 'measure' ? 17 : 20);
    sample.style.fontSize = size + 'px';
    return { avail, size };
  }

  function show(l, value) {
    lesson = l;
    card.classList.toggle('wide', l.type === 'measure');
    title.textContent = l.type === 'wordspacing' ? 'Word spacing' : l.type === 'measure' ? 'On line length' : 'A short note on reading';
    sample.textContent = l.sample;
    sample.style.lineHeight = ''; sample.style.wordSpacing = ''; sample.style.maxWidth = '';
    const f = fit();
    if (l.type === 'leading') { sample.style.maxWidth = l.measure + 'ch'; noteA.textContent = l.measure + ' characters a line'; }
    if (l.type === 'wordspacing') { sample.style.maxWidth = '34ch'; sample.style.lineHeight = '1.45'; noteA.textContent = 'Body copy, 34 characters a line'; }
    if (l.type === 'measure') { sample.style.lineHeight = String(l.leading); }
    apply(value);
    return f;
  }

  function apply(v) {
    if (!lesson) return;
    if (lesson.type === 'leading') { sample.style.lineHeight = String(v); noteB.textContent = v.toFixed(2) + ' line height'; }
    if (lesson.type === 'wordspacing') { sample.style.wordSpacing = v + 'em'; noteB.textContent = fmtSpace(v) + ' word spacing'; }
    if (lesson.type === 'measure') {
      sample.style.maxWidth = Math.round(v) + 'ch';
      noteA.textContent = Math.round(v) + ' characters a line';
      noteB.textContent = size < 14 ? 'Text shrunk to fit your screen' : '';
    }
  }

  let lastW = 0;
  new ResizeObserver(() => {
    const w = card.clientWidth;
    if (lesson && w && Math.abs(w - lastW) > 0.5 && !card.closest('.hidden')) { lastW = w; fit(); }
  }).observe(card);

  return { show, apply, fit, get size() { return size; } };
}

export const fmtSpace = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + 'em';

// ---- rag editor ---------------------------------------------------------
export function createRag(els, { onChange }) {
  const { editor, fitBox, viz, words, lines, issue, coach } = els;
  let lesson = null, last = null, scale = 1;

  // Only plain text edits. Line breaks and formatting are blocked: the
  // lesson is about editing words, and forced breaks fall apart on other
  // screen sizes anyway.
  editor.addEventListener('beforeinput', (e) => {
    const t = e.inputType || '';
    if (t === 'insertParagraph' || t === 'insertLineBreak' || t.startsWith('format') || t === 'insertFromDrop') {
      e.preventDefault();
      if (t === 'insertParagraph' || t === 'insertLineBreak') say(BREAKS);
    }
  });
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); say(BREAKS); }
  });
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = ((e.clipboardData || window.clipboardData).getData('text/plain') || '').replace(/\s+/g, ' ');
    if (!document.execCommand('insertText', false, text)) {
      const sel = getSelection();
      if (sel.rangeCount) { sel.deleteFromDocument(); sel.getRangeAt(0).insertNode(document.createTextNode(text)); sel.collapseToEnd(); }
    }
  });
  editor.addEventListener('drop', (e) => e.preventDefault());
  editor.addEventListener('input', () => { normalise(); analyse(); onChange(editor.textContent); });

  // Collapse anything the browser slipped in (divs, brs) back to one text node,
  // keeping the caret where it was.
  function normalise() {
    if (editor.childNodes.length === 1 && editor.firstChild.nodeType === Node.TEXT_NODE) return;
    const sel = getSelection();
    let caret = null;
    if (sel.rangeCount && editor.contains(sel.anchorNode)) {
      const r = document.createRange(); r.selectNodeContents(editor); r.setEnd(sel.anchorNode, sel.anchorOffset);
      caret = r.toString().length;
    }
    const text = editor.textContent.replace(/\s+/g, ' ');
    editor.textContent = text;
    if (caret != null && editor.firstChild) {
      const r = document.createRange();
      r.setStart(editor.firstChild, Math.min(caret, text.length)); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
    }
  }

  // The paragraph is always laid out at 20px and the measure in ch, then
  // scaled down to fit. Sizing the font to the screen instead broke lines
  // differently at each size wherever the browser rounds glyph widths to
  // whole pixels (GitHub's test runner does, 18 Oct 2026).
  const column = fitBox.parentElement;
  function fit() {
    if (!lesson) return;
    editor.style.width = lesson.measure + 'ch';
    // the editor's padding hangs 12px into the card's padding on each side
    const avail = column.clientWidth + 24;
    scale = Math.min(1, avail / editor.offsetWidth);
    editor.style.transform = scale < 1 ? `scale(${scale})` : '';
    size();
    analyse();
  }
  // The transform doesn't change layout, so the box around the editor takes
  // the scaled size, including as the text grows or shrinks while editing.
  function size() {
    fitBox.style.width = editor.offsetWidth * scale + 'px';
    fitBox.style.height = editor.offsetHeight * scale + 'px';
  }
  let lastW = 0;
  new ResizeObserver(() => {
    const w = column.clientWidth;
    if (w && Math.abs(w - lastW) > 0.5) { lastW = w; fit(); }
  }).observe(column);
  new ResizeObserver(size).observe(editor);

  // Rendered lines, read character by character across every text node.
  function renderedLines() {
    const r = editor.getBoundingClientRect();
    const cs = getComputedStyle(editor);
    const left = r.left + (parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)) * scale;
    const width = parseFloat(cs.width) * scale;
    const out = [];
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let cur = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const s = node.textContent;
      for (let i = 0; i < s.length; i++) {
        if (s[i] === ' ') continue;
        range.setStart(node, i); range.setEnd(node, i + 1);
        const b = range.getBoundingClientRect();
        if (!b.width && !b.height) continue;
        if (!cur || b.top - cur.top > b.height * 0.5) { cur = { top: b.top, right: b.right }; out.push(cur); }
        else cur.right = Math.max(cur.right, b.right);
      }
    }
    return out.map((l) => Math.max(0, Math.min(1, (l.right - left) / width)));
  }

  function say(text) { coach.textContent = text; }

  const COACH = {
    short: 'There isn’t enough text to make a rag yet. Keep at least a few lines.',
    rewritten: 'That’s become a different paragraph. Keep most of the original words and make small edits.',
    runt: 'The last line is stranded on its own. Rewrite a few words so it gains some weight.',
    'short-last': 'The last line is still on the short side. A tiny edit may be enough.',
    jagged: 'The last line is fine, but a jump between two lines is making the right edge jagged.',
    notch: 'One line in the middle is much shorter than the rest and cuts a notch into the edge.',
    wedge: 'Several lines in a row get steadily shorter, which makes a slope down the edge.',
    flat: 'The lines are almost the same length, which looks like accidental justification. A little variation is fine.',
    balanced: 'This reads as a calm, natural rag. Don’t over-correct it into a staircase.',
  };
  const LABEL = { short: 'Needs more text', rewritten: 'Too rewritten', runt: 'Very weak last line', 'short-last': 'Short last line', jagged: 'Jagged edge', notch: 'Notch in the edge', wedge: 'Sloping edge', flat: 'Too regular', balanced: 'Balanced rag' };

  function analyse() {
    if (!lesson) return last;
    const widths = renderedLines();
    const text = editor.textContent.trim();
    const wc = (text.match(/\S+/g) || []).length;
    const res = ragAnalysis(widths, { wordCount: wc, keptRatio: keptRatio(lesson.sample, text) });
    words.textContent = wc + (wc === 1 ? ' word' : ' words');
    lines.textContent = widths.length + (widths.length === 1 ? ' line' : ' lines');
    const main = res.issues[0];
    issue.textContent = LABEL[main];
    issue.classList.toggle('warn', main !== 'balanced');
    say(COACH[main]);
    viz.replaceChildren(...widths.map((w, i) => {
      const bar = document.createElement('div');
      bar.className = 'rag-bar';
      const isLast = i === widths.length - 1;
      const jump = i > 0 && i < widths.length - 1 && Math.abs(w - widths[i - 1]) > 0.18;
      if ((isLast && w < 0.4) || jump || (!isLast && w < 0.7)) bar.classList.add('problem');
      bar.style.width = Math.max(6, w * 100) + '%';
      return bar;
    }));
    last = res;
    return res;
  }

  function show(l, text) {
    lesson = l;
    editor.textContent = text;
    fit();
  }

  return { show, fit, analyse, get text() { return editor.textContent; }, coachFor: (k) => COACH[k] };
}
