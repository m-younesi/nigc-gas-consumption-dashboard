/* ==========================================================================
   پوستر اینفوگرافیک — نسخهٔ ایستا و درشت‌تر همان نمودارهای وب‌اپ
   ========================================================================== */
(function () {
  "use strict";

  var D = window.NIGC, H = D.headline, NAT = D.national;
  var el = U.el;
  var GROUP_LABELS = CHARTS.GROUP_LABELS, GROUP_KEYS = CHARTS.GROUP_KEYS;

  /** نمودار را با گزینه‌های درشت‌شدهٔ پوستر می‌سازد. */
  function mount(id, option) {
    var dom = document.getElementById(id);
    if (!dom) return null;
    var inst = echarts.init(dom, null, { renderer: "canvas" });
    inst.setOption(option, true);
    return inst;
  }

  /* --------------------------------------------------------- آمار سرصفحه */
  function buildStats() {
    var host = document.getElementById("pStats");
    [
      { v: U.faNum(H.low_count, 1), s: "٪", k: "مشترکین گروه کم‌مصرف",
        d: "اکثریت مطلق مشترکین کشور در پله‌های ۱ تا ۳ می‌مانند.",
        c: "var(--c-subs)" },
      { v: U.faNum(H.over_pattern, 1), s: "٪", k: "گاز سوخته بالاتر از الگو",
        d: "و این سهم را تنها " + U.faPct(H.over_pattern_count, 1) + " از مشترکین می‌سوزانند.",
        c: "var(--c-gas)" },
      { v: U.faNum(H.top10, 1), s: "٪", k: "سهم ۱۰٪ پرمصرف‌ترین",
        d: "در برابر " + U.faPct(H.bottom50, 1) + " که سهم نیمهٔ کم‌مصرف است.",
        c: "var(--g3)" },
      { v: U.faNum(H.tier12_multiplier, 1), s: "×", k: "شدت مصرف مشترک پلهٔ ۱۲",
        d: "هر مشترک پلهٔ ۱۲ به اندازهٔ حدود ۱۱ مشترک پلهٔ ۱ گاز می‌سوزاند.",
        c: "var(--critical)" }
    ].forEach(function (t) {
      host.appendChild(el("div", { class: "p-stat", style: "--accent:" + t.c }, [
        el("div", { class: "v" }, [
          el("span", { text: t.v }), el("small", { text: t.s })
        ]),
        el("div", { class: "k", text: t.k }),
        el("div", { class: "d", text: t.d })
      ]));
    });
  }

  /* ------------------------------------------------------------- وافل */
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
    var host = document.getElementById("pWaffles");
    [
      { t: "۱۰۰ مشترک", vals: GROUP_KEYS.map(function (k) { return NAT.h1_count_g[k]; }) },
      { t: "۱۰۰ واحد گاز", vals: GROUP_KEYS.map(function (k) { return NAT.h1_cons_g[k]; }) }
    ].forEach(function (blk) {
      var grid = el("div", { class: "p-waffle" });
      hundred(blk.vals).forEach(function (gi) {
        grid.appendChild(el("i", { style: "--cell:" + p.groups[gi] }));
      });
      host.appendChild(el("div", {}, [
        el("div", { class: "p-waffle-t", text: blk.t }), grid
      ]));
    });

    var leg = document.getElementById("pWaffleLegend");
    GROUP_LABELS.forEach(function (label, i) {
      leg.appendChild(el("span", {
        html: '<i style="background:' + p.groups[i] + '"></i>' + label
      }));
    });

    document.getElementById("pWaffleNote").innerHTML =
      "<b>" + U.faPct(NAT.h1_count_g.low, 1) + "</b> از مشترکین در گروه کم‌مصرف‌اند، " +
      "اما تنها <b>" + U.faPct(NAT.h1_cons_g.low, 1) + "</b> از گاز را می‌سوزانند. " +
      "در نقطهٔ مقابل، گروه بسیار پرمصرف با <b>" + U.faPct(NAT.h1_count_g.very, 1) +
      "</b> از مشترکین، <b>" + U.faPct(NAT.h1_cons_g.very, 1) + "</b> از گاز را می‌برد.";
  }

  /* -------------------------------------------------------- فهرست رتبه */
  function buildList(hostId, rows, valueFn, fmt, tone, count) {
    var host = document.getElementById(hostId);
    var vals = rows.map(valueFn);
    var max = Math.max.apply(null, vals);
    rows.slice(0, count).forEach(function (r, i) {
      var v = valueFn(r);
      host.appendChild(el("div", { class: "p-item", style: "--tone:" + tone }, [
        el("span", { class: "n", text: U.fa(i + 1) }),
        el("span", { class: "nm", text: r.province, style: "width:150px" }),
        el("span", { class: "bar" }, [
          el("span", { style: "width:" + (v / max * 100) + "%" })
        ]),
        el("span", { class: "vl", text: fmt(v) })
      ]));
    });
  }

  function buildGiniList() {
    var host = document.getElementById("pGiniList");
    var g = D.rankings.gini;
    var top = g.slice(0, 5);
    var bottom = g.slice(-5).reverse();
    var max = Math.max.apply(null, g.map(function (x) { return x.value; }));

    function row(item, rank, tone) {
      return el("div", { class: "p-item", style: "--tone:" + tone }, [
        el("span", { class: "n", text: U.fa(rank) }),
        el("span", { class: "nm", text: item.province, style: "width:158px" }),
        el("span", { class: "bar" }, [
          el("span", { style: "width:" + (item.value / max * 100) + "%" })
        ]),
        el("span", { class: "vl", text: U.faNum(item.value, 3) })
      ]);
    }
    top.forEach(function (it, i) { host.appendChild(row(it, i + 1, "var(--critical)")); });
    host.appendChild(el("div", {
      style: "height:1px;background:var(--border);margin:10px 0"
    }));
    bottom.forEach(function (it, i) {
      host.appendChild(row(it, g.length - i, "var(--c-subs)"));
    });
  }

  /* ---------------------------------------------------------- نمودارها */
  /** اندازهٔ قلم نمودارهای پوستر را نسبت به وب‌اپ بزرگ‌تر می‌کند. */
  function bump(option, scale) {
    var s = scale || 1.2;
    JSON.stringify(option, function (k, v) {
      if (k === "fontSize" && typeof v === "number") return v;
      return v;
    });
    (function walk(node) {
      if (!node || typeof node !== "object") return;
      Object.keys(node).forEach(function (k) {
        var v = node[k];
        if (k === "fontSize" && typeof v === "number") node[k] = Math.round(v * s * 10) / 10;
        else if (v && typeof v === "object") walk(v);
      });
    })(option);
    return option;
  }

  function buildCharts() {
    var p = U.palette();

    mount("pButterfly", bump(CHARTS.tierButterfly(
      document.getElementById("pButterfly"), { province: "کل کشور" }), 1.25));

    mount("pIntensity", bump(CHARTS.intensityChart(
      document.getElementById("pIntensity"), { province: "کل کشور" }), 1.25));

    mount("pSankey", bump(CHARTS.sankeyChart(
      document.getElementById("pSankey"), { province: "کل کشور", half: "h1" }), 1.2));

    mount("pLorenz", bump(CHARTS.lorenzChart(
      document.getElementById("pLorenz"), { province: "کل کشور", half: "h1" }), 1.25));

    // نقشه بدون امکان چرخش و زوم، با برچسب استان‌ها
    var mapOpt = CHARTS.iranMap(document.getElementById("pMap"), { metric: "over_pattern" });
    mapOpt.series[0].roam = false;
    mapOpt.series[0].zoom = 1.24;
    mapOpt.series[0].label.formatter = function (o) { return o.name; };
    mapOpt.series[0].label.fontSize = 10.5;
    mount("pMap", mapOpt);

    var climOpt = CHARTS.climateScatter(document.getElementById("pClimate"), {});
    mount("pClimate", bump(climOpt, 1.2));

    var heatOpt = CHARTS.heatmapChart(document.getElementById("pHeat"), { mode: "cons" });
    heatOpt.grid.left = 108;
    heatOpt.yAxis.axisLabel.fontSize = 10;
    heatOpt.xAxis.axisLabel.formatter = function (v) { return v; };
    heatOpt.xAxis.axisLabel.fontSize = 11;
    mount("pHeat", heatOpt);

    var c = D.climate.over_pattern;
    document.getElementById("pClimateHint").textContent =
      "همبستگی r = " + U.faNum(c.r, 2) + " · ضریب تعیین R² = " + U.faNum(c.r2, 2) +
      " · اندازهٔ هر دایره برابر بزرگی انحراف از خط برازش است";

    var res = D.rankings.climate_residual;
    document.getElementById("pClimateNote").innerHTML =
      "دما تنها <b>" + U.faPct(c.r2 * 100, 0) + "</b> از پراکندگی میان استان‌ها را توضیح " +
      "می‌دهد. <b>" + res[0].province + "</b> با <b>+" + U.faNum(res[0].value, 1) +
      " واحد</b> بالاتر از انتظار اقلیمی‌اش می‌سوزاند و <b>" +
      res[res.length - 1].province + "</b> با <b>" +
      U.faNum(res[res.length - 1].value, 1) + " واحد</b> پایین‌تر.";
  }

  function init() {
    echarts.registerMap("iran", window.IRAN_GEO);
    buildStats();
    buildWaffles();
    buildGiniList();
    buildList("pTopList", D.rankings.over_pattern, function (r) {
      return r.value !== undefined ? r.value : r.h1_over_pattern;
    }, function (v) { return U.faPct(v, 1); }, "var(--c-gas)", 12);
    buildCharts();
    document.documentElement.setAttribute("data-poster-ready", "1");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else init();
})();
