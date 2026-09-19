// T35 v2 撮影＋gold: 同じ headless Chrome（CDP）で「測る」と「撮る」を行う（iframe の DOM 値と headless の描画で 375 の縦位置が 300〜700px ずれ、R8 が 6 頁で空白になった＝v1 の失敗）。
//   node shoot_cdp.mjs  → shots/<page>/{375|1280}_first.png・<w>_R<n>.png（R2 は H2 を 1 本ずつ等倍で切って縦に並べる）・gold_v2.json（同じ描画の DOM 値）・manifest.json（sha・版・時刻・viewport・dsf）
//   Chrome は --remote-debugging-port で起動し、Page.captureScreenshot の clip で等倍切り出し（captureBeyondViewport）。
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4323';
const PAGES = ['/', '/about/', '/lab/', '/lab/green-is-not-proof/', '/works/', '/works/repair/', '/works/pricing/', '/works/flow/', '/works/contact/', '/works/guide/', '/works/guide/outsourced-unfinished/', '/works/cases/integrity-warning/'];
const OUT = join(process.cwd(), 'shots'); mkdirSync(OUT, { recursive: true });
const PORT = 9333; const PAD = 40;
const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, '--headless=new', '--hide-scrollbars', '--disable-gpu', '--force-device-scale-factor=1', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const manifest = { commit: '7bec67f', base: BASE, chrome: null, capture_started: new Date().toISOString(), device_scale_factor: 1, generator: 'shoot_cdp.mjs', generator_sha256_16: sha(readFileSync(new URL(import.meta.url))), pad: PAD, items: [] };
manifest.chrome = (await send('Browser.getVersion')).result?.product;
const gold = {};
// 同じ描画で測る（gold）＋ 各ルールの矩形。R1＝main の中の文字（nav・パンくず・form・button・小ナビ・目次・footer は除く）
const MEASURE = `(() => { const px = (v) => parseFloat(v) || 0; const vis = (e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
 const R = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)]; };
 const EXCL = 'nav, .crumbs, form, button, .works-nav, .toc-block, footer, .site-header, .site-footer';
 const textEls = [...document.querySelectorAll('main *')].filter((e) => !['SCRIPT','STYLE','SVG','PATH','NOSCRIPT'].includes(e.tagName) && !e.closest(EXCL) && vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
 const minEl = textEls.sort((a, b) => px(getComputedStyle(a).fontSize) - px(getComputedStyle(b).fontSize))[0];
 const h2s = [...document.querySelectorAll('h2')].filter(vis);
 const h2sizes = [...new Set(h2s.map((h) => getComputedStyle(h).fontSize))];
 const h2pick = []; const seen = new Set(); for (const h of h2s) { const s = getComputedStyle(h).fontSize; if (!seen.has(s) || h2pick.length < 2) { seen.add(s); h2pick.push(h); } if (h2pick.length >= 4) break; }
 const para = [...document.querySelectorAll('main p, article p, .prose p')].filter(vis).sort((a, b) => b.textContent.length - a.textContent.length)[0];
 const pw = para ? para.getBoundingClientRect().width : null, pf = para ? px(getComputedStyle(para).fontSize) : null;
 const h1 = document.querySelector('h1'); const h1lines = h1 ? Math.round(h1.getBoundingClientRect().height / px(getComputedStyle(h1).lineHeight)) : null;
 const ch = [...document.querySelectorAll('.form .choices')].filter(vis); const ch4 = ch.length > 1 ? ch[1] : null;
 const q = (sel) => { const els = [...document.querySelectorAll(sel)].filter(vis); return els.length ? els.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0] : null; };
 const els = { R6: q('.toc-block summary'), R7: q('.toc-block li a'), R8: q('.site-footer .footer-map a'), R9: q('.works-nav a'), R10: q('.crumbs a') };
 const h = (e) => e ? Math.round(e.getBoundingClientRect().height) : null;
 return { H: document.documentElement.scrollHeight, values: { minFont: minEl ? px(getComputedStyle(minEl).fontSize) : null, h2sizes, lineLenEm: pw && pf ? +(pw / pf).toFixed(1) : null, h1lines, choices4: ch4 ? Math.round(ch4.getBoundingClientRect().height) : null, R6: h(els.R6), R7: h(els.R7), R8: h(els.R8), R9: h(els.R9), R10: h(els.R10) },
   rects: { R1: minEl ? R(minEl) : null, R2: h2pick.map(R), R3: para ? R(para) : null, R4: h1 ? R(h1) : null, R5: ch4 ? R(ch4) : null, R6: els.R6 ? R(els.R6) : null, R7: els.R7 ? R(els.R7) : null, R8: els.R8 ? R(els.R8) : null, R9: els.R9 ? R(els.R9) : null, R10: els.R10 ? R(els.R10) : null } }; })()`;
async function shot(clip, file) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: 1 } });
  const buf = Buffer.from(r.result.data, 'base64'); writeFileSync(file, buf); return buf;
}
const NEED = { R1: ['375', '1280'], R2: ['375', '1280'], R3: ['1280'], R4: ['375'], R5: ['375'], R6: ['375'], R7: ['375'], R8: ['375'], R9: ['375'], R10: ['375'] };
for (const page of PAGES) {
  const slug = page.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'top'; const dir = join(OUT, slug); mkdirSync(dir, { recursive: true }); gold[page] = {};
  for (const [w, fh, mobile] of [[375, 812, true], [1280, 800, false]]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: fh, deviceScaleFactor: 1, mobile });
    await send('Page.navigate', { url: BASE + page }); await new Promise((r) => setTimeout(r, 1500));
    await evalJs('document.fonts.ready.then(() => true)'); await new Promise((r) => setTimeout(r, 400));
    // 入場アニメーション（[data-reveal] は画面に入るまで opacity 0）＝画面外の切り出しが空白になるので、全部「入った」状態にしてから測る・撮る
    await evalJs("document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')); true"); await new Promise((r) => setTimeout(r, 300));
    const m = await evalJs(MEASURE); gold[page][w] = m.values;
    const rec = (rule, buf, file, extra) => manifest.items.push({ page, w, rule, file: file.replace(process.cwd() + '\\', ''), sha256_16: sha(buf), ...extra });
    const f1 = join(dir, `${w}_first.png`); rec('first', await shot([0, 0, w, fh], f1), f1, { px: [w, fh] });
    for (const [rule, widths] of Object.entries(NEED)) {
      if (!widths.includes(String(w))) continue;
      const r = m.rects[rule]; if (!r || (Array.isArray(r) && r.length === 0)) continue;
      if (rule === 'R2') {  // H2 を 1 本ずつ等倍で切って縦に並べる（縦長の全頁を見せない）
        const parts = [];
        for (const [i, b] of r.entries()) { const f = join(dir, `${w}_R2_${i + 1}.png`); const buf = await shot([Math.max(0, b[0] - PAD), Math.max(0, b[1] - PAD), Math.min(w, b[2] + 2 * PAD), b[3] + 2 * PAD], f); rec('R2', buf, f, { px: [Math.min(w, b[2] + 2 * PAD), b[3] + 2 * PAD], box: b }); parts.push(f); }
        continue;
      }
      const b = r; const cw = rule === 'R1' ? Math.min(w, Math.max(b[2] + 2 * PAD, 360)) : Math.min(w, b[2] + 2 * PAD);  // R1 は小さい語なので横に 360px は見せる
      const clip = [Math.max(0, Math.min(b[0] - PAD, w - cw)), Math.max(0, b[1] - PAD), cw, b[3] + 2 * PAD];
      const f = join(dir, `${w}_${rule}.png`); const buf = await shot(clip, f); rec(rule, buf, f, { px: [clip[2], clip[3]], box: b });
    }
    console.log(slug, w, JSON.stringify(m.values));
  }
}
writeFileSync(join(process.cwd(), 'gold_v2_measurements.json'), JSON.stringify({ commit: '7bec67f', chrome: manifest.chrome, note: '撮影と同じ headless Chrome（CDP）で測った DOM 値。R1＝main 内の文字（nav・パンくず・form・button・小ナビ・目次・footer を除く）', pages: gold }, null, 1));
manifest.capture_finished = new Date().toISOString();
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
ws.close(); chrome.kill(); console.log('done', manifest.items.length, 'files');
