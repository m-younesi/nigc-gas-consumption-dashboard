/**
 * صفحهٔ گزارش را با کروم بی‌سر به PDF تبدیل می‌کند (A4 عمودی، با پس‌زمینه).
 * استفاده: node export_pdf.js <url> <out.pdf> [waitMs]
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");

// روی گیت‌هاب اکشنز کروم جای دیگری است؛ مسیر از محیط خوانده می‌شود
const CHROME = process.env.CHROME_PATH
  || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9337;

const url = process.argv[2];
const out = process.argv[3];
const waitMs = parseInt(process.argv[4] || "7000", 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = p => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: PORT, path: p }, r => {
    let b = ""; r.on("data", d => b += d);
    r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
  }).on("error", rej);
});

(async () => {
  const profile = path.join(process.env.TEMP || ".", "nigc-pdf-profile");
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--hide-scrollbars", "--window-size=1000,1400", "about:blank"
  ], { stdio: "ignore" });

  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) {
    await sleep(300);
    try { targets = await getJSON("/json/list"); } catch (e) { /* هنوز */ }
  }
  const page = targets.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl,
    { perMessageDeflate: false, maxPayload: 1024 * 1024 * 1024 });
  let id = 0; const pending = new Map(); const events = [];
  ws.on("message", raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else events.push(m);
  });
  await new Promise(r => ws.on("open", r));
  const send = (method, params) => new Promise(res => {
    const n = ++id; pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params: params || {} }));
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  // ویوپورت باید دست‌کم به پهنای A4 (۷۹۴ پیکسل CSS) باشد تا چیدمان نشکند
  await send("Emulation.setDeviceMetricsOverride",
    { width: 900, height: 1400, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  await sleep(waitMs);

  const errs = events.filter(e =>
    e.method === "Runtime.exceptionThrown" ||
    (e.method === "Log.entryAdded" && e.params.entry.level === "error"));
  errs.slice(0, 10).forEach(e => {
    const d = e.params.exceptionDetails;
    console.log("  ERR " + (d ? ((d.exception || {}).description || d.text)
      : e.params.entry.text));
  });

  const pdf = await send("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    transferMode: "ReturnAsBase64"
  });
  if (!pdf.result || !pdf.result.data) {
    console.error("printToPDF failed:", JSON.stringify(pdf).slice(0, 400));
    process.exit(1);
  }
  fs.writeFileSync(out, Buffer.from(pdf.result.data, "base64"));
  console.log("saved", out, (fs.statSync(out).size / 1024).toFixed(0), "KB");

  ws.close(); chrome.kill(); process.exit(0);
})();
