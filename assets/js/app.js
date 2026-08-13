/* ==========================================================================
   راه‌اندازی وب‌اپ: ثبت نمودارها، کنترل‌ها، تم، جدول و متن‌های تحلیلی پویا
   ========================================================================== */
(function () {
  "use strict";

  var D = window.NIGC, H = D.headline, NAT = D.national;
  var $ = U.$, $$ = U.$$, el = U.el;
  var GROUP_LABELS = CHARTS.GROUP_LABELS, GROUP_KEYS = CHARTS.GROUP_KEYS;

  /* وضعیت مشترک میان بخش‌ها */
  var state = {
    glanceHalf: "h1",
    flowHalf: "h1",
    lorenzHalf: "h1",
    ladderProv: "کل کشور",
    flowProv: "کل کشور",
    lorenzProv: "مازندران",
    explorer: "مازندران",
    mapMetric: "over_pattern",
    heatMode: "cons",
    compare: ["مازندران", "هرمزگان", "کردستان", "تهران"]
  };

  /* ============================================================ رجیستری نمودار */
  var registry = [];

  /** نمودار را می‌سازد، در رجیستری نگه می‌دارد و با تغییر تم دوباره می‌کشد. */
  /* بخش‌های تحلیلی (تفسیر، مقایسهٔ جهانی، راهکار) فهرست‌های با طول متغیر
     دارند، پس در HTML ثابت نمی‌شوند و از content.json ساخته می‌شوند. */
  function renderAnalysis() {
    var A = (window.NIGC_CONTENT && window.NIGC_CONTENT.analysis) || {};

    function fillNotes(hostId, points) {
      var host = document.getElementById(hostId);
      if (!host) return;
      host.innerHTML = "";
      (points || []).forEach(function (pt) {
        if (!pt || (!pt.title && !pt.body)) return;
        var card = document.createElement("div");
        card.className = "note reveal";
        var h = document.createElement("div");
        h.className = "note__h";
        h.textContent = pt.title || "";
        var b = document.createElement("div");
        b.className = "note__b";
        b.innerHTML = pt.body || "";
        card.appendChild(h);
        card.appendChild(b);
        host.appendChild(card);
      });
    }

    fillNotes("interpretationPoints", (A.interpretation || {}).points);
    fillNotes("internationalPoints", (A.international || {}).points);

    var host = document.getElementById("solutionItems");
    if (host) {
      host.innerHTML = "";
      ((A.solutions || {}).items || []).forEach(function (it, i) {
        if (!it || (!it.title && !it.body)) return;
        var row = document.createElement("div");
        row.className = "solution reveal";

        var no = document.createElement("div");
        no.className = "solution__no";
        no.textContent = U.faNum(i + 1, 0);

        var h = document.createElement("div");
        h.className = "solution__h";
        h.textContent = it.title || "";

        var b = document.createElement("div");
        b.className = "solution__b";
        b.innerHTML = it.body || "";

        row.appendChild(no);
        row.appendChild(h);
        row.appendChild(b);

        var tags = [it.effort, it.impact ? "اثر: " + it.impact : ""]
          .filter(function (t) { return t; });
        if (tags.length) {
          var wrap = document.createElement("div");
          wrap.className = "solution__tags";
          tags.forEach(function (t) {
            var s = document.createElement("span");
            s.className = "solution__tag";
            s.textContent = t;
            wrap.appendChild(s);
          });
          row.appendChild(wrap);
        }
        host.appendChild(row);
      });
    }

    // بخش‌هایی که در پنل خاموش شده‌اند پنهان می‌شوند
    ["interpretation", "international", "solutions"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && A[id] && A[id].visible === false) el.style.display = "none";
    });
  }

  function mount(id, builder, optsFn) {
    var dom = document.getElementById(id);
    if (!dom) return null;
    var inst = echarts.init(dom, null, { renderer: "canvas" });
    var entry = { id: id, dom: dom, inst: inst, builder: builder, optsFn: optsFn };
    entry.draw = function () {
      inst.setOption(builder(dom, optsFn ? optsFn() : {}), true);
    };
    entry.draw();
    registry.push(entry);
    return entry;
  }

  function redrawAll() { registry.forEach(function (e) { e.draw(); }); }
  function resizeAll() { registry.forEach(function (e) { e.inst.resize(); e.draw(); }); }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeAll, 180);
  });

  /* ==================================================================== تم */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("nigc-theme", theme); } catch (e) { /* حالت خصوصی */ }
    document.querySelector('meta[name="theme-color"]')
      .setAttribute("content", U.token("--plane"));
    $("#themeIcon").setAttribute("d", theme === "dark"
      ? "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
      : "M12 3v2m0 14v2m9-9h-2M5 12H3m14.7-6.7-1.4 1.4M7.7 16.3l-1.4 1.4m12 0-1.4-1.4M7.7 7.7 6.3 6.3M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z");
    redrawAll();
    paintWaffles();
    paintLegends();
  }

  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("nigc-theme"); } catch (e) { /* noop */ }
    var theme = saved || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
    $("#themeBtn").addEventListener("click", function () {
      applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  })();

  /* ======================================================= کنترل‌های عمومی */
  /** فهرست استان‌ها را در یک select می‌ریزد. */
  function fillProvinces(sel, selected, includeNational) {
    var names = (includeNational === false ? [] : ["کل کشور"])
      .concat(D.provinces.map(function (r) { return r.province; }));
    names.forEach(function (n) {
      sel.appendChild(el("option", { value: n, text: n, selected: n === selected ? "selected" : null }));
    });
  }

  /** گروه دکمه‌های تقسیم‌شده را به یک کلید از state وصل می‌کند. */
  function bindSegmented(id, attr, key, onChange) {
    var group = document.getElementById(id);
    if (!group) return;
    group.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button[data-" + attr + "]");
      if (!btn) return;
      $$("button", group).forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      state[key] = btn.getAttribute("data-" + attr);
      onChange();
    });
  }

  /* ============================================================ سرصفحهٔ آمار */
  function buildHero() {
    var items = [
      { v: H.low_count, d: 1, s: "٪", k: "مشترکین گروه کم‌مصرف (الگو)" },
      { v: H.low_cons, d: 1, s: "٪", k: "سهم همین گروه از گاز مصرفی" },
      { v: H.over_pattern, d: 1, s: "٪", k: "گازی که بالاتر از الگو سوخته" },
      { v: H.tier12_multiplier, d: 1, s: "×", k: "شدت مصرف مشترک پلهٔ ۱۲" }
    ];
    var host = $("#heroStats");
    items.forEach(function (it) {
      var v = el("div", { class: "v" });
      var num = el("span", { text: "۰" });
      v.appendChild(num);
      v.appendChild(el("small", { text: it.s }));
      var box = el("div", { class: "hero__stat" }, [v, el("div", { class: "k", text: it.k })]);
      host.appendChild(box);
      whenVisible(box, function () { U.countUp(num, it.v, it.d, ""); });
    });
  }

  /* =========================================================== کاشی‌های آمار */
  function buildStatTiles() {
    var tiles = [
      {
        v: U.faPct(H.top10, 1), k: "سهم ۱۰٪ پرمصرف‌ترین مشترکین",
        d: "پرمصرف‌ترین یک‌دهم مشترکین کشور، نزدیک یک‌چهارم کل گاز خانگی را می‌سوزانند.",
        c: "var(--c-gas)"
      },
      {
        v: U.faPct(H.bottom50, 1), k: "سهم ۵۰٪ کم‌مصرف‌ترین",
        d: "نیمهٔ پایین مشترکین روی هم کمتر از یک‌چهارم گاز را مصرف می‌کند.",
        c: "var(--c-subs)"
      },
      {
        v: U.faNum(H.gini, 3), k: "ضریب جینی مصرف در دورهٔ سرد",
        d: "کران پایین نابرابری واقعی؛ نابرابری درون هر پله در داده دیده نمی‌شود.",
        c: "var(--g4)"
      },
      {
        v: U.faTimes(H.very_multiplier), k: "شدت مصرف گروه بسیار پرمصرف",
        d: U.faPct(H.very_count, 1) + " از مشترکین که " + U.faPct(H.very_cons, 1) +
           " از گاز را می‌برند.",
        c: "var(--critical)"
      },
      {
        v: U.faPct(H.over_pattern_count, 1), k: "مشترکینی که از الگو فراتر رفته‌اند",
        d: "همین اقلیت " + U.faPct(H.over_pattern, 1) + " از کل گاز خانگی را مصرف می‌کند.",
        c: "var(--g3)"
      },
      {
        v: U.faNum(H.spread_gini, 3), k: "دامنهٔ اختلاف جینی میان استان‌ها",
        d: "فاصلهٔ نابرابرترین و برابرترین استان کشور — نشانهٔ اینکه یک سیاست واحد برای همه جواب نمی‌دهد.",
        c: "var(--c-subs)"
      }
    ];
    var host = $("#statTiles");
    tiles.forEach(function (t) {
      host.appendChild(el("div", { class: "stat", style: "--accent:" + t.c }, [
        el("div", { class: "stat__v", text: t.v }),
        el("div", { class: "stat__k", text: t.k }),
        el("div", { class: "stat__d", text: t.d })
      ]));
    });
  }

  /* =================================================================== وافل */
  /** آرایهٔ ۱۰۰ خانه‌ای می‌سازد که سهم هر گروه را با گردکردن بزرگ‌ترین باقیمانده حفظ کند. */
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

  function paintWaffles() {
    var host = $("#waffles");
    host.innerHTML = "";
    var p = U.palette();
    var half = state.glanceHalf;
    [
      { title: "۱۰۰ مشترک", vals: GROUP_KEYS.map(function (k) { return NAT[half + "_count_g"][k]; }) },
      { title: "۱۰۰ واحد گاز", vals: GROUP_KEYS.map(function (k) { return NAT[half + "_cons_g"][k]; }) }
    ].forEach(function (blk) {
      var grid = el("div", { class: "waffle" });
      hundred(blk.vals).forEach(function (gi) {
        grid.appendChild(el("i", {
          style: "--cell:" + p.groups[gi],
          title: GROUP_LABELS[gi]
        }));
      });
      host.appendChild(el("div", { class: "waffle-block" }, [
        el("h4", { text: blk.title }), grid
      ]));
    });
  }

  /** راهنمای رنگ گروه‌ها را در چند جای صفحه می‌کشد. */
  function paintLegends() {
    var p = U.palette();
    ["#waffleLegend", "#groupLegend", "#compareLegend"].forEach(function (sel) {
      var node = $(sel);
      if (!node) return;
      node.innerHTML = "";
      GROUP_LABELS.forEach(function (label, i) {
        node.appendChild(el("span", {
          html: '<i style="background:' + p.groups[i] + '"></i>' + label
        }));
      });
    });
  }

  /* =============================================================== یادداشت‌ها */
  function updateNotes() {
    var half = state.glanceHalf;
    var r = NAT;
    var lowCount = r[half + "_count_g"].low, lowCons = r[half + "_cons_g"].low;
    $("#donutNote").innerHTML =
      "در " + (half === "h1" ? "دورهٔ سرد" : "دورهٔ گرم") + "، <b>" + U.faPct(lowCount, 1) +
      "</b> از مشترکین در گروه کم‌مصرف‌اند اما تنها <b>" + U.faPct(lowCons, 1) +
      "</b> از گاز را مصرف می‌کنند. اختلاف این دو عدد (<b>" +
      U.faNum(lowCount - lowCons, 1) + " واحد</b>) دقیقاً همان باری است که روی دوش گروه‌های بالاتر افتاده.";

    $("#waffleNote").innerHTML =
      "دو مربع کنار هم را مقایسه کنید: تعداد خانه‌های تیره‌تر در سمت گاز به‌مراتب بیشتر از سمت مشترکین است.";

    var lp = CHARTS.rec(state.ladderProv);
    var t12 = lp.h1_intensity[11], t1 = lp.h1_intensity[0];
    $("#butterflyNote").innerHTML =
      "<b>" + lp.province + "</b>: پلهٔ ۱ با <b>" + U.faPct(lp.h1_count[0], 1) +
      "</b> از مشترکین، <b>" + U.faPct(lp.h1_cons[0], 1) + "</b> از گاز را می‌برد؛ " +
      "در مقابل پلهٔ ۱۲ با تنها <b>" + U.faPct(lp.h1_count[11], 1) + "</b> از مشترکین، <b>" +
      U.faPct(lp.h1_cons[11], 1) + "</b> از گاز را مصرف می‌کند.";

    $("#intensityNote").innerHTML =
      "شدت مصرف از <b>" + U.faTimes(t1) + "</b> در پلهٔ ۱ تا <b>" + U.faTimes(t12) +
      "</b> در پلهٔ ۱۲ بالا می‌رود — یعنی یک مشترک پلهٔ ۱۲ به اندازهٔ حدود <b>" +
      U.fa(Math.round(t12 / t1)) + "</b> مشترک پلهٔ ۱ گاز می‌سوزاند.";

    var fr = CHARTS.rec(state.flowProv), fh = state.flowHalf;
    $("#sankeySub").textContent = fr.province + " — " +
      (fh === "h1" ? "دورهٔ سرد، تعرفهٔ ۱۲ پله‌ای" : "دورهٔ گرم، تعرفهٔ ۴ پله‌ای");
    $("#sankeyNote").innerHTML =
      "نوار گروه <b>بسیار پرمصرف</b> در ورودی باریک است (<b>" +
      U.faPct(fr[fh + "_count_g"].very, 1) + "</b> مشترکین) اما در خروجی پهن می‌شود (<b>" +
      U.faPct(fr[fh + "_cons_g"].very, 1) + "</b> گاز). همین پهن‌شدن، تعریف تصویری نابرابری است.";

    var lr = CHARTS.rec(state.lorenzProv), lh = state.lorenzHalf;
    $("#lorenzNote").innerHTML =
      "<b>" + lr.province + "</b> — جینی <b>" + U.faNum(lr[lh + "_gini"], 3) +
      "</b> در برابر <b>" + U.faNum(NAT[lh + "_gini"], 3) + "</b> برای کل کشور. " +
      (lr[lh + "_gini"] > NAT[lh + "_gini"]
        ? "مصرف در این استان از میانگین کشور نابرابرتر توزیع شده است."
        : "توزیع مصرف در این استان از میانگین کشور یکدست‌تر است.");

    var c = D.climate.over_pattern;
    $("#climateSub").textContent =
      "همبستگی r = " + U.faNum(c.r, 2) + " · ضریب تعیین R² = " + U.faNum(c.r2, 2) +
      " · اندازهٔ هر دایره برابر بزرگی انحراف از خط برازش است";

    var res = D.rankings.climate_residual;
    var top = res[0], bottom = res[res.length - 1];
    $("#climateNote").innerHTML =
      "دما تنها <b>" + U.faPct(c.r2 * 100, 0) + "</b> از پراکندگی را توضیح می‌دهد. " +
      "<b>" + top.province + "</b> با <b>+" + U.faNum(top.value, 1) +
      " واحد</b> بیش از انتظار اقلیمی‌اش مصرف می‌کند و <b>" + bottom.province +
      "</b> با <b>" + U.faNum(bottom.value, 1) + " واحد</b> کمتر. " +
      "استان‌های خزری با وجود زمستان معتدل، بالای خط می‌نشینند — نشانهٔ نقش رطوبت و کیفیت عایق‌بندی.";

    $("#heatSub").textContent = state.heatMode === "cons"
      ? "شدت رنگ = سهم آن پله از کل مصرف استان"
      : "شدت رنگ = سهم آن پله از کل مشترکین استان";

    var gaps = D.provinces.map(function (x) {
      return { p: x.province, g: x.h1_intensity_g.very - x.h2_intensity_g.very };
    }).sort(function (a, b) { return b.g - a.g; });
    $("#seasonNote").innerHTML =
      "در دورهٔ گرم، پرمصرف‌ترین گروه کشور تنها <b>" +
      U.faTimes(NAT.h2_intensity_g.very) + "</b> مشترک متوسط گاز می‌سوزاند؛ در دورهٔ سرد " +
      "این فاصله به <b>" + U.faTimes(NAT.h1_intensity_g.very) + "</b> می‌رسد. " +
      "بیشترین بازشدن این شکاف در <b>" + gaps[0].p + "</b> رخ می‌دهد و کمترینش در <b>" +
      gaps[gaps.length - 1].p + "</b>. " +
      "سرما فقط مصرف را بالا نمی‌برد؛ فاصلهٔ میان مشترکین را هم باز می‌کند.";

    var m = CHARTS.MAP_METRICS[state.mapMetric];
    $("#mapTitle").textContent = m.label + " — به تفکیک استان";
    $("#mapHint").textContent = m.hint;
    var ranked = D.provinces.slice().sort(function (a, b) { return b[m.key] - a[m.key]; });
    $("#mapNote").innerHTML =
      "بیشترین: <b>" + ranked[0].province + "</b> (" + U.faNum(ranked[0][m.key], m.dec) + m.unit +
      ") · کمترین: <b>" + ranked[ranked.length - 1].province + "</b> (" +
      U.faNum(ranked[ranked.length - 1][m.key], m.dec) + m.unit + ")" +
      (m.diverging ? "" : " · کل کشور: <b>" + U.faNum(NAT[m.key], m.dec) + m.unit + "</b>");
  }

  /* ================================================== کاشی‌های جینی (بخش ۴) */
  function buildGiniTiles() {
    var host = $("#giniTiles");
    var g = D.rankings.gini;
    var items = [
      { v: U.faNum(H.gini, 3), k: "جینی کشوری — دورهٔ سرد",
        d: "دورهٔ گرم ۰٫۱۹۰ است، ولی چون آن دوره فقط ۴ پله دارد، دو عدد مستقیماً " +
           "با هم مقایسه‌شدنی نیستند.", c: "var(--c-gas)" },
      { v: g[0].province, k: "نابرابرترین استان",
        d: "جینی " + U.faNum(g[0].value, 3), c: "var(--critical)" },
      { v: g[g.length - 1].province, k: "یکدست‌ترین استان",
        d: "جینی " + U.faNum(g[g.length - 1].value, 3), c: "var(--c-subs)" },
      { v: U.faPct(H.top1, 1), k: "سهم ۱٪ پرمصرف‌ترین از گاز",
        d: "در برابر ۱٪ سهمشان از تعداد مشترکین", c: "var(--g4)" }
    ];
    items.forEach(function (t) {
      var v = el("div", { class: "stat__v", text: t.v });
      if (t.v.length > 8) v.style.fontSize = "1.4rem";
      host.appendChild(el("div", { class: "stat", style: "--accent:" + t.c }, [
        v, el("div", { class: "stat__k", text: t.k }), el("div", { class: "stat__d", text: t.d })
      ]));
    });
  }

  /* ============================================================ کاوشگر استان */
  function updateExplorer() {
    var r = CHARTS.rec(state.explorer);
    $("#expName").textContent = r.province;

    function rankOf(list, name) {
      for (var i = 0; i < list.length; i++) if (list[i].province === name) return i + 1;
      return null;
    }
    var n = D.provinces.length;
    var badges = $("#expBadges");
    badges.innerHTML = "";
    [
      { t: "نابرابری", rank: rankOf(D.rankings.gini, r.province), hot: true },
      { t: "مازاد بر الگو", rank: rankOf(D.rankings.over_pattern, r.province), hot: true },
      { t: "سهم پرمصرف‌ها", rank: rankOf(D.rankings.tail_cons, r.province), hot: true }
    ].forEach(function (b) {
      if (!b.rank) return;
      var cls = b.rank <= 6 ? "badge badge--hot" : (b.rank > n - 6 ? "badge badge--cool" : "badge");
      badges.appendChild(el("span", {
        class: cls, html: b.t + " · رتبهٔ <b>" + U.fa(b.rank) + "</b> از " + U.fa(n)
      }));
    });

    var tiles = $("#expTiles");
    tiles.innerHTML = "";
    [
      { v: U.faPct(r.h1_over_pattern, 1), k: "مصرف مازاد بر الگو" },
      { v: U.faNum(r.h1_gini, 3), k: "ضریب جینی" },
      { v: U.faPct(r.h1_top10, 1), k: "سهم ۱۰٪ پرمصرف" },
      { v: U.faNum(Math.floor(r.h1_median_tier), 0), k: "پلهٔ مشترک میانه" },
      { v: U.faTimes(r.h1_intensity_g.very), k: "شدت گروه بسیار پرمصرف" },
      { v: U.faNum(r.temp, 1) + "°", k: "میانگین دمای سالانه" }
    ].forEach(function (t) {
      tiles.appendChild(el("div", { class: "minitile" }, [
        el("div", { class: "v", text: t.v }), el("div", { class: "k", text: t.k })
      ]));
    });

    var sign = r.climate_residual >= 0 ? "بیشتر" : "کمتر";
    $("#expNote").innerHTML =
      "<b>" + r.province + "</b> با میانگین دمای " + U.faNum(r.temp, 1) + " درجه، " +
      "<b>" + U.faNum(Math.abs(r.climate_residual), 1) + " واحد</b> " + sign +
      " از آنچه اقلیمش پیش‌بینی می‌کند بالاتر از الگو گاز می‌سوزاند. " +
      "مشترک میانهٔ این استان در <b>پلهٔ " + U.fa(Math.floor(r.h1_median_tier)) + "</b> می‌ایستد" +
      " (کل کشور: پلهٔ " + U.fa(Math.floor(NAT.h1_median_tier)) + ").";
  }

  /* =================================================================== جدول */
  var DEFAULT_COLS = [
    { k: "province", t: "استان", d: null },
    { k: "h1_over_pattern", t: "مازاد بر الگو", d: 1 },
    { k: "h1_tail_cons", t: "سهم پرمصرف‌ها", d: 1 },
    { k: "h1_top10", t: "سهم ۱۰٪ بالا", d: 1 },
    { k: "h1_gini", t: "جینی (سرد)", d: 3 },
    { k: "h2_gini", t: "جینی (گرم)", d: 3 },
    { k: "h1_median_tier", t: "پلهٔ میانه", d: 2 },
    { k: "h1_count_g.low", t: "مشترکین الگو", d: 1 },
    { k: "h1_cons_g.low", t: "مصرف الگو", d: 1 },
    { k: "h1_cons_g.very", t: "مصرف بسیار پرمصرف", d: 1 },
    { k: "temp", t: "میانگین دما", d: 1 },
    { k: "climate_residual", t: "انحراف اقلیمی", d: 1 }
  ];
  var CONTENT = window.NIGC_CONTENT || {};
  var COLS = (CONTENT.table_columns || []).length
    ? CONTENT.table_columns.map(function (c) {
        return { k: c.key, t: c.label, d: c.decimals };
      })
    : DEFAULT_COLS;

  function pick(row, key) {
    return key.split(".").reduce(function (o, k) { return o == null ? null : o[k]; }, row);
  }

  var sortState = { key: "h1_over_pattern", dir: -1 };

  function buildTable() {
    var head = $("#tableHead");
    COLS.forEach(function (c) {
      var th = el("th", { text: c.t, scope: "col", tabindex: "0" });
      th.addEventListener("click", function () { sortBy(c.k); });
      th.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); sortBy(c.k); }
      });
      head.appendChild(th);
    });
    $("#tableSearch").addEventListener("input", renderTable);
    renderTable();
  }

  function sortBy(key) {
    if (sortState.key === key) sortState.dir *= -1;
    else { sortState.key = key; sortState.dir = -1; }
    renderTable();
  }

  function renderTable() {
    var q = ($("#tableSearch").value || "").trim();
    var rows = D.provinces.filter(function (r) {
      return !q || r.province.indexOf(q) >= 0;
    });
    rows.sort(function (a, b) {
      var x = pick(a, sortState.key), y = pick(b, sortState.key);
      if (typeof x === "string") return sortState.dir * x.localeCompare(y, "fa");
      return sortState.dir * (x - y);
    });
    if (!q) rows.push(NAT);

    $$("#tableHead th").forEach(function (th, i) {
      if (COLS[i].k === sortState.key) {
        th.setAttribute("aria-sort", sortState.dir === 1 ? "ascending" : "descending");
      } else th.removeAttribute("aria-sort");
    });

    var body = $("#tableBody");
    body.innerHTML = "";
    rows.forEach(function (r) {
      var tr = el("tr", r === NAT ? { class: "is-national" } : {});
      COLS.forEach(function (c) {
        var v = pick(r, c.k);
        tr.appendChild(el("td", {
          text: c.d === null ? v : (v == null ? "—" : U.faNum(v, c.d))
        }));
      });
      tr.addEventListener("click", function () {
        if (r === NAT) return;
        state.explorer = r.province;
        $("#expProv").value = r.province;
        refreshExplorer();
        document.getElementById("explorer").scrollIntoView({ behavior: "smooth" });
      });
      body.appendChild(tr);
    });
  }

  /* ================================================================ دانلودها */
  var ICONS = {
    pdf: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6",
    xls: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M9 13l6 6m0-6-6 6",
    ppt: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M9 12h4a2 2 0 1 0 0-4H9v9",
    img: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm2 12 5-5 4 4 2-2 4 4M9 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
    csv: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8M8 17h5"
  };

  /* نام فایل روی سرور باید ASCII باشد — گیت‌هاب‌پیجز مسیرهای غیرلاتین را
     ۴۰۴ می‌دهد. نام فارسی از طریق صفت download روی فایل ذخیره‌شده می‌نشیند. */
  var DEFAULT_DOWNLOADS = [
    { f: "downloads/gas-report-1404.pdf", as: "گزارش-تحلیلی-مصرف-گاز-خانگی-۱۴۰۴.pdf",
      t: "گزارش کامل PDF", size: "۱۳ صفحه · ۱٫۱ مگابایت",
      d: "روایت تحلیلی همراه با همهٔ نمودارها و جدول‌های پیوست، آمادهٔ چاپ.", i: "pdf",
      tone: "var(--critical)" },
    { f: "downloads/gas-presentation-1404.pptx", as: "ارائه-مصرف-گاز-خانگی-۱۴۰۴.pptx",
      t: "ارائهٔ پاورپوینت", size: "۱۲ اسلاید · ۱٫۲ مگابایت",
      d: "اسلایدهای جلسه با نمودارهای رندرشده و نکتهٔ کلیدی هر بخش.", i: "ppt",
      tone: "var(--serious)" },
    { f: "downloads/gas-data-analysis-1404.xlsx", as: "داده-و-تحلیل-مصرف-گاز-خانگی-۱۴۰۴.xlsx",
      t: "کارپوشهٔ اکسل", size: "۷ برگه · ۲۹ کیلوبایت",
      d: "جدول‌های خام و شاخص‌های محاسبه‌شده، با نمودار و قالب‌بندی شرطی.", i: "xls",
      tone: "var(--ok)" },
    { f: "downloads/gas-infographic-1404.png", as: "اینفوگرافیک-مصرف-گاز-خانگی-۱۴۰۴.png",
      t: "پوستر اینفوگرافیک", size: "۳۵۸۴ پیکسل · ۵٫۴ مگابایت",
      d: "نسخهٔ تصویری تک‌برگ، با کیفیت چاپ.", i: "img", tone: "var(--c-gas)" },
    { f: "poster.html", t: "اینفوگرافیک تعاملی", size: "در مرورگر",
      d: "همان پوستر، بدون دانلود.", i: "img", tone: "var(--g3)" },
    { f: "downloads/gas-raw-data-1404.csv", as: "داده-خام-مصرف-گاز-خانگی-۱۴۰۴.csv",
      t: "دادهٔ خام CSV", size: "۳۲ ردیف · ۴۲ ستون",
      d: "همهٔ پله‌ها و شاخص‌ها، برای تحلیل مجدد در هر ابزاری.", i: "csv",
      tone: "var(--c-subs)" }
  ];
  var DOWNLOADS = (CONTENT.downloads || []).length
    ? CONTENT.downloads.map(function (d) {
        return { f: d.file, as: d.download_name, t: d.title, size: d.size, d: d.description, i: d.icon, tone: d.tone };
      })
    : DEFAULT_DOWNLOADS;

  function buildDownloads() {
    var host = $("#dlGrid");
    DOWNLOADS.forEach(function (d) {
      var svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="' + ICONS[d.i] + '"/></svg>';
      host.appendChild(el("a", {
        class: "dl", href: d.f, download: d.as || null, style: "--tone:" + d.tone
      }, [
        el("div", { class: "dl__ico", html: svg }),
        el("div", {}, [
          el("div", { class: "dl__t", text: d.t }),
          el("div", { class: "dl__d", text: d.d }),
          el("div", { class: "dl__s", text: d.size })
        ])
      ]));
    });
  }

  /* ========================================================== اعتبار تصاویر */
  function buildCredits() {
    var host = $("#credits");
    (window.NIGC_CREDITS || []).forEach(function (c) {
      host.appendChild(el("div", { class: "credit", html:
        "<b>" + c.title + "</b>" + (c.author ? c.author + " — " : "") +
        c.license + ' · <a href="' + c.source + '" target="_blank" rel="noopener">ویکی‌مدیا کامنز</a>'
      }));
    });
    $("#footNote").textContent = "ساخته‌شده با داده‌های عمومی · " +
      U.fa(new Date().getFullYear());
  }

  /* ============================================================ ظهور و ناوبری */
  function whenVisible(node, fn) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { fn(); io.disconnect(); }
      });
    }, { threshold: 0.35 });
    io.observe(node);
  }

  function initReveal() {
    if (!("IntersectionObserver" in window)) {
      $$(".reveal").forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    $$(".reveal").forEach(function (n) { io.observe(n); });
  }

  function initNavSpy() {
    var links = $$("#nav a");
    var sections = links.map(function (a) {
      return document.querySelector(a.getAttribute("href"));
    }).filter(Boolean);

    function onScroll() {
      var y = window.scrollY + window.innerHeight * 0.3;
      var active = -1;
      sections.forEach(function (s, i) { if (s.offsetTop <= y) active = i; });
      links.forEach(function (a, i) { a.classList.toggle("is-active", i === active); });

      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      $("#progress").style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ================================================================== اتصال */
  function refreshExplorer() {
    updateExplorer();
    registry.forEach(function (e) {
      if (e.id === "cRadar" || e.id === "cProvTiers") e.draw();
    });
  }

  function byId(id) {
    for (var i = 0; i < registry.length; i++) if (registry[i].id === id) return registry[i];
    return null;
  }

  function init() {
    buildHero();
    buildStatTiles();
    buildGiniTiles();
    buildDownloads();
    buildCredits();
    buildTable();

    echarts.registerMap("iran", window.IRAN_GEO);

    /* --- select ها --- */
    fillProvinces($("#ladderProv"), state.ladderProv);
    fillProvinces($("#flowProv"), state.flowProv);
    fillProvinces($("#lorenzProv"), state.lorenzProv);
    fillProvinces($("#expProv"), state.explorer, false);
    fillProvinces($("#cmpProv"), null, false);
    $$("#cmpProv option").forEach(function (o) {
      o.selected = state.compare.indexOf(o.value) >= 0;
    });

    var metricSel = $("#mapMetric");
    Object.keys(CHARTS.MAP_METRICS).forEach(function (k) {
      metricSel.appendChild(el("option", {
        value: k, text: CHARTS.MAP_METRICS[k].label,
        selected: k === state.mapMetric ? "selected" : null
      }));
    });

    /* --- نمودارها --- */
    mount("cDonut", CHARTS.donutPair, function () { return { half: state.glanceHalf }; });
    mount("cButterfly", CHARTS.tierButterfly, function () { return { province: state.ladderProv }; });
    mount("cIntensity", CHARTS.intensityChart, function () { return { province: state.ladderProv }; });
    mount("cTreemap", CHARTS.treemapChart, function () { return { province: state.ladderProv }; });
    mount("cSankey", CHARTS.sankeyChart,
      function () { return { province: state.flowProv, half: state.flowHalf }; });
    mount("cLorenz", CHARTS.lorenzChart,
      function () { return { province: state.lorenzProv, half: state.lorenzHalf }; });
    var mapEntry = mount("cMap", CHARTS.iranMap, function () { return { metric: state.mapMetric }; });
    mount("cRanking", CHARTS.rankingChart, function () { return { metric: state.mapMetric }; });
    mount("cHeat", CHARTS.heatmapChart, function () { return { mode: state.heatMode }; });
    mount("cClimate", CHARTS.climateScatter, function () { return {}; });
    mount("cSeason", CHARTS.seasonDumbbell, function () { return {}; });
    mount("cRadar", CHARTS.provinceRadar, function () { return { province: state.explorer }; });
    mount("cProvTiers", CHARTS.provinceTiers, function () { return { province: state.explorer }; });
    mount("cCompare", CHARTS.compareChart, function () { return { provinces: state.compare }; });

    /* --- بخش‌های تحلیلی: محتوایشان از content.json می‌آید --- */
    renderAnalysis();
    var intl = (window.NIGC_CONTENT && window.NIGC_CONTENT.analysis
                && window.NIGC_CONTENT.analysis.international) || {};
    mount("cBench1", CHARTS.benchmarkChart, function () {
      return { rows: intl.per_capita || [], unit: intl.chart1_unit || "",
               highlight: intl.highlight_country, decimals: 0 };
    });
    mount("cBench2", CHARTS.benchmarkChart, function () {
      return { rows: intl.subsidy_gdp || [], unit: intl.chart2_unit || "",
               highlight: intl.highlight_country, decimals: 1 };
    });

    /* کلیک روی نقشه، کاوشگر را روی همان استان می‌برد */
    if (mapEntry) {
      mapEntry.inst.on("click", function (ev) {
        if (!ev.name) return;
        state.explorer = ev.name;
        $("#expProv").value = ev.name;
        refreshExplorer();
        document.getElementById("explorer").scrollIntoView({ behavior: "smooth" });
      });
    }

    /* --- کنترل‌ها --- */
    bindSegmented("glanceHalf", "half", "glanceHalf", function () {
      byId("cDonut").draw(); paintWaffles(); updateNotes();
    });
    bindSegmented("flowHalf", "half", "flowHalf", function () {
      byId("cSankey").draw(); updateNotes();
    });
    bindSegmented("lorenzHalf", "half", "lorenzHalf", function () {
      byId("cLorenz").draw(); updateNotes();
    });
    bindSegmented("heatMode", "mode", "heatMode", function () {
      byId("cHeat").draw(); updateNotes();
    });

    $("#ladderProv").addEventListener("change", function () {
      state.ladderProv = this.value;
      byId("cButterfly").draw(); byId("cIntensity").draw(); byId("cTreemap").draw();
      updateNotes();
    });
    $("#flowProv").addEventListener("change", function () {
      state.flowProv = this.value; byId("cSankey").draw(); updateNotes();
    });
    $("#lorenzProv").addEventListener("change", function () {
      state.lorenzProv = this.value; byId("cLorenz").draw(); updateNotes();
    });
    $("#expProv").addEventListener("change", function () {
      state.explorer = this.value; refreshExplorer();
    });
    $("#cmpProv").addEventListener("change", function () {
      state.compare = $$("option:checked", this).map(function (o) { return o.value; }).slice(0, 6);
      byId("cCompare").draw();
    });
    metricSel.addEventListener("change", function () {
      state.mapMetric = this.value;
      byId("cMap").draw(); byId("cRanking").draw(); updateNotes();
    });

    paintWaffles();
    paintLegends();
    updateNotes();
    updateExplorer();
    initReveal();
    initNavSpy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else init();
})();
