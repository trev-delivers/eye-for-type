// The kerning exercise. Letters sit at the typeface's own kerned positions
// (measured from a shaped reference word) plus an offset. Offsets are in
// SVG units, so they don't change when the drawing scales with the screen,
// and nothing needs rebuilding on resize.

const SVGNS = 'http://www.w3.org/2000/svg';
const RANGE = 36; // how far a letter can be dragged either way
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createKern(els, { onChange }) {
  const { svg, flipG, solution, markers, glyphs } = els;
  let gen = 0, lesson = null, offsets = {}, starts = [], ends = [], box = null;
  let selected = null, focused = null, flipped = false, locked = false, slide = 0, slideRaf = 0;
  let drag = null;

  const isMovable = (i) => lesson && lesson.movable.includes(i);
  const clamp = (v) => Math.max(-RANGE, Math.min(RANGE, v));

  function x(i) { return starts[i] + (offsets[i] || 0) * (1 - slide); }

  function draw() {
    glyphs.querySelectorAll('text').forEach((t) => {
      const i = +t.dataset.i;
      t.setAttribute('x', x(i).toFixed(2));
      if (isMovable(i)) {
        t.setAttribute('aria-valuenow', String(Math.round(offsets[i] || 0)));
        t.setAttribute('aria-valuetext', describe(offsets[i] || 0));
      }
      t.classList.toggle('active', i === selected || i === (drag && drag.i));
    });
    markers.querySelectorAll('circle').forEach((c) => {
      const i = +c.dataset.i;
      c.setAttribute('cx', ((x(i) + ends[i] - starts[i] + x(i)) / 2).toFixed(2));
      c.classList.toggle('active', i === selected);
      c.classList.toggle('focused', i === focused);
    });
  }

  function describe(v) {
    const r = Math.round(v);
    return r === 0 ? 'on its starting mark' : `${Math.abs(r)} units ${r < 0 ? 'left' : 'right'}`;
  }

  function select(i) {
    selected = i;
    draw();
    onChange({ selected, value: i == null ? null : offsets[i] || 0 });
  }

  function set(i, v) {
    if (locked || !isMovable(i)) return;
    offsets[i] = Math.round(clamp(v) * 10) / 10;
    draw();
    onChange({ selected: i, value: offsets[i], changed: true });
  }

  // ---- building -------------------------------------------------------
  async function build(l, o) {
    const g = ++gen;
    lesson = l; offsets = o; selected = null; focused = null; drag = null;
    locked = false; flipped = false; slide = 0; cancelAnimationFrame(slideRaf);
    svg.classList.remove('scored', 'squint', 'view-mine', 'view-expert');
    flipG.removeAttribute('transform');
    glyphs.replaceChildren(); markers.replaceChildren();
    solution.textContent = l.word;

    try { await document.fonts.load('156px "Source Serif 4"', l.word); } catch (e) { /* fall back */ }
    if (document.fonts) await document.fonts.ready;
    // The reference has to be laid out to be measured; give it a few frames.
    for (let f = 0; f < 30 && g === gen && solution.getNumberOfChars() !== l.word.length; f++) {
      await new Promise(requestAnimationFrame);
    }
    // null: a newer build took over, so say nothing. false: it failed.
    if (g !== gen) return null;
    if (solution.getNumberOfChars() !== l.word.length) return false;

    try {
      starts = []; ends = [];
      for (let i = 0; i < l.word.length; i++) {
        starts.push(solution.getStartPositionOfChar(i).x);
        ends.push(solution.getEndPositionOfChar(i).x);
      }
      box = solution.getBBox();
    } catch (e) { starts = []; return false; }
    const pad = RANGE + 30;
    svg.setAttribute('viewBox', `${(box.x - pad).toFixed(1)} ${(box.y - 20).toFixed(1)} ${(box.width + pad * 2).toFixed(1)} ${(box.height + 70).toFixed(1)}`);

    const markerY = box.y + box.height + 30;
    [...l.word].forEach((ch, i) => {
      const t = document.createElementNS(SVGNS, 'text');
      t.textContent = ch;
      t.setAttribute('y', solution.getAttribute('y'));
      t.dataset.i = i;
      t.classList.add('editable-glyph');
      if (isMovable(i)) {
        t.classList.add('movable');
        t.setAttribute('tabindex', '0');
        t.setAttribute('role', 'slider');
        t.setAttribute('aria-label', `Letter ${ch}, ${i + 1} of ${l.word.length}`);
        t.setAttribute('aria-valuemin', String(-RANGE));
        t.setAttribute('aria-valuemax', String(RANGE));
        const c = document.createElementNS(SVGNS, 'circle');
        c.dataset.i = i; c.setAttribute('cy', markerY.toFixed(1)); c.setAttribute('r', '6');
        c.classList.add('marker');
        markers.appendChild(c);
      } else {
        t.setAttribute('aria-hidden', 'true');
      }
      glyphs.appendChild(t);
    });
    draw();
    return true;
  }

  // ---- pointer --------------------------------------------------------
  function glyphAt(e) {
    const t = e.target.closest && e.target.closest('.editable-glyph.movable');
    return t ? +t.dataset.i : null;
  }

  svg.addEventListener('pointerdown', (e) => {
    const i = glyphAt(e);
    if (i == null || locked) return;
    e.preventDefault();
    const ctm = svg.getScreenCTM();
    drag = { i, id: e.pointerId, x0: e.clientX, v0: offsets[i] || 0, scale: ctm ? 1 / ctm.a : 1 };
    svg.setPointerCapture(e.pointerId);
    glyphs.classList.add('dim');
    select(i);
  });
  svg.addEventListener('pointermove', (e) => {
    if (drag && drag.id === e.pointerId) {
      const dx = (e.clientX - drag.x0) * drag.scale * (flipped ? -1 : 1);
      set(drag.i, drag.v0 + dx);
      return;
    }
    if (e.pointerType === 'mouse' && !locked) {
      const i = glyphAt(e);
      glyphs.classList.toggle('dim', i != null);
      glyphs.querySelectorAll('text').forEach((t) => t.classList.toggle('active', +t.dataset.i === i || +t.dataset.i === selected));
    }
  });
  const endDrag = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    drag = null;
    glyphs.classList.remove('dim');
    draw();
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('pointerleave', (e) => { if (!drag && e.pointerType === 'mouse') { glyphs.classList.remove('dim'); draw(); } });

  // ---- keyboard -------------------------------------------------------
  glyphs.addEventListener('focusin', (e) => {
    const i = +e.target.dataset.i;
    focused = i; select(i);
  });
  glyphs.addEventListener('focusout', () => { focused = null; draw(); });
  glyphs.addEventListener('keydown', (e) => {
    const i = +e.target.dataset.i;
    if (!isMovable(i) || locked) return;
    const step = e.shiftKey ? 5 : 1;
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    set(i, (offsets[i] || 0) + dir * step * (flipped ? -1 : 1));
  });

  // ---- tools ----------------------------------------------------------
  function toggleFlip() {
    flipped = !flipped;
    if (flipped && box) {
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2 + 15;
      flipG.setAttribute('transform', `rotate(180 ${cx.toFixed(1)} ${cy.toFixed(1)})`);
    } else flipG.removeAttribute('transform');
    return flipped;
  }
  function toggleSquint() { return svg.classList.toggle('squint'); }

  function lock() { locked = true; selected = null; svg.classList.add('scored'); glyphs.classList.remove('dim'); draw(); }

  function setView(v) {
    svg.classList.toggle('view-mine', v === 'mine');
    svg.classList.toggle('view-expert', v === 'expert');
  }

  // Slide your letters to the answer, and back again.
  function slideToAnswer() {
    const from = slide, to = slide > 0.5 ? 0 : 1;
    cancelAnimationFrame(slideRaf);
    if (reduceMotion()) { slide = to; draw(); return to === 1; }
    const t0 = performance.now(), dur = 650;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      slide = from + (to - from) * e; draw();
      if (p < 1) slideRaf = requestAnimationFrame(tick);
    };
    slideRaf = requestAnimationFrame(tick);
    return to === 1;
  }

  return {
    build, toggleFlip, toggleSquint, lock, setView, slideToAnswer,
    setSelected: (v) => { if (selected != null) set(selected, v); },
    get selected() { return selected; },
    get ready() { return starts.length === (lesson ? lesson.word.length : -1); },
    stop: () => { gen++; cancelAnimationFrame(slideRaf); },
  };
}
