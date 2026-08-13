/* ==========================================================================
   سازندهٔ نمودارها - همه بر پایهٔ ECharts، با پالت اعتبارسنجی‌شدهٔ پروژه
   قرارداد رنگ در کل پروژه:
     آبی      = تعداد مشترکین
     نارنجی   = مصرف گاز
     رمپ کهربایی چهارپله‌ای = گروه‌های مصرف (کم‌مصرف → بسیار پرمصرف)
     رمپ آبی پیوسته         = بزرگی (نقشه، هیت‌مپ)
     آبی↔قرمز              = قطبیت (باقیماندهٔ اقلیمی)
   ========================================================================== */
(function (global) {
  "use strict";

  var D = global.NIGC;
  var GROUP_KEYS = ["low", "medium", "high", "very"];
  var GROUP_LABELS = ["کم‌مصرف (الگو)", "مصرف متوسط", "پرمصرف", "بسیار پرمصرف"];
  var TIER_LABELS = ["۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹", "۱۰", "۱۱", "۱۲"];

  /** استان را با نام پیدا می‌کند؛ «کل کشور» رکورد ملی است. */
  function rec(name) {
    if (!name || name === "کل کشور") return D.national;
    for (var i = 0; i < D.provinces.length; i++) {
      if (D.provinces[i].province === name) return D.provinces[i];
    }
    return D.national;
  }

  /* ======================================================================
     ۱. دو دونات: سهم مشترکین و سهم مصرف به تفکیک گروه
     ====================================================================== */
  function donutPair(dom, opts) {
    var p = U.palette();
    var r = rec(opts.province);
    var half = opts.half || "h1";
    var counts = GROUP_KEYS.map(function (k) { return r[half + "_count_g"][k]; });
    var cons = GROUP_KEYS.map(function (k) { return r[half + "_cons_g"][k]; });

    function ring(values, center, title, total) {
      return {
        type: "pie",
        radius: ["26%", "40%"],
        center: center,
        avoidLabelOverlap: true,
        startAngle: 90,
        itemStyle: { borderColor: p.surface, borderWidth: 2, borderRadius: 4 },
        label: {
          show: true, color: p.ink2, fontSize: 11.5, fontFamily: "Estedad, sans-serif",
          formatter: function (o) { return o.name + "\n" + U.faPct(o.value, 1); },
          lineHeight: 16
        },
        labelLine: { length: 10, length2: 12, lineStyle: { color: p.axis } },
        emphasis: { scale: true, scaleSize: 6,
          itemStyle: { shadowBlur: 14, shadowColor: "rgba(0,0,0,.35)" } },
        data: values.map(function (v, i) {
          return { value: v, name: GROUP_LABELS[i], itemStyle: { color: p.groups[i] } };
        }),
        title: title, tot: total
      };
    }

    var isNarrow = dom.clientWidth < 620;
    var c1 = isNarrow ? ["50%", "26%"] : ["74%", "50%"];
    var c2 = isNarrow ? ["50%", "77%"] : ["26%", "50%"];

    return Object.assign(U.baseOption(), {
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "item",
        formatter: function (o) {
          return "<b>" + o.name + "</b><br>" + o.seriesName + ": " +
                 U.faPct(o.value, 1);
        }
      }),
      graphic: [
        centreText(c1, "مشترکین", p),
        centreText(c2, "مصرف گاز", p)
      ],
      series: [
        Object.assign(ring(counts, c1), { name: "سهم تعداد مشترکین" }),
        Object.assign(ring(cons, c2), { name: "سهم مصرف گاز" })
      ]
    });
  }

  function centreText(center, label, p) {
    return {
      type: "text", left: center[0], top: center[1], style: {
        text: label, textAlign: "center", textVerticalAlign: "middle",
        fill: p.ink, font: "700 14px Estedad, sans-serif"
      }
    };
  }

  /* ======================================================================
     ۲. پروانه: سهم مشترکین در برابر سهم مصرف، پله به پله (دورهٔ سرد)
     ====================================================================== */
  function tierButterfly(dom, opts) {
    var p = U.palette();
    var r = rec(opts.province);
    var counts = r.h1_count, cons = r.h1_cons;
    var max = Math.max.apply(null, counts.concat(cons)) * 1.12;

    return Object.assign(U.baseOption(), {
      grid: { top: 44, bottom: 30, left: 18, right: 18, containLabel: true },
      legend: {
        top: 4, right: "center", itemWidth: 12, itemHeight: 12, itemGap: 18,
        textStyle: { color: p.ink2, fontSize: 12, fontFamily: "Estedad, sans-serif" },
        data: ["تعداد مشترکین", "مصرف گاز"]
      },
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: function (ps) {
          var tier = ps[0].axisValue;
          var out = "<b>پلهٔ " + tier + "</b>";
          ps.forEach(function (s) {
            out += "<br>" + s.marker + s.seriesName + ": " + U.faPct(Math.abs(s.value), 1);
          });
          var i = TIER_LABELS.indexOf(tier);
          if (i >= 0 && r.h1_intensity[i] != null) {
            out += "<br><span style='opacity:.7'>شدت مصرف: " +
                   U.faTimes(r.h1_intensity[i]) + " میانگین کشوری</span>";
          }
          return out;
        }
      }),
      xAxis: U.axis({
        type: "value", min: -max, max: max,
        axisLabel: { color: p.muted, fontSize: 11,
          formatter: function (v) { return U.faNum(Math.abs(v), 0) + "٪"; } },
        splitLine: { lineStyle: { color: p.grid, type: [4, 4] } }
      }),
      yAxis: U.axis({
        type: "category", data: TIER_LABELS, inverse: true,
        axisLabel: {
          color: p.ink2, fontSize: 12, fontWeight: 600,
          formatter: function (v) { return "پلهٔ " + v; }
        },
        splitLine: { show: false }
      }),
      series: [
        {
          name: "تعداد مشترکین", type: "bar", stack: "x", barWidth: "62%",
          itemStyle: { color: p.subs, borderRadius: [4, 0, 0, 4] },
          data: counts.map(function (v) { return -v; }),
          label: {
            show: true, position: "left", distance: 6, color: p.muted, fontSize: 10.5,
            fontFamily: "Estedad, sans-serif",
            formatter: function (o) { return Math.abs(o.value) >= 3 ? U.faNum(Math.abs(o.value), 1) : ""; }
          }
        },
        {
          name: "مصرف گاز", type: "bar", stack: "x", barWidth: "62%",
          itemStyle: { color: p.gas, borderRadius: [0, 4, 4, 0] },
          data: cons,
          label: {
            show: true, position: "right", distance: 6, color: p.muted, fontSize: 10.5,
            fontFamily: "Estedad, sans-serif",
            formatter: function (o) { return o.value >= 3 ? U.faNum(o.value, 1) : ""; }
          }
        }
      ]
    });
  }

  /* ======================================================================
     ۳. ضریب شدت مصرف در هر پله (میله + خط مرجع ۱×)
     ====================================================================== */
  function intensityChart(dom, opts) {
    var p = U.palette();
    var r = rec(opts.province);
    var vals = r.h1_intensity;
    var groupOf = [0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3];

    return Object.assign(U.baseOption(), {
      grid: { top: 30, bottom: 34, left: 10, right: 16, containLabel: true },
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: function (ps) {
          var s = ps[0];
          if (s.value == null) return "پلهٔ " + s.axisValue + "<br>داده‌ای در دسترس نیست";
          return "<b>پلهٔ " + s.axisValue + "</b><br>هر مشترک این پله <b>" +
                 U.faTimes(s.value) + "</b> مشترک متوسط کشور گاز می‌سوزاند";
        }
      }),
      // مثل جدول‌های مبدأ، پلهٔ ۱ سمت راست می‌نشیند
      xAxis: U.axis({ type: "category", data: TIER_LABELS, inverse: true,
        name: "پلهٔ تعرفه", nameLocation: "middle", nameGap: 28,
        axisLabel: { color: p.ink2, fontSize: 12, fontWeight: 600 } }),
      yAxis: U.axis({ type: "value", name: "برابرِ مشترک متوسط",
        nameLocation: "middle", nameGap: 40, nameRotate: 90,
        axisLabel: { color: p.muted, fontSize: 11,
          formatter: function (v) { return U.faNum(v, 0) + "×"; } } }),
      series: [{
        type: "bar", barWidth: "56%",
        data: vals.map(function (v, i) {
          return { value: v, itemStyle: { color: p.groups[groupOf[i]], borderRadius: [4, 4, 0, 0] } };
        }),
        label: {
          show: true, position: "top", color: p.ink2, fontSize: 10.5,
          fontFamily: "Estedad, sans-serif",
          formatter: function (o) { return o.value == null ? "" : U.faNum(o.value, 1); }
        },
        markLine: {
          silent: true, symbol: "none",
          lineStyle: { color: p.muted, type: "dashed", width: 1.5 },
          label: { formatter: "میانگین کشوری", color: p.muted, fontSize: 11,
            fontFamily: "Estedad, sans-serif", position: "insideEndTop" },
          data: [{ yAxis: 1 }]
        }
      }]
    });
  }

  /* ======================================================================
     ۴. منحنی لورنز - نابرابری توزیع مصرف بین مشترکین
     ====================================================================== */
  function lorenzChart(dom, opts) {
    var p = U.palette();
    var main = rec(opts.province);
    var nat = D.national;
    var half = opts.half || "h1";

    function pts(r) {
      return r[half + "_lorenz"].map(function (q) { return [q[0], q[1]]; });
    }

    var series = [
      {
        name: "برابری کامل", type: "line", data: [[0, 0], [100, 100]],
        symbol: "none", lineStyle: { color: p.muted, type: "dashed", width: 1.5 },
        itemStyle: { color: p.muted }, silent: true, z: 1
      },
      {
        name: "کل کشور", type: "line", data: pts(nat), smooth: 0.15,
        symbol: "none", lineStyle: { color: p.ink2, width: 2, type: "dotted" },
        itemStyle: { color: p.ink2 }, z: 2
      },
      {
        name: main.province, type: "line", data: pts(main), smooth: 0.15,
        symbol: "circle", symbolSize: 8, showSymbol: false,
        lineStyle: { color: p.gas, width: 2.5 },
        itemStyle: { color: p.gas, borderColor: p.surface, borderWidth: 2 },
        areaStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: U.alpha(p.gas, 0.02) },
            { offset: 1, color: U.alpha(p.gas, 0.14) }] }
        }, z: 3
      }
    ];
    if (main === nat) series.splice(1, 1);

    return Object.assign(U.baseOption(), {
      grid: { top: 34, bottom: 46, left: 12, right: 20, containLabel: true },
      legend: {
        top: 0, right: "center", itemWidth: 16, itemHeight: 10, itemGap: 16,
        textStyle: { color: p.ink2, fontSize: 11.5, fontFamily: "Estedad, sans-serif" }
      },
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "axis",
        axisPointer: { type: "cross", label: { show: false },
          crossStyle: { color: p.axis }, lineStyle: { color: p.axis } },
        formatter: function (ps) {
          var out = "<b>" + U.faPct(ps[0].data[0], 1) + " کم‌مصرف‌ترین مشترکین</b>";
          ps.forEach(function (s) {
            if (s.seriesName === "برابری کامل") return;
            out += "<br>" + s.marker + s.seriesName + ": " + U.faPct(s.data[1], 1) + " از گاز";
          });
          return out;
        }
      }),
      xAxis: U.axis({ type: "value", min: 0, max: 100,
        name: "درصد تجمعی مشترکین (از کم‌مصرف به پرمصرف)", nameLocation: "middle", nameGap: 30,
        axisLabel: { color: p.muted, fontSize: 11,
          formatter: function (v) { return U.faNum(v, 0) + "٪"; } } }),
      yAxis: U.axis({ type: "value", min: 0, max: 100, name: "درصد تجمعی مصرف",
        nameLocation: "middle", nameGap: 42, nameRotate: 90,
        axisLabel: { color: p.muted, fontSize: 11,
          formatter: function (v) { return U.faNum(v, 0) + "٪"; } } }),
      series: series
    });
  }

  /* ======================================================================
     ۵. نقشهٔ کروپلت استان‌های ایران
     ====================================================================== */
  var MAP_METRICS = {
    over_pattern: { key: "h1_over_pattern", label: "سهم مصرف مازاد بر الگو", unit: "٪", dec: 1,
      hint: "چند درصد گاز استان بالاتر از سقف الگو (پلهٔ ۳) سوخته است" },
    tail_cons: { key: "h1_tail_cons", label: "سهم مصرف پرمصرف‌ها و بسیار پرمصرف‌ها", unit: "٪", dec: 1,
      hint: "وزن پله‌های ۷ تا ۱۲ در کل مصرف استان" },
    gini: { key: "h1_gini", label: "ضریب جینی مصرف", unit: "", dec: 3,
      hint: "هرچه بزرگ‌تر، توزیع مصرف بین مشترکین نابرابرتر" },
    median_tier: { key: "h1_median_tier", label: "پلهٔ مشترک میانه", unit: "", dec: 2,
      hint: "مشترک وسطِ استان در کدام پله می‌ایستد" },
    top10: { key: "h1_top10", label: "سهم مصرف ۱۰٪ پرمصرف‌ترین", unit: "٪", dec: 1,
      hint: "پرمصرف‌ترین یک‌دهم مشترکین چند درصد گاز را می‌برند" },
    climate_residual: { key: "climate_residual", label: "انحراف از انتظار اقلیمی", unit: " واحد", dec: 1,
      diverging: true,
      hint: "بالاتر از صفر یعنی بیش از آنچه سرمای استان توجیه می‌کند گاز می‌سوزد" }
  };

  function iranMap(dom, opts) {
    var p = U.palette();
    var m = MAP_METRICS[opts.metric || "over_pattern"];
    var values = D.provinces.map(function (r) { return r[m.key]; });
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var ramp = m.diverging ? p.div : p.seq;
    if (m.diverging) {
      var bound = Math.max(Math.abs(min), Math.abs(max));
      min = -bound; max = bound;
    }

    var data = D.provinces.map(function (r) {
      return {
        name: r.province, value: r[m.key],
        itemStyle: { areaColor: U.rampColor(r[m.key], min, max, ramp) }
      };
    });

    return Object.assign(U.baseOption(), {
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "item",
        formatter: function (o) {
          if (o.value === undefined || o.value !== o.value) return o.name;
          var r = rec(o.name);
          return "<b>" + o.name + "</b><br>" + m.label + ": <b>" +
            U.faNum(o.value, m.dec) + m.unit + "</b>" +
            "<br><span style='opacity:.72'>مصرف مازاد بر الگو: " + U.faPct(r.h1_over_pattern, 1) +
            "<br>جینی: " + U.faNum(r.h1_gini, 3) +
            "<br>میانگین دما: " + U.faNum(r.temp, 1) + "°C</span>";
        }
      }),
      visualMap: {
        type: "continuous", min: min, max: max,
        right: 12, bottom: 16, orient: "vertical",
        itemHeight: 150, itemWidth: 12, calculable: true,
        inRange: { color: ramp },
        text: ["", ""],
        textStyle: { color: p.muted, fontSize: 11, fontFamily: "Estedad, sans-serif" },
        formatter: function (v) { return U.faNum(v, m.dec) + m.unit; }
      },
      series: [{
        type: "map", map: "iran", roam: true, zoom: 1.2,
        scaleLimit: { min: 1, max: 6 },
        selectedMode: "single",
        label: {
          show: true, color: p.ink, fontSize: 9.5, fontFamily: "Estedad, sans-serif",
          formatter: function (o) { return dom.clientWidth > 520 ? o.name : ""; },
          textBorderColor: p.surface, textBorderWidth: 2.5
        },
        itemStyle: { borderColor: p.surface, borderWidth: 0.9 },
        emphasis: {
          label: { show: true, color: p.ink, fontWeight: 700, fontSize: 11.5 },
          itemStyle: { areaColor: null, borderColor: p.ink, borderWidth: 1.8,
            shadowBlur: 14, shadowColor: "rgba(0,0,0,.4)" }
        },
        select: {
          label: { show: true, color: p.ink, fontWeight: 700 },
          itemStyle: { borderColor: p.gasLift, borderWidth: 2.2, areaColor: null }
        },
        data: data
      }]
    });
  }

  /* ======================================================================
     ۶. رتبه‌بندی استان‌ها بر اساس شاخص انتخابی
     ====================================================================== */
  function rankingChart(dom, opts) {
    var p = U.palette();
    var m = MAP_METRICS[opts.metric || "over_pattern"];
    var rows = D.provinces.slice().sort(function (a, b) { return a[m.key] - b[m.key]; });
    var values = rows.map(function (r) { return r[m.key]; });
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var ramp = m.diverging ? p.div : p.seq;
    if (m.diverging) {
      var bound = Math.max(Math.abs(min), Math.abs(max));
      min = -bound; max = bound;
    }
    var natVal = D.national[m.key];

    return Object.assign(U.baseOption(), {
      grid: { top: 16, bottom: 34, left: 10, right: 42, containLabel: true },
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "item",
        formatter: function (o) {
          var r = rec(o.name);
          return "<b>" + o.name + "</b><br>" + m.label + ": <b>" +
            U.faNum(o.value, m.dec) + m.unit + "</b>" +
            "<br><span style='opacity:.72'>رتبه: " + U.fa(rows.length - o.dataIndex) +
            " از " + U.fa(rows.length) + "</span>";
        }
      }),
      xAxis: U.axis({ type: "value", name: m.label, nameLocation: "middle", nameGap: 26,
        axisLabel: { color: p.muted, fontSize: 11,
          formatter: function (v) { return U.faNum(v, m.dec === 3 ? 2 : 0); } } }),
      yAxis: U.axis({ type: "category", data: rows.map(function (r) { return r.province; }),
        axisLabel: { color: p.ink2, fontSize: 11 }, splitLine: { show: false } }),
      series: [{
        type: "bar", barWidth: "68%", name: m.label,
        data: rows.map(function (r) {
          return { name: r.province, value: r[m.key],
            itemStyle: { color: U.rampColor(r[m.key], min, max, ramp), borderRadius: [0, 4, 4, 0] } };
        }),
        label: { show: true, position: "right", distance: 5, color: p.muted, fontSize: 10.5,
          fontFamily: "Estedad, sans-serif",
          formatter: function (o) { return U.faNum(o.value, m.dec); } },
        markLine: natVal == null ? undefined : {
          silent: true, symbol: "none",
          lineStyle: { color: p.ink2, type: "dashed", width: 1.5 },
          label: { formatter: "کل کشور", color: p.ink2, fontSize: 11,
            fontFamily: "Estedad, sans-serif", position: "start" },
          data: [{ xAxis: natVal }]
        }
      }]
    });
  }

  /* ======================================================================
     ۷. هیت‌مپ استان × پله
     ====================================================================== */
  function heatmapChart(dom, opts) {
    var p = U.palette();
    var mode = opts.mode || "cons";               // cons | count
    var provinces = D.heat.provinces;
    var matrix = mode === "cons" ? D.heat.cons : D.heat.count;
    var data = [], max = 0;
    provinces.forEach(function (name, y) {
      matrix[y].forEach(function (v, x) {
        data.push([x, y, v]);
        if (v > max) max = v;
      });
    });
    var label = mode === "cons" ? "سهم مصرف" : "سهم مشترکین";

    // مقیاس خطی همهٔ جزئیات دنباله را له می‌کند (پلهٔ ۱ تا ۵۹٪ می‌رود و بقیه زیر ۱۰٪‌اند)،
    // پس بازه‌ها را دستی و نامساوی می‌بریم تا ساختار دنباله دیده شود.
    var CUTS = [1, 2.5, 5, 10, 20, 35];
    var pieces = [{ max: CUTS[0], color: p.seq[0], label: "زیر ۱٪" }];
    for (var i = 1; i < CUTS.length; i++) {
      pieces.push({ min: CUTS[i - 1], max: CUTS[i], color: p.seq[i],
        label: U.faNum(CUTS[i - 1], CUTS[i - 1] < 10 ? 1 : 0) + " تا " +
               U.faNum(CUTS[i], CUTS[i] < 10 ? 1 : 0) + "٪" });
    }
    pieces.push({ min: CUTS[CUTS.length - 1], color: p.seq[6],
      label: "بالای " + U.faNum(CUTS[CUTS.length - 1], 0) + "٪" });

    return Object.assign(U.baseOption(), {
      grid: { top: 34, bottom: 78, left: 126, right: 20, containLabel: false },
      tooltip: Object.assign(U.baseOption().tooltip, {
        formatter: function (o) {
          return "<b>" + provinces[o.data[1]] + "</b><br>پلهٔ " + TIER_LABELS[o.data[0]] +
                 "<br>" + label + ": <b>" + U.faPct(o.data[2], 1) + "</b>";
        }
      }),
      xAxis: U.axis({ type: "category", data: TIER_LABELS, position: "top", inverse: true,
        axisLabel: {
          color: p.ink2, fontSize: 11.5, fontWeight: 600,
          formatter: function (v) { return "پلهٔ " + v; }
        },
        splitArea: { show: false }, splitLine: { show: false } }),
      yAxis: U.axis({ type: "category", data: provinces,
        axisLabel: { color: p.ink2, fontSize: 10.5, margin: 10 },
        splitArea: { show: false }, splitLine: { show: false } }),
      visualMap: {
        type: "piecewise", pieces: pieces, orient: "horizontal",
        left: "center", bottom: 8, itemWidth: 18, itemHeight: 12, itemGap: 8,
        textStyle: { color: p.muted, fontSize: 10.5, fontFamily: "Estedad, sans-serif" },
        selectedMode: false
      },
      series: [{
        type: "heatmap", data: data,
        itemStyle: { borderColor: p.surface, borderWidth: 1.5, borderRadius: 2 },
        emphasis: { itemStyle: { borderColor: p.ink, borderWidth: 1.8 } },
        progressive: 0
      }]
    });
  }

  /* ======================================================================
     ۸. اقلیم در برابر رفتار: دما ↔ مصرف مازاد بر الگو
     ====================================================================== */
  function climateScatter(dom, opts) {
    var p = U.palette();
    var c = D.climate.over_pattern;
    var temps = D.provinces.map(function (r) { return r.temp; });
    var tMin = Math.min.apply(null, temps) - 1, tMax = Math.max.apply(null, temps) + 1;
    var resids = D.provinces.map(function (r) { return Math.abs(r.climate_residual); });
    var rMax = Math.max.apply(null, resids);

    // استان‌هایی که بیشترین انحراف را دارند برچسب می‌گیرند
    var flagged = D.provinces.slice()
      .sort(function (a, b) { return Math.abs(b.climate_residual) - Math.abs(a.climate_residual); })
      .slice(0, 7).map(function (r) { return r.province; });

    return Object.assign(U.baseOption(), {
      grid: { top: 26, bottom: 48, left: 12, right: 22, containLabel: true },
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "item",
        formatter: function (o) {
          if (o.seriesName === "خط برازش") return null;
          var r = rec(o.data[2]);
          var sign = r.climate_residual >= 0 ? "بیشتر" : "کمتر";
          return "<b>" + r.province + "</b><br>میانگین دما: " + U.faNum(r.temp, 1) + "°C" +
            "<br>مصرف مازاد بر الگو: <b>" + U.faPct(r.h1_over_pattern, 1) + "</b>" +
            "<br>انتظار اقلیمی: " + U.faPct(r.climate_expected, 1) +
            "<br><span style='color:" + (r.climate_residual >= 0 ? p.critical : p.subs) + "'>" +
            U.faNum(Math.abs(r.climate_residual), 1) + " واحد " + sign + " از انتظار</span>";
        }
      }),
      xAxis: U.axis({ type: "value", min: tMin, max: tMax, scale: true,
        name: "میانگین دمای سالانهٔ مرکز استان (°C)", nameLocation: "middle", nameGap: 30,
        axisLabel: { color: p.muted, fontSize: 11,
          formatter: function (v) { return U.faNum(v, 0); } } }),
      yAxis: U.axis({ type: "value", scale: true, name: "سهم مصرف مازاد بر الگو",
        nameLocation: "middle", nameGap: 44, nameRotate: 90,
        axisLabel: { color: p.muted, fontSize: 11,
          formatter: function (v) { return U.faNum(v, 0) + "٪"; } } }),
      series: [
        {
          name: "خط برازش", type: "line", symbol: "none", silent: true, z: 1,
          data: [[tMin, c.slope * tMin + c.intercept], [tMax, c.slope * tMax + c.intercept]],
          lineStyle: { color: p.muted, width: 1.8, type: "dashed" }
        },
        {
          name: "استان", type: "scatter", z: 3,
          symbolSize: function (d) { return 11 + 15 * (Math.abs(rec(d[2]).climate_residual) / rMax); },
          data: D.provinces.map(function (r) { return [r.temp, r.h1_over_pattern, r.province]; }),
          itemStyle: {
            color: function (o) {
              var r = rec(o.data[2]);
              return U.rampColor(r.climate_residual, -rMax, rMax, p.div);
            },
            borderColor: p.surface, borderWidth: 2
          },
          label: {
            show: true, position: "top", distance: 7, color: p.ink2, fontSize: 10.5,
            fontFamily: "Estedad, sans-serif",
            formatter: function (o) {
              return flagged.indexOf(o.data[2]) >= 0 ? o.data[2] : "";
            }
          },
          emphasis: { scale: 1.35, label: { show: true, color: p.ink, fontWeight: 700 } }
        }
      ]
    });
  }

  /* ======================================================================
     ۹. سنکی: از صد مشترک تا صد واحد گاز
     ====================================================================== */
  function sankeyChart(dom, opts) {
    var p = U.palette();
    var r = rec(opts.province);
    var half = opts.half || "h1";
    var counts = GROUP_KEYS.map(function (k) { return r[half + "_count_g"][k]; });
    var cons = GROUP_KEYS.map(function (k) { return r[half + "_cons_g"][k]; });

    // برچسب ستون آخر باید به داخل بیفتد وگرنه از لبهٔ نمودار بیرون می‌زند
    var nodes = [{
      name: "۱۰۰ مشترک خانگی", itemStyle: { color: p.subs },
      label: { position: "right" }
    }];
    GROUP_KEYS.forEach(function (k, i) {
      nodes.push({ name: GROUP_LABELS[i], itemStyle: { color: p.groups[i] },
        label: { position: "right" } });
    });
    nodes.push({
      name: "۱۰۰ واحد گاز مصرفی", itemStyle: { color: p.gas },
      label: { position: "left" }
    });

    // هر نوار رنگ گروه خودش را می‌گیرد تا خوانش «کدام گروه» بی‌ابهام بماند
    var links = [];
    GROUP_KEYS.forEach(function (k, i) {
      links.push({
        source: "۱۰۰ مشترک خانگی", target: GROUP_LABELS[i], value: counts[i], _kind: "count",
        lineStyle: { color: p.groups[i], opacity: 0.6 }
      });
      links.push({
        source: GROUP_LABELS[i], target: "۱۰۰ واحد گاز مصرفی", value: cons[i], _kind: "cons",
        lineStyle: { color: p.groups[i], opacity: 0.8 }
      });
    });

    return Object.assign(U.baseOption(), {
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "item",
        formatter: function (o) {
          if (o.dataType === "edge") {
            var what = o.data._kind === "count" ? "از مشترکین" : "از گاز مصرفی";
            return "<b>" + o.data.target.replace("۱۰۰ واحد گاز مصرفی", o.data.source) + "</b><br>" +
              U.faPct(o.value, 1) + " " + what;
          }
          return "<b>" + o.name + "</b>";
        }
      }),
      series: [{
        type: "sankey", right: 20, left: 20, top: 18, bottom: 18,
        nodeWidth: 15, nodeGap: 13, layoutIterations: 0,
        emphasis: { focus: "adjacency" },
        label: {
          color: p.ink, fontSize: 11.5, fontFamily: "Estedad, sans-serif", fontWeight: 600,
          textBorderColor: p.surface, textBorderWidth: 3,
          formatter: function (o) { return o.name; }
        },
        lineStyle: { curveness: 0.5 },
        itemStyle: { borderWidth: 0 },
        data: nodes, links: links
      }]
    });
  }

  /* ======================================================================
     ۱۰. مقایسهٔ فصلی - شدت مصرف بالاترین گروه در دو دوره
     ---------------------------------------------------------------------
     تعداد پله‌های دو نیم‌سال یکی نیست (۱۲ در برابر ۴)، پس سهم‌های خام گروه‌ها
     بین دو دوره قابل مقایسه نیستند. اما «ضریب شدت» بالاترین گروه یک نسبت
     درون‌دوره‌ای است (سهم مصرف ÷ سهم مشترک) و مقایسه‌اش معنا دارد: می‌گوید در
     هر دوره، پرمصرف‌ترین گروه چقدر از مشترک متوسط همان دوره فاصله گرفته است.
     ====================================================================== */
  function seasonDumbbell(dom, opts) {
    var p = U.palette();
    function warm(r) { return r.h2_intensity_g.very; }
    function cold(r) { return r.h1_intensity_g.very; }

    var rows = D.provinces.slice().sort(function (a, b) {
      return (cold(a) - warm(a)) - (cold(b) - warm(b));
    });
    var names = rows.map(function (r) { return r.province; });

    return Object.assign(U.baseOption(), {
      grid: { top: 38, bottom: 40, left: 10, right: 26, containLabel: true },
      legend: {
        top: 2, right: "center", itemWidth: 12, itemHeight: 12, itemGap: 18,
        textStyle: { color: p.ink2, fontSize: 11.5, fontFamily: "Estedad, sans-serif" },
        data: ["دورهٔ گرم — بالاترین پله", "دورهٔ سرد — بالاترین گروه"]
      },
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: function (ps) {
          var r = rec(ps[0].axisValue);
          return "<b>" + r.province + "</b><br>" +
            "شدت مصرف پرمصرف‌ترین گروه:<br>" +
            "دورهٔ گرم (پلهٔ ۴): <b>" + U.faTimes(warm(r)) + "</b> " +
            "<span style='opacity:.7'>(" + U.faPct(r.h2_count_g.very, 1) + " مشترک → " +
            U.faPct(r.h2_cons_g.very, 1) + " گاز)</span><br>" +
            "دورهٔ سرد (پله‌های ۱۱ و ۱۲): <b>" + U.faTimes(cold(r)) + "</b> " +
            "<span style='opacity:.7'>(" + U.faPct(r.h1_count_g.very, 1) + " مشترک → " +
            U.faPct(r.h1_cons_g.very, 1) + " گاز)</span>";
        }
      }),
      xAxis: U.axis({ type: "value",
        name: "شدت مصرف بالاترین گروه (برابرِ مشترک متوسط همان دوره)",
        nameLocation: "middle", nameGap: 28,
        axisLabel: { color: p.muted, fontSize: 11,
          formatter: function (v) { return U.faNum(v, 0) + "×"; } } }),
      yAxis: U.axis({ type: "category", data: names,
        axisLabel: { color: p.ink2, fontSize: 11 }, splitLine: { show: false } }),
      series: [
        {
          name: "پیوند", type: "custom", silent: true, z: 1,
          renderItem: function (params, api) {
            var i = params.dataIndex;
            var y = api.coord([0, i])[1];
            var a = api.coord([warm(rows[i]), i])[0];
            var b = api.coord([cold(rows[i]), i])[0];
            return { type: "line", shape: { x1: a, y1: y, x2: b, y2: y },
              style: { stroke: p.axis, lineWidth: 2 } };
          },
          data: rows.map(cold)
        },
        {
          name: "دورهٔ گرم — بالاترین پله", type: "scatter", symbolSize: 10, z: 3,
          itemStyle: { color: p.subs, borderColor: p.surface, borderWidth: 2 },
          data: rows.map(function (r, i) { return [warm(r), i]; })
        },
        {
          name: "دورهٔ سرد — بالاترین گروه", type: "scatter", symbolSize: 10, z: 3,
          itemStyle: { color: p.gas, borderColor: p.surface, borderWidth: 2 },
          data: rows.map(function (r, i) { return [cold(r), i]; })
        }
      ]
    });
  }

  /* ======================================================================
     ۱۱. رادار نیمرخ استان در برابر میانگین کشور
     ====================================================================== */
  function provinceRadar(dom, opts) {
    var p = U.palette();
    var r = rec(opts.province);
    var nat = D.national;

    // بیشینهٔ هر محور از کل استان‌ها، تا مقیاس بین استان‌ها ثابت بماند
    function maxOf(fn) {
      return Math.max.apply(null, D.provinces.map(fn).concat([fn(nat)])) * 1.05;
    }
    var indicators = [
      { name: "مصرف مازاد بر الگو", max: maxOf(function (x) { return x.h1_over_pattern; }) },
      { name: "سهم پرمصرف‌ها", max: maxOf(function (x) { return x.h1_tail_cons; }) },
      { name: "نابرابری (جینی)", max: maxOf(function (x) { return x.h1_gini; }) },
      { name: "پلهٔ میانه", max: maxOf(function (x) { return x.h1_median_tier; }) },
      { name: "سهم ۱۰٪ پرمصرف", max: maxOf(function (x) { return x.h1_top10; }) }
    ];
    function vec(x) {
      return [x.h1_over_pattern, x.h1_tail_cons, x.h1_gini, x.h1_median_tier, x.h1_top10];
    }

    return Object.assign(U.baseOption(), {
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "item",
        formatter: function (o) {
          return "<b>" + o.name + "</b><br>" + indicators.map(function (ind, i) {
            return ind.name + ": " + U.faNum(o.value[i], i === 2 ? 3 : 1);
          }).join("<br>");
        }
      }),
      legend: {
        bottom: 0, right: "center", itemWidth: 14, itemHeight: 10, itemGap: 16,
        textStyle: { color: p.ink2, fontSize: 11.5, fontFamily: "Estedad, sans-serif" }
      },
      radar: {
        indicator: indicators, center: ["50%", "48%"], radius: "62%",
        shape: "polygon", splitNumber: 4,
        axisName: { color: p.ink2, fontSize: 11, fontFamily: "Estedad, sans-serif" },
        splitLine: { lineStyle: { color: p.grid } },
        splitArea: { areaStyle: { color: ["transparent"] } },
        axisLine: { lineStyle: { color: p.grid } }
      },
      series: [{
        type: "radar", symbolSize: 5,
        data: [
          {
            value: vec(nat), name: "کل کشور",
            lineStyle: { color: p.muted, width: 1.8, type: "dashed" },
            itemStyle: { color: p.muted },
            areaStyle: { color: U.alpha(p.muted, 0.1) }
          },
          {
            value: vec(r), name: r.province,
            lineStyle: { color: p.gas, width: 2.4 },
            itemStyle: { color: p.gas },
            areaStyle: { color: U.alpha(p.gas, 0.22) }
          }
        ]
      }]
    });
  }

  /* ======================================================================
     ۱۲. نیمرخ پله‌ای استان: میله‌های انباشته دو دوره
     ====================================================================== */
  function provinceTiers(dom, opts) {
    var p = U.palette();
    var r = rec(opts.province);
    var rows = ["مشترکین (سرد)", "مصرف (سرد)", "مشترکین (گرم)", "مصرف (گرم)"];
    var src = [
      GROUP_KEYS.map(function (k) { return r.h1_count_g[k]; }),
      GROUP_KEYS.map(function (k) { return r.h1_cons_g[k]; }),
      GROUP_KEYS.map(function (k) { return r.h2_count_g[k]; }),
      GROUP_KEYS.map(function (k) { return r.h2_cons_g[k]; })
    ];

    return Object.assign(U.baseOption(), {
      grid: { top: 34, bottom: 12, left: 8, right: 8, containLabel: true },
      legend: {
        top: 0, right: "center", itemWidth: 12, itemHeight: 12, itemGap: 14,
        textStyle: { color: p.ink2, fontSize: 11, fontFamily: "Estedad, sans-serif" },
        data: GROUP_LABELS
      },
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: function (ps) {
          return "<b>" + ps[0].axisValue + "</b>" + ps.map(function (s) {
            return "<br>" + s.marker + s.seriesName + ": " + U.faPct(s.value, 1);
          }).join("");
        }
      }),
      xAxis: U.axis({ type: "value", max: 100, show: false }),
      yAxis: U.axis({ type: "category", data: rows, inverse: true,
        axisLabel: { color: p.ink2, fontSize: 11.5 }, splitLine: { show: false },
        axisLine: { show: false } }),
      series: GROUP_LABELS.map(function (label, gi) {
        return {
          name: label, type: "bar", stack: "s", barWidth: "56%",
          itemStyle: { color: p.groups[gi], borderColor: p.surface, borderWidth: 1 },
          data: src.map(function (row) { return row[gi]; }),
          label: {
            show: true, color: "#fff", fontSize: 10.5, fontFamily: "Estedad, sans-serif",
            fontWeight: 600, textBorderColor: "rgba(0,0,0,.45)", textBorderWidth: 2,
            formatter: function (o) { return o.value >= 7 ? U.faNum(o.value, 0) : ""; }
          }
        };
      })
    });
  }

  /* ======================================================================
     ۱۳. تری‌مپ مصرف: گروه ← پله
     ====================================================================== */
  function treemapChart(dom, opts) {
    var p = U.palette();
    var r = rec(opts.province);
    var bounds = D.meta.groups_h1;
    var children = GROUP_KEYS.map(function (k, gi) {
      var a = bounds[k][0], b = bounds[k][1];
      var kids = [];
      for (var i = a; i < b; i++) {
        kids.push({
          name: "پلهٔ " + TIER_LABELS[i], value: r.h1_cons[i],
          _tier: i, itemStyle: { color: p.groups[gi] }
        });
      }
      return { name: GROUP_LABELS[gi], itemStyle: { color: p.groups[gi] }, children: kids };
    });

    return Object.assign(U.baseOption(), {
      tooltip: Object.assign(U.baseOption().tooltip, {
        formatter: function (o) {
          var extra = "";
          if (o.data._tier !== undefined && r.h1_intensity[o.data._tier] != null) {
            extra = "<br><span style='opacity:.72'>شدت: " +
              U.faTimes(r.h1_intensity[o.data._tier]) + " میانگین</span>";
          }
          return "<b>" + o.name + "</b><br>سهم از کل مصرف: " + U.faPct(o.value, 1) + extra;
        }
      }),
      series: [{
        type: "treemap", roam: false, nodeClick: false, width: "100%", height: "100%",
        top: 6, bottom: 6, left: 6, right: 6,
        breadcrumb: { show: false },
        levels: [
          { itemStyle: { gapWidth: 3, borderWidth: 0 } },
          {
            itemStyle: { gapWidth: 2, borderColor: p.surface, borderWidth: 2 },
            label: { show: true, color: "#fff", fontSize: 11.5, fontWeight: 600,
              fontFamily: "Estedad, sans-serif",
              textBorderColor: "rgba(0,0,0,.5)", textBorderWidth: 2.5 }
          }
        ],
        label: {
          show: true, fontFamily: "Estedad, sans-serif", color: "#fff", fontSize: 11,
          textBorderColor: "rgba(0,0,0,.5)", textBorderWidth: 2.5,
          formatter: function (o) { return o.name + "\n" + U.faPct(o.value, 1); }
        },
        upperLabel: { show: false },
        data: children
      }]
    });
  }

  /* ======================================================================
     ۱۴. مقایسهٔ چند استان: میله‌های گروهی چهار گروه مصرف
     ====================================================================== */
  function compareChart(dom, opts) {
    var p = U.palette();
    var names = (opts.provinces || []).slice(0, 6);
    if (!names.length) names = ["کل کشور"];
    var recs = names.map(rec);

    return Object.assign(U.baseOption(), {
      grid: { top: 34, bottom: 30, left: 10, right: 12, containLabel: true },
      legend: {
        top: 0, right: "center", itemWidth: 12, itemHeight: 12, itemGap: 14,
        textStyle: { color: p.ink2, fontSize: 11, fontFamily: "Estedad, sans-serif" }
      },
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: function (ps) {
          return "<b>" + ps[0].axisValue + "</b>" + ps.map(function (s) {
            return "<br>" + s.marker + s.seriesName + ": " + U.faPct(s.value, 1);
          }).join("");
        }
      }),
      xAxis: U.axis({ type: "category", data: names,
        axisLabel: { color: p.ink2, fontSize: 11.5, interval: 0,
          width: 90, overflow: "break" } }),
      yAxis: U.axis({ type: "value", max: 100, name: "درصد از مصرف استان", nameGap: 14,
        axisLabel: { color: p.muted, fontSize: 11,
          formatter: function (v) { return U.faNum(v, 0) + "٪"; } } }),
      series: GROUP_LABELS.map(function (label, gi) {
        return {
          name: label, type: "bar", stack: "s", barWidth: "58%",
          itemStyle: { color: p.groups[gi], borderColor: p.surface, borderWidth: 1 },
          data: recs.map(function (r) { return r.h1_cons_g[GROUP_KEYS[gi]]; }),
          label: {
            show: true, color: "#fff", fontSize: 10.5, fontWeight: 600,
            fontFamily: "Estedad, sans-serif",
            textBorderColor: "rgba(0,0,0,.45)", textBorderWidth: 2,
            formatter: function (o) { return o.value >= 6 ? U.faNum(o.value, 0) : ""; }
          }
        };
      })
    });
  }

  /* ======================================================================
     مقایسهٔ بین‌المللی - میلهٔ افقی، ایران برجسته
     داده از content.json می‌آید نه از dataset، چون سنجهٔ مرجع است نه
     خروجی محاسبات ما؛ و باید از پنل مدیریت قابل ویرایش باشد.
     ====================================================================== */
  function benchmarkChart(dom, opts) {
    var p = U.palette();
    var o = opts || {};
    var rows = (o.rows || []).slice().filter(function (r) {
      return r && r.country && r.value != null && r.value !== "";
    });
    // بزرگ‌ترین بالا بنشیند؛ محور y در echarts از پایین می‌چیند
    rows.sort(function (a, b) { return Number(a.value) - Number(b.value); });

    var highlight = o.highlight || "ایران";
    var unit = o.unit || "";
    var decimals = o.decimals == null ? 0 : o.decimals;

    return Object.assign(U.baseOption(), {
      // جا برای برچسب عددی که بیرون انتهای میله می‌نشیند؛ با ۱۶ پیکسل،
      // بلندترین میله برچسبش را از لبه بیرون می‌انداخت.
      grid: { top: 14, bottom: 26, right: 52, left: 16, containLabel: true },
      tooltip: Object.assign(U.baseOption().tooltip, {
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: function (ps) {
          var s = ps[0];
          return "<b>" + s.axisValue + "</b><br>" +
                 U.faNum(s.value, decimals) + " " + unit;
        }
      }),
      xAxis: U.axis({ type: "value", name: unit, nameLocation: "middle", nameGap: 26,
        axisLabel: { color: p.muted, fontSize: 11,
          formatter: function (v) { return U.faNum(v, 0); } } }),
      yAxis: U.axis({ type: "category",
        data: rows.map(function (r) { return r.country; }),
        axisLabel: { color: p.ink2, fontSize: 12, fontWeight: 600 } }),
      series: [{
        type: "bar", barWidth: "62%",
        data: rows.map(function (r) {
          var isHi = r.country === highlight;
          return {
            value: Number(r.value),
            itemStyle: {
              color: isHi ? p.gas : p.subs,
              opacity: isHi ? 1 : 0.45,
              borderRadius: [0, 4, 4, 0]
            }
          };
        }),
        label: {
          show: true, position: "right", color: p.ink2, fontSize: 10.5,
          fontFamily: "Estedad, sans-serif",
          formatter: function (x) { return U.faNum(x.value, decimals); }
        }
      }]
    });
  }

  global.CHARTS = {
    donutPair: donutPair,
    benchmarkChart: benchmarkChart,
    tierButterfly: tierButterfly,
    intensityChart: intensityChart,
    lorenzChart: lorenzChart,
    iranMap: iranMap,
    rankingChart: rankingChart,
    heatmapChart: heatmapChart,
    climateScatter: climateScatter,
    sankeyChart: sankeyChart,
    seasonDumbbell: seasonDumbbell,
    provinceRadar: provinceRadar,
    provinceTiers: provinceTiers,
    treemapChart: treemapChart,
    compareChart: compareChart,
    MAP_METRICS: MAP_METRICS,
    GROUP_LABELS: GROUP_LABELS,
    GROUP_KEYS: GROUP_KEYS,
    TIER_LABELS: TIER_LABELS,
    rec: rec
  };
})(window);
