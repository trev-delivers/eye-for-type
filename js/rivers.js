// Rivers: particles fall down a paragraph and can only pass a line of type
// through its word gaps. Where gaps on neighbouring lines line up, they
// keep falling and carve a visible channel: that's a river. Where they
// don't, the particles land on the words and fade. With reduced motion,
// the detected rivers are drawn as still lines instead.

const BLUE = '29,111,208';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Word gaps on each rendered line, in px relative to `host`.
export function readGaps(textEl, host) {
  const h = host.getBoundingClientRect();
  const lines = [];
  const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let cur = null, prevRight = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const s = node.textContent;
    for (let i = 0; i < s.length; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1);
      const b = range.getBoundingClientRect();
      if (!b.height) continue;
      const top = b.top - h.top, bottom = b.bottom - h.top;
      if (!cur || top - cur.top > b.height * 0.5) {
        cur = { top, bottom, left: b.left - h.left, right: b.right - h.left, gaps: [] };
        lines.push(cur); prevRight = null;
      }
      if (s[i] === ' ') {
        // Remember where the space starts; the gap ends where the next word begins.
        if (prevRight != null) cur.pending = prevRight;
        continue;
      }
      const left = b.left - h.left;
      if (cur.pending != null) {
        if (left - cur.pending > 0.5) cur.gaps.push({ x1: cur.pending, x2: left });
        cur.pending = null;
      }
      prevRight = b.right - h.left;
      cur.right = Math.max(cur.right, prevRight);
    }
  }
  lines.forEach((l) => delete l.pending);
  return lines;
}

// Chains of gaps that overlap on consecutive lines. A chain three or more
// lines deep is a river.
// minWidth: a channel of normal word spaces is barely visible; rivers that
// matter are made of gaps wider than about a third of the type size.
export function findRivers(lines, share = 0.5, minWidth = 0) {
  const joins = (a, h) => Math.min(a.x2, h.x2) - Math.max(a.x1, h.x1) >= share * Math.min(a.x2 - a.x1, h.x2 - h.x1);
  const rivers = [];
  const used = lines.map((l) => l.gaps.map(() => false));
  for (let i = 0; i < lines.length; i++) {
    lines[i].gaps.forEach((g, gi) => {
      if (used[i][gi]) return;
      const chain = [{ line: i, gap: g }];
      used[i][gi] = true;
      let a = g;
      for (let j = i + 1; j < lines.length; j++) {
        const k = lines[j].gaps.findIndex((h, hi) => !used[j][hi] && joins(a, h));
        if (k < 0) break;
        used[j][k] = true; a = lines[j].gaps[k];
        chain.push({ line: j, gap: a });
      }
      const avg = chain.reduce((a, c) => a + c.gap.x2 - c.gap.x1, 0) / chain.length;
      if (chain.length >= 3 && avg >= minWidth) rivers.push(chain);
    });
  }
  return rivers;
}

export function createRivers(textEl, host, { onCount } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'rivers';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let lines = [], rivers = [], parts = [], raf = 0, running = false, w = 0, h = 0, last = 0;

  function measure() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = host.clientWidth; h = host.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    read();
  }
  function read() {
    lines = readGaps(textEl, host);
    rivers = findRivers(lines, 0.5, parseFloat(getComputedStyle(textEl).fontSize) * 0.33);
    if (onCount) onCount(rivers.length);
  }

  function lineAt(y) { return lines.find((l) => y >= l.top + 2 && y <= l.bottom - 2); }

  // Drops fall into a random word gap on any line. A drop in a gap that
  // lines up with the next line's keeps falling; anywhere else it stops at
  // the next line. Rivers start anywhere, not just at the top.
  function spawn() {
    const withGaps = lines.filter((l) => l.gaps.length);
    if (!withGaps.length) return;
    const ln = withGaps[Math.floor(Math.random() * withGaps.length)];
    const g = ln.gaps[Math.floor(Math.random() * ln.gaps.length)];
    parts.push({ x: g.x1 + Math.random() * (g.x2 - g.x1), y: ln.top + 1, vy: 0.8 + Math.random() * 0.4, trail: [], dead: 0, through: 0 });
  }

  function step(dt) {
    const k = dt / 16.7;
    for (const p of parts) {
      if (p.dead) { p.dead += k; continue; }
      p.vy = Math.min(3.2, p.vy + 0.06 * k);
      const ln = lineAt(p.y + p.vy * k);
      if (ln) {
        let gap = ln.gaps.find((g) => p.x >= g.x1 - 1 && p.x <= g.x2 + 1);
        if (!gap && p.lastLine !== ln) {
          // a gap that almost lines up: drift sideways into it
          const near = ln.gaps.map((g) => ({ g, d: p.x < g.x1 ? g.x1 - p.x : p.x - g.x2 })).filter((o) => o.d <= 3).sort((a, b) => a.d - b.d)[0];
          if (near) gap = near.g;
        }
        if (gap) {
          // funnel through the gap
          p.x += ((gap.x1 + gap.x2) / 2 - p.x) * 0.3 * k;
          p.vy = Math.min(p.vy, 1.8);
          if (p.lastLine !== ln) { p.lastLine = ln; p.through++; }
        } else if (p.x < ln.left - 2 || p.x > ln.right + 2) {
          // outside the text on this line: the margin, not a river
          p.dead = 1;
        } else {
          p.dead = 1; // landed on a word
        }
      }
      // past the last line: the paragraph is over, let it go quietly
      if (!p.dead && lines.length && p.y > lines[lines.length - 1].bottom - 2) p.dead = 1;
      if (!p.dead) {
        p.y += p.vy * k;
        p.trail.push([p.x, p.y]);
        if (p.trail.length > 22) p.trail.shift();
      }
    }
    parts = parts.filter((p) => p.dead < 8 && p.y < h + 10);
  }

  // Tint the white channel itself: each river's gaps, joined line to line.
  function channels(alpha) {
    ctx.fillStyle = `rgba(${BLUE},${alpha})`;
    for (const r of rivers) {
      const left = [], right = [];
      r.forEach(({ line, gap }) => {
        const l = lines[line];
        left.push([gap.x1, l.top + 3], [gap.x1, l.bottom - 3]);
        right.push([gap.x2, l.top + 3], [gap.x2, l.bottom - 3]);
      });
      ctx.beginPath();
      [...left, ...right.reverse()].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath(); ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    channels(0.16);
    for (const p of parts) {
      const a = p.dead ? Math.max(0, 1 - p.dead / 8) * 0.25 : 0.3 + Math.min(0.65, (p.through - 1) * 0.22);
      if (p.trail.length > 1 && p.through >= 2) {
        ctx.strokeStyle = `rgba(${BLUE},${(a * 0.45).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        p.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(${BLUE},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.dead ? 1.1 : 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawStill() { ctx.clearRect(0, 0, w, h); channels(0.32); }

  function loop(t) {
    if (!running) return;
    const dt = Math.min(48, last ? t - last : 16.7); last = t;
    for (let s = 0; s < 3 && parts.length < 280; s++) spawn();
    step(dt); draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true; canvas.classList.add('on');
    measure();
    if (reduceMotion()) { drawStill(); return; }
    last = 0; raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false; cancelAnimationFrame(raf); parts = [];
    canvas.classList.remove('on'); ctx.clearRect(0, 0, w, h);
  }
  // Text changed (spacing, size): re-read the gaps, keep the rain going.
  function refresh() {
    if (!running) { read(); return; }
    measure();
    if (reduceMotion()) drawStill();
  }

  new ResizeObserver(() => { if (running) refresh(); }).observe(host);
  return { start, stop, refresh, get running() { return running; }, get count() { return rivers.length; } };
}
