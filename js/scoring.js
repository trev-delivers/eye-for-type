// Pure scoring functions, no DOM. Tested in tests/scoring.test.mjs.

// ---- Kerning ------------------------------------------------------------
// offsets[i] is how far letter i sits from the reference (the typeface's
// own kerning), in SVG units at a 156-unit font size. The eye doesn't see
// positions, it sees gaps, so we score the gap between each neighbouring
// pair: the difference between the two letters' offsets. A letter one unit
// out moves two gaps, and both count, which is what you actually see.
export const KERN_FONT_SIZE = 156;

export function kernPairs(word, offsets, movable) {
  const pairs = [];
  for (let i = 0; i < word.length - 1; i++) {
    if (!movable.includes(i) && !movable.includes(i + 1)) continue; // never changes
    const err = (offsets[i + 1] || 0) - (offsets[i] || 0); // + too open, - too tight
    pairs.push({ i, pair: word[i] + word[i + 1], err });
  }
  return pairs;
}

export function kernScore(pairs) {
  if (!pairs.length) return 100;
  // Under ~1.5 units (about 1% of an em) is invisible at this size.
  const felt = pairs.map((p) => Math.max(0, Math.abs(p.err) - 1.5));
  const rms = Math.sqrt(felt.reduce((a, e) => a + e * e, 0) / felt.length);
  return Math.round(100 * Math.exp(-Math.pow(rms / 8, 1.5)));
}

export function worstPair(pairs) {
  return pairs.reduce((w, p) => (!w || Math.abs(p.err) > Math.abs(w.err) ? p : w), null);
}

// Each letter's left and right edge, by the kind of white space it leaves.
// d = diagonal (a wedge), r = round (curves away), s = straight stem,
// o = overhang or open corner (something can tuck under or into it).
const EDGES = {
  A: 'dd', V: 'dd', W: 'dd', Y: 'dd', X: 'dd', K: 'sd', R: 'sd', T: 'oo', L: 'so', F: 'so', P: 'so', E: 'so',
  C: 'ro', O: 'rr', Q: 'rr', G: 'rr', D: 'sr', B: 'sr', I: 'ss', H: 'ss', N: 'ss', M: 'ss',
  o: 'rr', e: 'rr', c: 'ro', a: 'rs', n: 'ss', y: 'dd', v: 'dd', w: 'dd',
};

export function pairReason(pair) {
  const a = (EDGES[pair[0]] || 'ss')[1];
  const b = (EDGES[pair[1]] || 'ss')[0];
  const has = (x) => a === x || b === x;
  if (a === 'd' && b === 'd') return 'Two diagonals leave a big triangle of white between them, so this pair wants pulling in harder than any other.';
  if (has('o')) return `The ${a === 'o' ? pair[0] : pair[1]} leaves an open corner, so its neighbour can tuck into it rather than sitting at arm’s length.`;
  if (a === 'r' && b === 'r') return 'Two curves only touch at one point, so they need to sit closer than two straights to look the same distance apart.';
  if (has('r') && has('s')) return 'A curve pulls away from its edge, so a round next to a straight needs a little less space than two straights.';
  if (has('d')) return 'A diagonal leaves a wedge of white beside its neighbour. Close it a touch so it doesn’t read as a hole.';
  return 'Two straight stems are the most rigid pair. They set the baseline that every other gap is judged against.';
}

// ---- Ranges (leading, measure, word spacing) -----------------------------
// Inside the band is a full score. Outside it falls away smoothly.
export function bandScore(value, [low, high], falloff) {
  if (value >= low && value <= high) return 100;
  const d = value < low ? low - value : value - high;
  return Math.max(0, Math.round(100 * Math.exp(-Math.pow(d / falloff, 1.6))));
}

// ---- Rag ---------------------------------------------------------------
// Scored on the shape of the right edge, so any good rag passes, not just
// one secret answer. widths are each line's width as a fraction of the
// measure (0 to 1), in order.
export function ragAnalysis(widths, { wordCount, keptRatio }) {
  const res = { score: 0, issues: [], lines: widths.length };
  if (wordCount < 12 || widths.length < 3) {
    res.issues.push('short');
    return res;
  }
  if (keptRatio < 0.6) {
    res.issues.push('rewritten');
    return res;
  }
  const body = widths.slice(0, -1);
  const last = widths[widths.length - 1];
  let penalty = 0;

  // Runt: a very short final line.
  if (last < 0.25) { penalty += 40; res.issues.push('runt'); }
  else if (last < 0.4) { penalty += ((0.4 - last) / 0.15) * 22; res.issues.push('short-last'); }

  // Jagged: big jumps between neighbouring lines.
  let jag = 0;
  for (let i = 1; i < body.length; i++) {
    const d = Math.abs(body[i] - body[i - 1]);
    if (d > 0.18) jag += (d - 0.18) * 110;
  }
  if (jag > 6) res.issues.push('jagged');
  penalty += jag;

  // Notch: a line far shorter than the measure in the middle of the block.
  const shortest = Math.min(...body);
  if (shortest < 0.7) { penalty += (0.7 - shortest) * 60; res.issues.push('notch'); }

  // Wedge: three or more lines each shorter than the last makes a slope.
  let run = 0, wedge = false;
  for (let i = 1; i < body.length; i++) {
    run = body[i] < body[i - 1] - 0.03 ? run + 1 : 0;
    if (run >= 2) wedge = true;
  }
  if (wedge) { penalty += 10; res.issues.push('wedge'); }

  // Too regular reads as accidental justification.
  const mean = body.reduce((a, w) => a + w, 0) / body.length;
  const variance = body.reduce((a, w) => a + (w - mean) ** 2, 0) / body.length;
  if (body.length > 2 && variance < 0.0008) { penalty += 6; res.issues.push('flat'); }

  res.score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  if (!res.issues.length) res.issues.push('balanced');
  return res;
}

// Share of the original words that survive the edit, so rewriting the
// paragraph into nonsense doesn't count as fixing the rag.
export function keptRatio(original, edited) {
  const norm = (s) => s.toLowerCase().match(/[a-z’']+/g) || [];
  const a = norm(original);
  const b = new Set(norm(edited));
  if (!a.length) return 0;
  return a.filter((w) => b.has(w)).length / a.length;
}

// ---- Stored progress ----------------------------------------------------
export function cleanScores(raw, lessonCount) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && i < lessonCount - 1 && typeof v === 'number' && Number.isFinite(v)) {
      out[i] = Math.max(0, Math.min(100, Math.round(v)));
    }
  }
  return out;
}
