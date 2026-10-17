import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kernPairs, kernScore, worstPair, pairReason, bandScore, ragAnalysis, keptRatio, cleanScores } from '../js/scoring.js';
import { leadingBand, lessons } from '../js/lessons.js';

test('kerning: matching the reference scores 100', () => {
  assert.equal(kernScore(kernPairs('WAVE', {}, [1, 2])), 100);
});

test('kerning: sub-perceptual error still scores 100', () => {
  assert.equal(kernScore(kernPairs('WAVE', { 1: 1, 2: 1 }, [1, 2])), 100);
});

test('kerning: moving two letters together only disturbs the outer gaps', () => {
  const together = kernPairs('WAVE', { 1: 6, 2: 6 }, [1, 2]);
  assert.deepEqual(together.map((p) => p.err), [6, 0, -6]);
});

test('kerning: score falls as error grows, never below 0', () => {
  const s = (o) => kernScore(kernPairs('WAVE', { 1: o }, [1, 2]));
  assert.ok(s(4) > s(8) && s(8) > s(16) && s(16) >= 0);
  assert.ok(s(30) < 10);
});

test('kerning: the start damage scores badly', () => {
  for (const l of lessons.filter((l) => l.type === 'kern')) {
    assert.ok(kernScore(kernPairs(l.word, l.start, l.movable)) < 50, l.word);
  }
});

test('kerning: pairs between two fixed letters are left out', () => {
  assert.deepEqual(kernPairs('AVATAR', {}, [1, 2, 4]).map((p) => p.pair), ['AV', 'VA', 'AT', 'TA', 'AR']);
});

test('kerning: worst pair and a reason for every pair in the curriculum', () => {
  const w = worstPair(kernPairs('WAVE', { 1: 14, 2: -9 }, [1, 2]));
  assert.equal(w.pair, 'AV');
  for (const l of lessons.filter((l) => l.type === 'kern')) {
    for (let i = 0; i < l.word.length - 1; i++) assert.ok(pairReason(l.word[i] + l.word[i + 1]).length > 20);
  }
});

test('bands: full marks inside, smooth fall outside', () => {
  assert.equal(bandScore(1.3, [1.27, 1.43], 0.15), 100);
  assert.ok(bandScore(1.2, [1.27, 1.43], 0.15) < 100);
  assert.ok(bandScore(1.2, [1.27, 1.43], 0.15) > bandScore(1.05, [1.27, 1.43], 0.15));
});

test('leading band grows with the measure', () => {
  const [a] = leadingBand(24), [b] = leadingBand(40);
  assert.ok(b > a);
});

test('lesson starts are outside their bands', () => {
  for (const l of lessons) {
    if (l.type === 'leading') assert.ok(bandScore(l.start, leadingBand(l.measure), 0.15) < 70, l.title);
    if (l.type === 'wordspacing') assert.ok(bandScore(l.start, l.band, l.falloff) < 70, l.title);
    if (l.type === 'measure') assert.ok(bandScore(l.start, l.band, 14) < 70, l.title);
  }
});

test('rag: a runt is penalised, a good rag is not', () => {
  const ok = ragAnalysis([0.95, 0.86, 0.97, 0.83, 0.7], { wordCount: 30, keptRatio: 1 });
  const runt = ragAnalysis([0.95, 0.86, 0.97, 0.83, 0.12], { wordCount: 30, keptRatio: 1 });
  assert.equal(ok.score, 100);
  assert.ok(runt.score <= 60 && runt.issues.includes('runt'));
});

test('rag: too little text or a rewrite is not scored as a pass', () => {
  assert.equal(ragAnalysis([0.9, 0.5], { wordCount: 6, keptRatio: 1 }).score, 0);
  assert.equal(ragAnalysis([0.9, 0.9, 0.8, 0.7], { wordCount: 30, keptRatio: 0.2 }).issues[0], 'rewritten');
});

test('keptRatio ignores case and punctuation', () => {
  assert.equal(keptRatio('The cat, sat.', 'the CAT sat'), 1);
  assert.equal(keptRatio('aaa bbb', 'zzz'), 0);
});

test('stored scores are validated', () => {
  assert.deepEqual(cleanScores({ 0: 'abc', 1: -500, 2: 140, 3: 55.6, 99: 10, foo: 1, 11: 50 }, 12), { 1: 0, 2: 100, 3: 56 });
  assert.deepEqual(cleanScores(null, 12), {});
});

// Copy rules from write-like-trev that a machine can check. Lesson samples
// are the paragraphs being judged, so they're left out.
test('copy: no "X, not Y" lines, "rather than" or em dashes', async () => {
  const { readFileSync } = await import('node:fs');
  const files = ['index.html', 'js/app.js', 'js/text.js', 'README.md'].map((f) => [f, readFileSync(new URL('../' + f, import.meta.url), 'utf8')]);
  const lessonCopy = lessons.flatMap((l) => [l.title, l.desc, l.matters, l.why, ...(l.tips || [])]).filter(Boolean).join('\n');
  for (const [name, text] of [...files, ['js/lessons.js', lessonCopy]]) {
    for (const bad of [/, not /, /\brather than\b/, /—/]) assert.doesNotMatch(text, bad, name);
  }
});
