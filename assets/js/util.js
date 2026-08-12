/* ==========================================================================
   ابزارهای مشترک: اعداد فارسی، توکن‌های رنگ، تم ECharts، ظهور با اسکرول
   ========================================================================== */
(function (global) {
  "use strict";

  /* --------------------------------------------------------- اعداد و قالب‌بندی */
  var FA = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

  /** ارقام لاتین را به فارسی برمی‌گرداند و ممیز را به «٫». */
  function fa(value) {
    return String(value).replace(/\d/g, function (d) { return FA[+d]; }).replace(/\./g, "٫");
  }

  /** عدد را با تعداد رقم اعشار مشخص و ارقام فارسی برمی‌گرداند. */
  function faNum(value, decimals) {
    if (value === null || value === undefined || isNaN(value)) return "—";
    var d = decimals === undefined ? 1 : decimals;
    return fa(Number(value).toFixed(d));
  }

  /** درصد با علامت. */
  function faPct(value, decimals) { return faNum(value, decimals) + "٪"; }

  /** ضریب، مثل «۵٫۲ برابر». */
  function faTimes(value) { return faNum(value, 1) + "×"; }

  /* --------------------------------------------------------------- توکن رنگ */
  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /** همهٔ رنگ‌های موردنیاز نمودارها را از CSS می‌خواند تا تعویض تم خودکار باشد. */
  function palette() {
    return {
      subs: token("--c-subs"),
      gas: token("--c-gas"),
      gasLift: token("--c-gas-lift"),
      groups: [token("--g1"), token("--g2"), token("--g3"), token("--g4")],
      seq: ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7"].map(token),
      div: ["--d-neg-3", "--d-neg-2", "--d-neg-1", "--d-mid",
            "--d-pos-1", "--d-pos-2", "--d-pos-3"].map(token),
      ink: token("--ink"),
      ink2: token("--ink-2"),
      muted: token("--ink-muted"),
      grid: token("--grid"),
      axis: token("--axis"),
      surface: token("--surface-1"),
      surface2: token("--surface-2"),
      surface3: token("--surface-3"),
      border: token("--border"),
      ok: token("--ok"),
      critical: token("--critical")
    };
  }

  /* ----------------------------------------------------- تم پایهٔ نمودارها */
  /** گزینه‌های پایه که همهٔ نمودارها با آن ادغام می‌شوند (RTL، فونت، تولتیپ). */
  function baseOption() {
    var p = palette();
    return {
      textStyle: { fontFamily: "Estedad, system-ui, sans-serif", color: p.ink2 },
      animationDuration: 700,
      animationEasing: "cubicOut",
      tooltip: {
        backgroundColor: p.surface2,
        borderColor: p.border,
        borderWidth: 1,
        padding: [9, 12],
        extraCssText: "border-radius:10px;box-shadow:0 8px 28px -8px rgba(0,0,0,.45);" +
                      "direction:rtl;text-align:right;backdrop-filter:blur(6px);",
        textStyle: { color: p.ink, fontSize: 12.5, fontFamily: "Estedad, sans-serif" }
      }
    };
  }

  /** محور دسته‌ای/عددی با ظاهر یکدست و کم‌رنگ. */
  function axis(opts) {
    var p = palette();
    return Object.assign({
      axisLine: { lineStyle: { color: p.axis } },
      axisTick: { show: false },
      axisLabel: { color: p.muted, fontSize: 11.5, fontFamily: "Estedad, sans-serif" },
      splitLine: { lineStyle: { color: p.grid, type: [4, 4] } },
      nameTextStyle: { color: p.muted, fontSize: 11.5 }
    }, opts || {});
  }

  /* ------------------------------------------------------- رنگ از رمپ پیوسته */
  /** یک مقدار در بازهٔ [min,max] را به رنگی از رمپ می‌نگارد (درون‌یابی خطی). */
  function rampColor(value, min, max, ramp) {
    if (value === null || value === undefined || isNaN(value)) return palette().surface3;
    var t = max === min ? 0.5 : (value - min) / (max - min);
    t = Math.max(0, Math.min(1, t));
    var pos = t * (ramp.length - 1);
    var i = Math.min(ramp.length - 2, Math.floor(pos));
    return mix(ramp[i], ramp[i + 1], pos - i);
  }

  function hexToRgb(hex) {
    var h = hex.replace("#", "").trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function mix(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return "rgb(" + x.map(function (v, i) {
      return Math.round(v + (y[i] - v) * t);
    }).join(",") + ")";
  }

  /** رنگ با شفافیت. */
  function alpha(hex, a) {
    if (hex.indexOf("rgb") === 0) return hex.replace(/^rgb\(/, "rgba(").replace(/\)$/, "," + a + ")");
    var c = hexToRgb(hex);
    return "rgba(" + c.join(",") + "," + a + ")";
  }

  /* ------------------------------------------------------------- کمکی‌های DOM */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;  // صفت را اصلاً نگذار
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  /* -------------------------------------------------- شمارندهٔ متحرک سرصفحه */
  function countUp(node, target, decimals, suffix) {
    var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dur = 1100, t0 = null;
    if (reduced) { node.textContent = faNum(target, decimals) + (suffix || ""); return; }
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      node.textContent = faNum(target * eased, decimals) + (suffix || "");
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  global.U = {
    fa: fa, faNum: faNum, faPct: faPct, faTimes: faTimes,
    palette: palette, token: token, baseOption: baseOption, axis: axis,
    rampColor: rampColor, mix: mix, alpha: alpha,
    $: $, $$: $$, el: el, countUp: countUp
  };
})(window);
