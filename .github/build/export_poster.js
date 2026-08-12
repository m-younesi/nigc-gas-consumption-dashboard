/**
 * پوستر را در یک ویوپورت به‌اندازهٔ کل ارتفاعش باز می‌کند و یک‌جا عکس می‌گیرد.
 * (اگر بعد از رندر ابعاد را عوض کنیم، کانواس‌های ECharts پاک می‌شوند.)
 *
 * استفاده: node export_poster.js <url> <out.png> [width] [scale]
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
const PORT = 9336;

const url = process.argv[2];
const out = process.argv[3];
const width = parseInt(process.argv[4] || "1400", 10);
const scale = parseFloat(process.argv[5] || "2");

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = p => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: PORT, path: p }, r => {
    let b = ""; r.on("data", d => b += d);
    r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
  }).on("error", rej);
});

(async () => {
  const profile = path.join(os.tmpdir(), "nigc-poster-profile");
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--hide-scrollbars", `--window-size=${width},1200`, "about:blank"
  ], { stdio: "ignore" });

  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) {
    await sleep(300);
    try { targets = await getJSON("/json/list"); } catch (e) { /* هنوز */ }
  }
  const page = targets.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl,
    { perMessageDeflate: false, maxPayload: 1024 * 1024 * 1024 });
  let id = 0; const pending = new Map();
  ws.on("message", raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise(r => ws.on("open", r));
  const send = (method, params) => new Promise(res => {
    const n = ++id; pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params: params || {} }));
  });
  const evalJS = async expr => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return r.result && r.result.result ? r.result.result.value : null;
  };

  await send("Page.enable");
  await send("Runtime.enable");

  // پاس اول: فقط برای اندازه‌گیری ارتفاع واقعی پوستر
  await send("Emulation.setDeviceMetricsOverride",
    { width, height: 1200, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  await sleep(4000);
  const h = await evalJS("document.getElementById('poster').getBoundingClientRect().height");
  const full = Math.ceil(h);
  console.log("poster height:", full);

  // پاس دوم: ویوپورت به همان ارتفاع، بارگذاری دوباره، سپس یک عکس
  await send("Emulation.setDeviceMetricsOverride",
    { width, height: full, deviceScaleFactor: scale, mobile: false });
  await send("Page.navigate", { url });
  await sleep(6500);

  // clip.scale نباید دوباره ضریب بخورد؛ deviceScaleFactor بالا اعمال شده است
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width: width, height: full, scale: 1 }
  });
  if (!shot.result || !shot.result.data) {
    console.error("captureScreenshot failed:", JSON.stringify(shot).slice(0, 300));
    process.exit(1);
  }
  fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log("saved", out, (fs.statSync(out).size / 1024 / 1024).toFixed(2), "MB",
    `${width * scale}x${full * scale}`);

  ws.close(); chrome.kill(); process.exit(0);
})();
