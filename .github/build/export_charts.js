/**
 * هر نمودار را در یک صفحهٔ خالی و مستقل رندر می‌کند و PNG می‌گیرد —
 * برای جاسازی در اسلایدهای پاورپوینت.
 *
 * استفاده: node export_charts.js <baseUrl> <outDir>
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const WebSocket = require("ws");

// روی گیت‌هاب اکشنز کروم جای دیگری است؛ مسیر از محیط خوانده می‌شود
const CHROME = process.env.CHROME_PATH
  || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9347;
const base = process.argv[2];
const outDir = process.argv[3];

// نام فایل -> [سازندهٔ نمودار، ورودی، عرض، ارتفاع]
const CHARTS = [
  ["butterfly", "tierButterfly", { province: "کل کشور" }, 1500, 700],
  ["intensity", "intensityChart", { province: "کل کشور" }, 1500, 700],
  ["sankey", "sankeyChart", { province: "کل کشور", half: "h1" }, 1500, 700],
  ["lorenz", "lorenzChart", { province: "کل کشور", half: "h1" }, 1200, 700],
  ["map", "iranMap", { metric: "over_pattern" }, 1400, 760],
  ["heat", "heatmapChart", { mode: "cons" }, 1500, 780],
  ["climate", "climateScatter", {}, 1500, 700],
  ["season", "seasonDumbbell", {}, 1400, 780],
  ["donut", "donutPair", { half: "h1" }, 1400, 700],
  ["treemap", "treemapChart", { province: "کل کشور" }, 1400, 640],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = p => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: PORT, path: p }, r => {
    let b = ""; r.on("data", d => b += d);
    r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
  }).on("error", rej);
});

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const ch = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(os.tmpdir(), "nigc-charts")}`,
    "--no-first-run", "--disable-gpu", "--hide-scrollbars",
    "--window-size=1600,900", "about:blank"
  ], { stdio: "ignore" });

  let t = null;
  for (let i = 0; i < 60 && !t; i++) {
    await sleep(300);
    try { t = await getJSON("/json/list"); } catch (e) { /* هنوز */ }
  }
  const pg = t.find(x => x.type === "page");
  const ws = new WebSocket(pg.webSocketDebuggerUrl,
    { perMessageDeflate: false, maxPayload: 5e8 });
  let id = 0; const pend = new Map();
  ws.on("message", r => {
    const m = JSON.parse(r);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  });
  await new Promise(r => ws.on("open", r));
  const send = (me, pa) => new Promise(res => {
    const n = ++id; pend.set(n, res);
    ws.send(JSON.stringify({ id: n, method: me, params: pa || {} }));
  });
  const evalJS = async expr => {
    const r = await send("Runtime.evaluate",
      { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) {
      console.log("  JS ERR:", JSON.stringify(r.result.exceptionDetails).slice(0, 200));
    }
    return r.result && r.result.result ? r.result.result.value : null;
  };

  await send("Page.enable");
  await send("Runtime.enable");

  for (const [name, fn, opts, w, h] of CHARTS) {
    // هر نمودار در ویوپورت اختصاصی خودش رندر می‌شود تا اندازه‌اش دقیق باشد
    await send("Emulation.setDeviceMetricsOverride",
      { width: w, height: h, deviceScaleFactor: 2, mobile: false });
    await send("Page.navigate", { url: `${base}/chart-frame.html` });
    await sleep(2500);

    const ok = await evalJS(
      `window.renderOne(${JSON.stringify(fn)}, ${JSON.stringify(opts)})`);
    if (!ok) { console.log("  ! رندر نشد:", name); continue; }
    await sleep(1400);

    const shot = await send("Page.captureScreenshot", { format: "png" });
    // بدون این بررسی، خطای CDP به شکل «Cannot read properties of undefined»
    // بیرون می‌آید که علت واقعی را پنهان می‌کند.
    if (!shot.result || !shot.result.data) {
      console.error("captureScreenshot failed for " + name + ":",
                    JSON.stringify(shot).slice(0, 300));
      process.exit(1);
    }
    const file = path.join(outDir, name + ".png");
    fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    console.log(`saved ${name}.png  ${w * 2}x${h * 2}  ` +
                `${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }

  ws.close(); ch.kill(); process.exit(0);
})();
