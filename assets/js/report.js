/* ==========================================================================
   گزارش چاپی — همان نمودارهای وب‌اپ، تنظیم‌شده برای صفحهٔ A4 در حالت روشن
   ========================================================================== */
(function () {
  "use strict";

  var D = window.NIGC, H = D.headline, NAT = D.national;
  var el = U.el;
  var GROUP_LABELS = CHARTS.GROUP_LABELS, GROUP_KEYS = CHARTS.GROUP_KEYS;
  var TIER_LABELS = CHARTS.TIER_LABELS;

  function mount(id, option) {
    var dom = document.getElementById(id);
    if (!dom) return;
    echarts.init(dom, null, { renderer: "canvas" }).setOption(option, true);
  }

  /** اندازهٔ قلم نمودار را برای صفحهٔ کاغذ کوچک می‌کند. */
  function shrink(option, s) {
    (function walk(node) {
      if (!node || typeof node !== "object") return;
      Object.keys(node).forEach(function (k) {
        var v = node[k];
        if (k === "fontSize" && typeof v === "number") node[k] = Math.max(6, v * s);
        else if (v && typeof v === "object") walk(v);
      });
    })(option);
    option.animation = false;   // خروجی چاپی نباید منتظر انیمیشن بماند
    return option;
  }

  /* ------------------------------------------------------------- خلاصه */
  function buildSummary() {
    var host = document.getElementById("rStats");
    [
      { v: U.faNum(H.low_count, 1), s: "٪", k: "مشترکین گروه کم‌مصرف",
        d: "که " + U.faPct(H.low_cons, 1) + " از گاز را مصرف می‌کنند", c: "var(--c-subs)" },
      { v: U.faNum(H.over_pattern, 1), s: "٪", k: "گاز سوخته بالاتر از الگو",
        d: "توسط تنها " + U.faPct(H.over_pattern_count, 1) + " از مشترکین", c: "var(--c-gas)" },
      { v: U.faNum(H.top10, 1), s: "٪", k: "سهم ۱۰٪ پرمصرف‌ترین",
        d: "نیمهٔ کم‌مصرف تنها " + U.faPct(H.bottom50, 1) + " را می‌برد", c: "var(--g3)" },
      { v: U.faNum(H.gini, 3), s: "", k: "ضریب جینی مصرف",
        d: "کران پایین نابرابری واقعی", c: "var(--g4)" },
      { v: U.faNum(H.very_multiplier, 1), s: "×", k: "شدت گروه بسیار پرمصرف",
        d: U.faPct(H.very_count, 1) + " مشترک → " + U.faPct(H.very_cons, 1) + " گاز",
        c: "var(--critical)" },
      { v: U.faNum(H.tier12_multiplier, 1), s: "×", k: "شدت مشترک پلهٔ ۱۲",
        d: "معادل حدود ۱۱ مشترک پلهٔ ۱", c: "var(--critical)" }
    ].forEach(function (t) {
      host.appendChild(el("div", { class: "rstat", style: "--accent:" + t.c }, [
        el("div", { class: "v", html: t.v + (t.s ? "<small>" + t.s + "</small>" : "") }),
        el("div", { class: "k", text: t.k }),
        el("div", { class: "d", text: t.d })
      ]));
    });

    var res = D.rankings.climate_residual;
    var g = D.rankings.gini;
    var findings = [
      "<b>ته نردبان شلوغ است.</b> " + U.faPct(H.low_count, 1) + " از مشترکین کشور در " +
      "گروه کم‌مصرف (پله‌های ۱ تا ۳) قرار دارند، اما سهمشان از گاز " +
      U.faPct(H.low_cons, 1) + " است. اختلاف این دو عدد، همان باری است که روی " +
      "دوش پله‌های بالاتر افتاده.",

      "<b>نوک نردبان گران است.</b> گروه بسیار پرمصرف با " + U.faPct(H.very_count, 1) +
      " از مشترکین، " + U.faPct(H.very_cons, 1) + " از گاز را می‌سوزاند — یعنی " +
      U.faTimes(H.very_multiplier) + " مشترک متوسط کشور. در پلهٔ ۱۲ این ضریب به " +
      U.faTimes(H.tier12_multiplier) + " می‌رسد.",

      "<b>تمرکز مصرف قابل اندازه‌گیری است.</b> پرمصرف‌ترین ده درصد مشترکین " +
      U.faPct(H.top10, 1) + " از گاز خانگی را می‌برند، در حالی که نیمهٔ کم‌مصرف روی هم " +
      U.faPct(H.bottom50, 1) + " مصرف می‌کند. ضریب جینی کشوری " + U.faNum(H.gini, 3) +
      " است و دامنهٔ آن میان استان‌ها " + U.faNum(H.spread_gini, 3) + " واحد اختلاف دارد — " +
      "از " + g[0].province + " تا " + g[g.length - 1].province + ".",

      "<b>اقلیم همهٔ ماجرا نیست.</b> میانگین دمای استان تنها " +
      U.faPct(D.climate.over_pattern.r2 * 100, 0) + " از پراکندگی مصرف مازاد بر الگو را " +
      "توضیح می‌دهد. <b>" + res[0].province + "</b> با " + U.faNum(res[0].value, 1) +
      " واحد بالاتر از انتظار اقلیمی‌اش مصرف می‌کند و <b>" +
      res[res.length - 1].province + "</b> با " + U.faNum(res[res.length - 1].value, 1) +
      " واحد پایین‌تر. استان‌های خزری با وجود اقلیم معتدل بالای خط برازش می‌نشینند؛ " +
      "نشانه‌ای از نقش رطوبت، کیفیت عایق‌بندی و الگوی سکونت."
    ];
    var ol = document.getElementById("rFindings");
    findings.forEach(function (f) { ol.appendChild(el("li", { html: f })); });
  }

  /* -------------------------------------------------------------- وافل */
  function hundred(values) {
    var floors = values.map(function (v) { return Math.floor(v); });
    var used = floors.reduce(function (a, b) { return a + b; }, 0);
    var rests = values.map(function (v, i) { return { i: i, r: v - Math.floor(v) }; })
      .sort(function (a, b) { return b.r - a.r; });
    for (var k = 0; k < 100 - used; k++) floors[rests[k % rests.length].i]++;
    var cells = [];
    floors.forEach(function (n, gi) { for (var j = 0; j < n; j++) cells.push(gi); });
    return cells.slice(0, 100);
  }

  function buildWaffles() {
    var p = U.palette();
    var host = document.getElementById("rWaffles");
    // در گزارش، دو نوار افقی ۱۰۰تایی بهتر از دو مربع جا می‌شود
    [
      { t: "۱۰۰ مشترک", vals: GROUP_KEYS.map(function (k) { return NAT.h1_count_g[k]; }) },
      { t: "۱۰۰ واحد گاز", vals: GROUP_KEYS.map(function (k) { return NAT.h1_cons_g[k]; }) }
    ].forEach(function (blk) {
      var grid = el("div", {
        style: "display:grid;grid-template-columns:repeat(50,1fr);gap:1.5px;margin-bottom:2.5mm"
      });
      hundred(blk.vals).forEach(function (gi) {
        grid.appendChild(el("i", {
          style: "aspect-ratio:1;border-radius:2px;background:" + p.groups[gi] + ";display:block"
        }));
      });
      host.appendChild(el("div", {
        style: "font-size:8pt;font-weight:700;margin-bottom:1mm", text: blk.t
      }));
      host.appendChild(grid);
    });

    var leg = document.getElementById("rWaffleLegend");
    GROUP_LABELS.forEach(function (label, i) {
      leg.appendChild(el("span", {
        html: '<i style="background:' + p.groups[i] + '"></i>' + label
      }));
    });
  }

  /* ------------------------------------------------------------ جدول‌ها */
  function table(id, head, rows, opts) {
    var t = document.getElementById(id);
    if (!t) return;
    var thead = el("thead"), tr = el("tr");
    head.forEach(function (h) { tr.appendChild(el("th", { text: h, scope: "col" })); });
    thead.appendChild(tr);
    t.appendChild(thead);

    var tbody = el("tbody");
    rows.forEach(function (cells) {
      var r = el("tr", (opts && opts.totalLast && cells === rows[rows.length - 1])
        ? { class: "tot" } : {});
      cells.forEach(function (c) {
        r.appendChild(el("td", typeof c === "object" ? c : { text: c }));
      });
      tbody.appendChild(r);
    });
    t.appendChild(tbody);
  }

  function barCell(value, max, tone) {
    return {
      html: '<span class="rbar" style="--tone:' + tone + '">' +
        '<span style="width:34px;text-align:left">' + U.faNum(value, 3) + '</span>' +
        '<span class="tr"><span style="width:' + (value / max * 100) + '%"></span></span>' +
        '</span>'
    };
  }

  function buildTables() {
    var p = U.palette();

    // --- جینی به تفکیک استان، دو ستونه در یک جدول ---
    var g = D.rankings.gini;
    var max = g[0].value;
    var half = Math.ceil(g.length / 2);
    var rows = [];
    for (var i = 0; i < half; i++) {
      var a = g[i], b = g[i + half];
      rows.push([
        U.fa(i + 1), a.province, barCell(a.value, max, p.gas),
        b ? U.fa(i + half + 1) : "", b ? b.province : "",
        b ? barCell(b.value, max, p.subs) : ""
      ]);
    }
    table("rGiniTable", ["#", "استان", "جینی", "#", "استان", "جینی"], rows);

    // --- باقیماندهٔ اقلیمی ---
    var res = D.rankings.climate_residual;
    table("rResidTop", ["استان", "واقعی", "انتظار", "اختلاف"],
      res.slice(0, 7).map(function (r) {
        var rr = CHARTS.rec(r.province);
        return [r.province, U.faPct(rr.h1_over_pattern, 1),
          U.faPct(rr.climate_expected, 1), "+" + U.faNum(r.value, 1)];
      }));
    table("rResidBottom", ["استان", "واقعی", "انتظار", "اختلاف"],
      res.slice(-7).reverse().map(function (r) {
        var rr = CHARTS.rec(r.province);
        return [r.province, U.faPct(rr.h1_over_pattern, 1),
          U.faPct(rr.climate_expected, 1), U.faNum(r.value, 1)];
      }));

    // --- جدول اصلی شاخص‌ها ---
    var main = D.provinces.slice().sort(function (a, b) {
      return b.h1_over_pattern - a.h1_over_pattern;
    });
    table("rMainTable",
      ["استان", "مازاد بر الگو", "سهم پرمصرف‌ها", "سهم ۱۰٪ بالا", "جینی",
       "پلهٔ میانه", "مشترکین الگو", "دما", "انحراف اقلیمی"],
      main.map(function (r) {
        return [r.province, U.faNum(r.h1_over_pattern, 1), U.faNum(r.h1_tail_cons, 1),
          U.faNum(r.h1_top10, 1), U.faNum(r.h1_gini, 3),
          U.faNum(Math.floor(r.h1_median_tier), 0), U.faNum(r.h1_count_g.low, 1),
          U.faNum(r.temp, 1), U.faNum(r.climate_residual, 1)];
      }).concat([[
        "کل کشور", U.faNum(NAT.h1_over_pattern, 1), U.faNum(NAT.h1_tail_cons, 1),
        U.faNum(NAT.h1_top10, 1), U.faNum(NAT.h1_gini, 3),
        U.faNum(Math.floor(NAT.h1_median_tier), 0), U.faNum(NAT.h1_count_g.low, 1), "—", "—"
      ]]), { totalLast: true });

    // --- جدول‌های خام ۱۲ پله ---
    var tierHead = ["استان"].concat(TIER_LABELS);
    function rawRows(key) {
      return D.provinces.map(function (r) {
        return [r.province].concat(r[key].map(function (v) { return U.faNum(v, 1); }));
      }).concat([["کل کشور"].concat(NAT[key].map(function (v) { return U.faNum(v, 1); }))]);
    }
    table("rConsTable", tierHead, rawRows("h1_cons"), { totalLast: true });
    table("rCountTable", tierHead, rawRows("h1_count"), { totalLast: true });
  }

  /* ------------------------------------------------------------ نمودارها */
  function buildCharts() {
    var s = 0.82;

    mount("rButterfly", shrink(CHARTS.tierButterfly(
      document.getElementById("rButterfly"), { province: "کل کشور" }), s));
    mount("rIntensity", shrink(CHARTS.intensityChart(
      document.getElementById("rIntensity"), { province: "کل کشور" }), s));
    mount("rLorenz", shrink(CHARTS.lorenzChart(
      document.getElementById("rLorenz"), { province: "کل کشور", half: "h1" }), s));
    mount("rSankey", shrink(CHARTS.sankeyChart(
      document.getElementById("rSankey"), { province: "کل کشور", half: "h1" }), s));
    mount("rSeason", shrink(CHARTS.seasonDumbbell(
      document.getElementById("rSeason"), {}), s));
    mount("rClimate", shrink(CHARTS.climateScatter(
      document.getElementById("rClimate"), {}), s));

    // مقایسهٔ بین‌المللی: داده از content.json می‌آید، پس ممکن است خالی باشد
    var intl = (window.NIGC_CONTENT && window.NIGC_CONTENT.analysis
                && window.NIGC_CONTENT.analysis.international) || {};
    if (document.getElementById("rBench1")) {
      mount("rBench1", shrink(CHARTS.benchmarkChart(
        document.getElementById("rBench1"),
        { rows: intl.per_capita || [], unit: intl.chart1_unit || "",
          highlight: intl.highlight_country, decimals: 0 }), s));
    }
    if (document.getElementById("rBench2")) {
      mount("rBench2", shrink(CHARTS.benchmarkChart(
        document.getElementById("rBench2"),
        { rows: intl.subsidy_gdp || [], unit: intl.chart2_unit || "",
          highlight: intl.highlight_country, decimals: 1 }), s));
    }

    var mapOpt = CHARTS.iranMap(document.getElementById("rMap"), { metric: "over_pattern" });
    mapOpt.series[0].roam = false;
    mapOpt.series[0].zoom = 1.2;
    mapOpt.series[0].label.formatter = function (o) { return o.name; };
    mount("rMap", shrink(mapOpt, 0.8));

    var heatOpt = CHARTS.heatmapChart(document.getElementById("rHeat"), { mode: "cons" });
    heatOpt.grid.left = 84;
    heatOpt.grid.bottom = 44;
    heatOpt.yAxis.axisLabel.interval = 0;   // همهٔ ۳۱ استان برچسب بگیرند، نه یکی‌درمیان
    heatOpt.xAxis.axisLabel.interval = 0;
    mount("rHeat", shrink(heatOpt, 0.7));
  }

  /* -------------------------------------------------------------- متن‌ها */
  function buildNotes() {
    document.getElementById("rButterflyNote").innerHTML =
      "پلهٔ ۱ با <b>" + U.faPct(NAT.h1_count[0], 1) + "</b> از مشترکین، <b>" +
      U.faPct(NAT.h1_cons[0], 1) + "</b> از گاز را می‌برد. در مقابل، پلهٔ ۱۲ با تنها <b>" +
      U.faPct(NAT.h1_count[11], 1) + "</b> از مشترکین، <b>" + U.faPct(NAT.h1_cons[11], 1) +
      "</b> از گاز را مصرف می‌کند — سهمی هم‌اندازهٔ پلهٔ ۹ که ده برابر مشترک بیشتری دارد.";

    var ranked = D.provinces.slice().sort(function (a, b) {
      return b.h1_over_pattern - a.h1_over_pattern;
    });
    document.getElementById("rMapNote").innerHTML =
      "بیشترین سهم مازاد بر الگو در <b>" + ranked[0].province + "</b> (" +
      U.faPct(ranked[0].h1_over_pattern, 1) + ") و کمترین در <b>" +
      ranked[ranked.length - 1].province + "</b> (" +
      U.faPct(ranked[ranked.length - 1].h1_over_pattern, 1) + ") دیده می‌شود. " +
      "میانگین کشوری <b>" + U.faPct(NAT.h1_over_pattern, 1) + "</b> است.";

    var c = D.climate.over_pattern;
    document.getElementById("rClimateCap").textContent =
      "همبستگی r = " + U.faNum(c.r, 2) + " · ضریب تعیین R² = " + U.faNum(c.r2, 2) +
      " · اندازهٔ هر دایره برابر بزرگی انحراف از خط برازش است";

    var res = D.rankings.climate_residual;
    document.getElementById("rClimateNote").innerHTML =
      "همبستگی منفی معناداری میان دما و مصرف مازاد بر الگو وجود دارد، اما دما تنها <b>" +
      U.faPct(c.r2 * 100, 0) + "</b> از پراکندگی را توضیح می‌دهد. " +
      "سه استان <b>" + res[0].province + "</b>، <b>" + res[1].province + "</b> و <b>" +
      res[2].province + "</b> بیشترین انحراف مثبت را دارند — یعنی مصرفشان را نمی‌توان " +
      "با اقلیم توجیه کرد.";

    var gaps = D.provinces.map(function (x) {
      return { p: x.province, g: x.h1_intensity_g.very - x.h2_intensity_g.very };
    }).sort(function (a, b) { return b.g - a.g; });
    document.getElementById("rSeasonNote").innerHTML =
      "در دورهٔ سرد، پرمصرف‌ترین گروه کشور <b>" + U.faTimes(NAT.h2_intensity_g.very) +
      "</b> مشترک متوسط گاز می‌سوزاند؛ در دورهٔ گرم این فاصله به <b>" +
      U.faTimes(NAT.h1_intensity_g.very) + "</b> می‌رسد. بیشترین بازشدن این شکاف در <b>" +
      gaps[0].p + "</b> رخ می‌دهد و کمترینش در <b>" + gaps[gaps.length - 1].p + "</b>.";

    var cr = document.getElementById("rCredits");
    var parts = (window.NIGC_CREDITS || []).map(function (x) {
      return x.title + " — " + x.author + " (" + x.license + ")";
    });
    cr.innerHTML =
      "<b>تصاویر:</b> " + parts.join(" · ") + " — همگی از ویکی‌مدیا کامنز.<br>" +
      "<b>مرزهای نقشه:</b> OpenStreetMap contributors (ODbL)، ساده‌شده برای نمایش.<br>" +
      "<b>قلم:</b> استعداد، با مجوز SIL Open Font License.<br>" +
      "<b>میانگین دمای استان‌ها:</b> مقادیر تقریبی بلندمدت ایستگاه مرکز استان.";
  }

  function init() {
    echarts.registerMap("iran", window.IRAN_GEO);
    buildSummary();
    buildWaffles();
    buildTables();
    buildCharts();
    buildNotes();
    document.documentElement.setAttribute("data-report-ready", "1");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else init();
})();
