// Browser tests. Each one re-runs a bug from the original's audit (numbered
// as in that report) or checks a feature. `npm run check` serves the site and
// runs these; by hand: python3 -m http.server 4180 &  then  node tests/e2e.mjs
// PLAYWRIGHT can point at a Playwright install; defaults to the dev
// dependency, then the global one.
import assert from 'node:assert/strict';

const pw = process.env.PLAYWRIGHT ? await import(process.env.PLAYWRIGHT)
  : await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const URL = process.env.URL || 'http://localhost:4180/';
const browser = await pw.chromium.launch();
let failed = 0;

// Vercel serves the analytics script only on a deploy. Locally it 404s and
// shows up as a console error, so hand every context an empty one.
async function context(opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/_vercel/insights/script.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  return ctx;
}

async function page({ width = 1440, height = 900, touch = false, slowFont = false } = {}) {
  const ctx = await context({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && p.errors.push(m.text()));
  if (slowFont) await p.route(/fonts\.gstatic\.com/, async (r) => { await new Promise((ok) => setTimeout(ok, 2500)); r.continue(); });
  await p.goto(URL);
  await p.waitForFunction(() => document.getElementById('title').textContent.length > 0);
  // Measure with the real faces. On a cold CI runner Google Fonts can take
  // longer than a test's short wait, and the fallback serif breaks lines
  // differently. Tests that want a late font pass slowFont and wait for it.
  if (!slowFont) {
    await p.evaluate(() => Promise.all([
      document.fonts.load('400 20px "Source Serif 4"'),
      document.fonts.load('italic 400 20px "Source Serif 4"'),
      document.fonts.load('400 16px "Source Sans 3"'),
    ]).then(() => document.fonts.ready));
  }
  return p;
}
const go = (p, i) => p.evaluate((i) => { const b = document.querySelector(`.lesson[data-i="${i}"]`); if (b && b.offsetParent) b.click(); else { const s = document.getElementById('lessonPicker'); s.value = i; s.dispatchEvent(new Event('change')); } }, i);
const practise = (p) => p.click('#testMode');
const kernReady = (p, n) => p.waitForFunction((n) => document.querySelectorAll('#editableGlyphs text').length === n && document.querySelector('#editableGlyphs text').getAttribute('x') !== null, n);

async function t(name, fn) {
  try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message.split('\n')[0]); }
}

await t('1: fast lesson switching never stacks two words', async () => {
  const p = await page({ slowFont: true });
  await practise(p); await go(p, 1); await go(p, 2); await go(p, 3);
  await p.waitForTimeout(3500);
  const words = await p.evaluate(() => [...document.querySelectorAll('#editableGlyphs text')].map((t) => t.textContent).join(''));
  assert.equal(words, 'LYRIC');
  const xs = await p.evaluate(() => [...document.querySelectorAll('#editableGlyphs text')].map((t) => t.getAttribute('x')));
  assert.ok(xs.every((x) => x && !x.includes('NaN')));
  assert.deepEqual(p.errors, []);
});

await t('2+3: Enter, multi-line paste and bold cannot break the rag', async () => {
  const p = await page();
  await practise(p); await go(p, 9);
  await p.click('#ragEditor'); await p.keyboard.press('End'); await p.keyboard.press('Enter'); await p.keyboard.type(' More');
  await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'line one\nline two'); document.getElementById('ragEditor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await p.keyboard.press('Control+Home'); await p.keyboard.press('Enter'); await p.keyboard.press('Control+a'); await p.keyboard.press('Control+b');
  const s = await p.evaluate(() => ({ nodes: document.getElementById('ragEditor').childNodes.length, html: document.getElementById('ragEditor').innerHTML, lines: document.getElementById('ragLines').textContent }));
  assert.ok(!/<(div|br|b|strong)/i.test(s.html), s.html);
  assert.ok(parseInt(s.lines) >= 3, s.lines);
  await p.click('#checkBtn');
  await p.waitForSelector('#feedback:not(.hidden)');
  assert.deepEqual(p.errors, []);
});

await t('4: slider works on leading after a kerning lesson', async () => {
  const p = await page();
  await practise(p); await kernReady(p, 4); await go(p, 6);
  assert.equal(await p.evaluate(() => document.getElementById('slider').disabled), false);
  await p.fill('#slider', '1.35');
  assert.match(await p.textContent('#paraNoteB'), /1\.35/);
});

await t('5: the Answer view does not hide the next lesson', async () => {
  const p = await page();
  await practise(p); await kernReady(p, 4); await p.click('#checkBtn');
  await p.click('[data-view="expert"]'); await p.click('#nextBtn'); await kernReady(p, 6);
  const o = await p.evaluate(() => getComputedStyle(document.getElementById('editableGlyphs')).opacity);
  assert.equal(o, '1');
});

for (const width of [1440, 390]) {
  await t(`6: a drag follows the pointer at ${width}px`, async () => {
    const p = await page({ width });
    await practise(p); await kernReady(p, 4);
    const g = p.locator('#editableGlyphs text[data-i="1"]');
    const before = (await g.boundingBox()).x;
    const b = await g.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
    await p.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2, { steps: 4 }); await p.mouse.up();
    const after = (await g.boundingBox()).x;
    assert.ok(Math.abs(before - after - 20) < 1.5, `moved ${before - after}px`);
  });
}

await t('a swipe on the kerning word scrolls the page on a phone, a letter still drags', async () => {
  const p = await page({ width: 390, height: 700, touch: true });
  await practise(p); await kernReady(p, 4);
  const cdp = await p.context().newCDPSession(p);
  const swipe = async (x0, y0, x1, y1) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let k = 1; k <= 10; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / 10, y: y0 + (y1 - y0) * k / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(300);
  };
  const svg = await p.locator('#kernSvg').boundingBox();
  await swipe(svg.x + 8, svg.y + svg.height / 2, svg.x + 8, svg.y + svg.height / 2 - 150);
  assert.ok(await p.evaluate(() => scrollY) > 50, 'the page did not scroll');
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
  const g = await p.locator('#editableGlyphs text[data-i="1"]').boundingBox();
  await swipe(g.x + g.width / 2, g.y + g.height / 2, g.x + g.width / 2 - 20, g.y + g.height / 2 - 40);
  assert.notEqual(await p.getAttribute('#editableGlyphs text[data-i="1"]', 'aria-valuenow'), '14');
  assert.equal(await p.evaluate(() => scrollY), 0, 'dragging a letter scrolled the page');
});

await t('7: resizing keeps a scored kerning lesson intact', async () => {
  const p = await page();
  await practise(p); await kernReady(p, 4); await p.click('#checkBtn');
  await p.setViewportSize({ width: 1000, height: 800 }); await p.waitForTimeout(400);
  assert.ok(await p.evaluate(() => document.getElementById('kernSvg').classList.contains('scored')));
});

await t('8: flip reverses the drag correctly and resets on the next lesson', async () => {
  const p = await page();
  await practise(p); await kernReady(p, 4);
  await p.click('#flipBtn');
  await p.focus('#editableGlyphs text[data-i="1"]');
  await p.keyboard.press('ArrowRight');
  const v = await p.getAttribute('#editableGlyphs text[data-i="1"]', 'aria-valuenow');
  assert.equal(v, '13'); // started at +14; right on screen when flipped moves it left in the word
  await go(p, 1); await kernReady(p, 6);
  assert.equal(await p.getAttribute('#kernFlip', 'transform'), null);
  assert.equal(await p.getAttribute('#flipBtn', 'aria-pressed'), 'false');
});

await t('9: letters can still be dragged with Blur on', async () => {
  const p = await page();
  await practise(p); await kernReady(p, 4); await p.click('#blurBtn');
  const b = await p.locator('#editableGlyphs text[data-i="2"]').boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.mouse.move(b.x + b.width / 2 + 15, b.y + b.height / 2, { steps: 3 }); await p.mouse.up();
  assert.notEqual(await p.getAttribute('#editableGlyphs text[data-i="2"]', 'aria-valuenow'), '-9');
});

await t('10: kerning works with the keyboard alone', async () => {
  const p = await page();
  await practise(p); await kernReady(p, 4);
  let found = false;
  for (let k = 0; k < 40 && !found; k++) { await p.keyboard.press('Tab'); found = await p.evaluate(() => !!document.activeElement?.closest?.('#editableGlyphs') && document.activeElement.dataset.i === '1'); }
  assert.ok(found, 'letter not reachable by Tab');
  await p.keyboard.press('Shift+ArrowLeft'); await p.keyboard.press('Shift+ArrowLeft'); await p.keyboard.press('ArrowLeft');
  assert.equal(await p.getAttribute('#editableGlyphs text[data-i="1"]', 'aria-valuenow'), '3');
});

await t('11: the three leading lessons show different measures on a phone', async () => {
  const p = await page({ width: 390 });
  await practise(p);
  const widths = [];
  for (const i of [6, 10]) { await go(p, i); await p.waitForTimeout(200); widths.push(await p.evaluate(() => document.getElementById('paraSample').getBoundingClientRect().width / parseFloat(getComputedStyle(document.getElementById('paraSample')).fontSize))); }
  assert.ok(widths[1] > widths[0] * 1.15, JSON.stringify(widths));
});

await t('12: the rag starts with a problem and breaks the same at every width', async () => {
  const shapes = [];
  for (const width of [1440, 900, 390]) {
    const p = await page({ width });
    await practise(p); await go(p, 9); await p.waitForTimeout(300);
    shapes.push(await p.evaluate(() => document.querySelectorAll('.rag-bar').length + ':' + document.getElementById('ragIssue').textContent));
  }
  assert.ok(shapes.every((s) => s === shapes[0]), shapes.join(' / '));
  assert.ok(!shapes[0].endsWith('Balanced rag'), shapes[0]);
});

await t('12b: nonsense text is not a pass', async () => {
  const p = await page();
  await practise(p); await go(p, 9);
  await p.evaluate(() => { const e = document.getElementById('ragEditor'); e.textContent = 'aaaa bbbb cccc dddd '.repeat(8); e.dispatchEvent(new Event('input')); });
  await p.click('#checkBtn');
  assert.ok(+(await p.evaluate(() => document.querySelector('#feedback .score').textContent)) < 50 || (await p.textContent('#feedback')).includes('different paragraph'));
});

await t('13: corrupt saved scores are cleaned up', async () => {
  const p = await page();
  await p.evaluate(() => localStorage.setItem('eye-for-type:v2', JSON.stringify({ index: 11, mode: 'learn', scores: { 0: 'abc', 1: -500, 2: 80, 99: 5, foo: 1 } })));
  await p.reload(); await p.waitForTimeout(800);
  assert.equal(await p.textContent('#finalScore'), '40');
  assert.match(await p.textContent('#finalCopy'), /2 of 11/);
});

await t('14: no console errors across every lesson in both modes', async () => {
  const p = await page();
  for (const m of ['#learnMode', '#testMode']) { await p.click(m); for (let i = 0; i < 12; i++) { await go(p, i); await p.waitForTimeout(250); } }
  await p.waitForTimeout(500);
  assert.deepEqual(p.errors, []);
});

await t('17: switching mode keeps kerning work', async () => {
  const p = await page();
  await practise(p); await kernReady(p, 4);
  await p.focus('#editableGlyphs text[data-i="1"]'); await p.keyboard.press('ArrowLeft');
  await p.click('#learnMode'); await p.click('#testMode'); await kernReady(p, 4);
  assert.equal(await p.getAttribute('#editableGlyphs text[data-i="1"]', 'aria-valuenow'), '13');
});

await t('18: the result is visible after scoring on a phone', async () => {
  const p = await page({ width: 390, height: 700 });
  await practise(p); await go(p, 6); await p.click('#checkBtn'); await p.waitForTimeout(900);
  const b = await p.evaluate(() => document.getElementById('feedback').getBoundingClientRect().top);
  assert.ok(b < 700, 'feedback at ' + b);
});

await t('21: slider has a name, modes and lessons expose state', async () => {
  const p = await page();
  await practise(p); await go(p, 6);
  assert.match(await p.evaluate(() => document.getElementById('slider').labels[0].textContent), /Line height/);
  assert.equal(await p.getAttribute('#testMode', 'aria-pressed'), 'true');
  assert.equal(await p.getAttribute('.lesson[data-i="6"]', 'aria-current'), 'true');
});

await t('score count-up stays out of the live region, final score announced once', async () => {
  const p = await page();
  await practise(p); await go(p, 6); await p.fill('#slider', '1.35');
  // Record every change inside the feedback live region that a screen reader
  // could hear, from the moment the result first appears.
  await p.evaluate(() => {
    const fb = document.getElementById('feedback');
    window.heard = [];
    new MutationObserver((ms) => ms.forEach((m) => {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (el !== fb && !el.closest('[aria-hidden="true"]')) window.heard.push(el.className || el.tagName);
    })).observe(fb, { childList: true, characterData: true, subtree: true });
  });
  await p.click('#checkBtn'); await p.waitForTimeout(900);
  assert.equal(await p.textContent('#feedback .score'), '100');
  assert.deepEqual(await p.evaluate(() => window.heard), []);
  assert.match(await p.textContent('#feedback .sr-only'), /100 out of 100/);
});

await t('final score count-up is hidden from screen readers, total read once', async () => {
  const p = await page();
  await p.evaluate(() => localStorage.setItem('eye-for-type:v2', JSON.stringify({ index: 11, mode: 'learn', scores: { 0: 80, 1: 60 } })));
  await p.reload(); await p.waitForTimeout(900);
  assert.equal(await p.getAttribute('#finalScore', 'aria-hidden'), 'true');
  assert.match(await p.textContent('#finalScoreText'), /70 out of 100/);
});

await t('a kerning word that fails to lay out shows an error and can be retried', async () => {
  const ctx = await context({ viewport: { width: 1440, height: 900 } });
  // Make the reference word report no characters, as it does when the
  // browser hasn't laid it out, until the test lets it through.
  await ctx.addInitScript(() => {
    window.failKern = true;
    const real = SVGTextContentElement.prototype.getNumberOfChars;
    SVGTextContentElement.prototype.getNumberOfChars = function () { return window.failKern ? 0 : real.call(this); };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await practise(p);
  await p.waitForSelector('#kernError:not(.hidden)', { timeout: 5000 });
  assert.match(await p.textContent('#kernError'), /couldn.t set this word/);
  assert.ok(!(await p.isVisible('#checkBtn')), 'See my score is still showing');
  assert.ok(!(await p.isVisible('#kernSvg')), 'the empty stage is still showing');
  await p.evaluate(() => { window.failKern = false; });
  await p.click('#kernRetry'); await kernReady(p, 4);
  assert.ok(await p.isHidden('#kernError'));
  await p.click('#checkBtn');
  await p.waitForSelector('#feedback:not(.hidden)');
  assert.deepEqual(errs, []);
});

await t('feature: perfect kerning scores 100, worst pair is explained', async () => {
  const p = await page();
  await practise(p); await kernReady(p, 4);
  for (const [i, n] of [[1, 14], [2, 9]]) {
    await p.focus(`#editableGlyphs text[data-i="${i}"]`);
    for (let k = 0; k < n; k++) await p.keyboard.press(i === 1 ? 'ArrowLeft' : 'ArrowRight');
  }
  await p.click('#checkBtn'); await p.waitForTimeout(900);
  assert.equal(await p.textContent('#feedback .score'), '100');
  await p.click('#resetBtn'); await kernReady(p, 4); await p.click('#checkBtn'); await p.waitForTimeout(900);
  assert.match(await p.textContent('#feedback .why'), /too (open|tight)/);
});

await t('feature: hold to compare and slide to answer', async () => {
  const p = await page();
  await practise(p); await kernReady(p, 4); await p.click('#checkBtn');
  const hold = await p.locator('#holdBtn').boundingBox();
  await p.mouse.move(hold.x + 5, hold.y + 5); await p.mouse.down();
  assert.ok(await p.evaluate(() => document.getElementById('kernSvg').classList.contains('view-expert')));
  await p.mouse.up();
  assert.ok(!(await p.evaluate(() => document.getElementById('kernSvg').classList.contains('view-expert'))));
  const x0 = await p.getAttribute('#editableGlyphs text[data-i="1"]', 'x');
  await p.click('#slideBtn'); await p.waitForTimeout(900);
  assert.notEqual(await p.getAttribute('#editableGlyphs text[data-i="1"]', 'x'), x0);
});

await t('feature: leading is scored against a range, shown on the slider', async () => {
  const p = await page();
  await practise(p); await go(p, 6); await p.fill('#slider', '1.35'); await p.click('#checkBtn'); await p.waitForTimeout(900);
  assert.equal(await p.textContent('#feedback .score'), '100');
  assert.ok(await p.isVisible('#band'));
});

for (const width of [1440, 390]) {
  await t(`rivers: the Learn demo finds rivers when wide and none when even at ${width}px`, async () => {
    const p = await page({ width });
    await go(p, 8); await p.waitForTimeout(800);
    assert.match(await p.textContent('#riverNote'), /^\d+ rivers?:/);
    assert.ok(await p.evaluate(() => document.querySelector('#riverDemo .rivers').classList.contains('on')));
    await p.click('[data-demo="even"]'); await p.waitForTimeout(400);
    assert.match(await p.textContent('#riverNote'), /^No rivers/);
    assert.deepEqual(p.errors, []);
  });
}

await t('rivers: no rain while practising, rain after scoring, none at a good setting', async () => {
  const p = await page();
  await practise(p); await go(p, 8);
  assert.ok(!(await p.evaluate(() => document.querySelector('#paraCard .rivers').classList.contains('on'))));
  await p.click('#checkBtn'); await p.waitForTimeout(600);
  assert.ok(await p.evaluate(() => document.querySelector('#paraCard .rivers').classList.contains('on')));
  await p.click('#resetBtn'); await p.fill('#slider', '0'); await p.click('#checkBtn'); await p.waitForTimeout(600);
  assert.match(await p.textContent('#feedback'), /No rivers/);
  await go(p, 9);
  assert.ok(!(await p.evaluate(() => document.querySelector('#paraCard .rivers').classList.contains('on'))));
});

await t('rivers: reduced motion draws still channels instead of rain', async () => {
  const ctx = await context({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(600);
  await go(p, 8); await p.waitForTimeout(600);
  const painted = await p.evaluate(() => { const c = document.querySelector('#riverDemo .rivers'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  assert.ok(painted > 50, 'nothing drawn');
  assert.deepEqual(errs, []);
});

await t('controls are at least 44px tall on a phone', async () => {
  const p = await page({ width: 390, height: 844, touch: true });
  const short = async () => p.evaluate(() => [...document.querySelectorAll('.mode button, .seg button, .view-switch button, .fb-actions button, .btn, .lesson-picker')]
    .filter((e) => e.offsetParent).map((e) => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
  await go(p, 8); await p.waitForTimeout(300);
  assert.deepEqual(await short(), []);
  await practise(p); await go(p, 0); await kernReady(p, 4);
  assert.deepEqual(await short(), []);
  await p.click('#checkBtn'); await p.waitForTimeout(300);
  assert.deepEqual(await short(), []);
});

await t('a scored lesson says so to screen readers in the lesson list', async () => {
  const p = await page();
  await p.evaluate(() => localStorage.setItem('eye-for-type:v2', JSON.stringify({ index: 0, mode: 'learn', scores: { 0: 80 } })));
  await p.reload(); await p.waitForTimeout(500);
  assert.equal(await p.locator('.lesson[data-i="0"] [aria-label]').count(), 0);
  assert.match(await p.evaluate(() => document.querySelector('.lesson[data-i="0"]').innerText + '|' + document.querySelector('.lesson[data-i="0"] .done .sr-only').textContent), /scored/);
});

await t('the page works under the security headers in vercel.json', async () => {
  const { readFileSync } = await import('node:fs');
  const conf = JSON.parse(readFileSync(new globalThis.URL('../vercel.json', import.meta.url), 'utf8'));
  const headers = Object.fromEntries((conf.headers || []).find((h) => h.source === '/(.*)')?.headers.map((h) => [h.key.toLowerCase(), h.value]) || []);
  const csp = headers['content-security-policy'];
  assert.ok(csp, 'no Content-Security-Policy in vercel.json');
  for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) assert.ok(csp.includes(d), d);
  for (const k of ['x-content-type-options', 'referrer-policy', 'strict-transport-security', 'permissions-policy']) assert.ok(headers[k], k);
  // Python's server sends no headers, so add them to the page the way Vercel would.
  const ctx = await context({ viewport: { width: 1440, height: 900 } });
  await ctx.route((u) => u.origin === new globalThis.URL(URL).origin && (u.pathname === '/' || u.pathname.endsWith('.html')), async (r) => {
    const res = await r.fetch();
    await r.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': csp } });
  });
  await ctx.addInitScript(() => { window.blocked = []; document.addEventListener('securitypolicyviolation', (e) => window.blocked.push(e.violatedDirective + ' ' + e.blockedURI)); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(URL); await p.waitForFunction(() => document.getElementById('title').textContent.length > 0);
  for (const m of ['#learnMode', '#testMode']) { await p.click(m); for (let i = 0; i < 12; i++) { await go(p, i); await p.waitForTimeout(150); } }
  await go(p, 0); await kernReady(p, 4); await p.click('#checkBtn'); await p.waitForTimeout(800);
  assert.ok(await p.evaluate(() => document.fonts.check('40px "Source Serif 4"')), 'the web font did not load');
  assert.deepEqual(await p.evaluate(() => window.blocked), []);
  assert.deepEqual(errs, []);
});

await t('layout: paragraphs never spill out of their card', async () => {
  for (const width of [1440, 768, 390, 360]) {
    const p = await page({ width });
    await practise(p);
    for (const [i, el, card] of [[6, '#paraSample', '#paraCard'], [7, '#paraSample', '#paraCard'], [9, '#ragEditor', '.rag-card']]) {
      await go(p, i); await p.waitForTimeout(250);
      if (i === 7) await p.fill('#slider', await p.getAttribute('#slider', 'max'));
      const o = await p.evaluate(([el, card]) => document.querySelector(el).getBoundingClientRect().right - document.querySelector(card).getBoundingClientRect().right, [el, card]);
      assert.ok(o <= 0, `${width}px lesson ${i}: spills ${o}px`);
    }
  }
});

await t('layout: no sideways scroll at 1440, 1024, 768, 390, 360', async () => {
  for (const width of [1440, 1024, 768, 390, 360]) {
    const p = await page({ width });
    for (const m of ['#learnMode', '#testMode']) {
      await p.click(m);
      for (const i of [0, 6, 7, 8, 9, 11]) { await go(p, i); await p.waitForTimeout(150); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.equal(o, 0, `${width}px ${m} lesson ${i}: ${o}px`); }
    }
  }
});

await browser.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
