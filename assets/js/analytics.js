/* ==========================================================================
   موتور تحلیل سمت مرورگر: از جدول‌های خام (raw_data.json-style) شاخص‌های
   مشتق را می‌سازد. معادل جاوااسکریپتی build/analytics.py، برای استفادهٔ
   پیش‌نمایش زندهٔ پنل مدیریت و/یا Cloudflare Worker.
   ========================================================================== */
(function (global) {
  "use strict";

  var GROUPS_H1 = { low: [0, 3], medium: [3, 6], high: [6, 10], very: [10, 12] };
  var H2_KEYS = ["low", "medium", "high", "very"];

  function sum(values) {
    return values.reduce(function (a, b) { return a + b; }, 0);
  }

  function normalize(values) {
    var total = sum(values);
    if (total === 0) return values.slice();
    return values.map(function (v) { return v * 100.0 / total; });
  }

  function round(value, decimals) {
    var f = Math.pow(10, decimals === undefined ? 2 : decimals);
    return Math.round((value + Number.EPSILON) * f) / f;
  }

  function groupSums(values, groups) {
    var out = {};
    Object.keys(groups).forEach(function (name) {
      var range = groups[name];
      out[name] = round(sum(values.slice(range[0], range[1])), 2);
    });
    return out;
  }

  function lorenz(countPct, consPct) {
    var pts = [[0, 0]];
    var cp = 0, cq = 0;
    for (var i = 0; i < countPct.length; i++) {
      cp += countPct[i];
      cq += consPct[i];
      pts.push([round(cp, 4), round(cq, 4)]);
    }
    return pts;
  }

  function giniFromLorenz(points) {
    var area = 0;
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i][0], q0 = points[i][1];
      var p1 = points[i + 1][0], q1 = points[i + 1][1];
      area += (p1 - p0) * (q1 + q0) / 2.0;
    }
    area /= 10000.0;
    return Math.max(0, Math.min(1, 1 - 2 * area));
  }

  function lorenzAt(points, target) {
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i][0], q0 = points[i][1];
      var p1 = points[i + 1][0], q1 = points[i + 1][1];
      if (p0 - 1e-9 <= target && target <= p1 + 1e-9) {
        if (p1 - p0 < 1e-9) return q1;
        var t = (target - p0) / (p1 - p0);
        return q0 + t * (q1 - q0);
      }
    }
    return points[points.length - 1][1];
  }

  function topShare(points, topPct) {
    return round(100.0 - lorenzAt(points, 100.0 - topPct), 2);
  }

  function percentileTier(shares, pct) {
    var cum = 0;
    for (var i = 0; i < shares.length; i++) {
      var prev = cum;
      cum += shares[i];
      if (cum >= pct) {
        var frac = shares[i] < 1e-9 ? 0 : (pct - prev) / shares[i];
        return round(i + 1 + frac, 2);
      }
    }
    return shares.length + 1;
  }

  function intensity(consPct, countPct) {
    return consPct.map(function (c, i) {
      var n = countPct[i];
      return n > 0.0499 ? round(c / n, 2) : null;
    });
  }

  function pearson(xs, ys) {
    var n = xs.length;
    var mx = sum(xs) / n, my = sum(ys) / n;
    var num = 0, dx = 0, dy = 0;
    for (var i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      dx += (xs[i] - mx) * (xs[i] - mx);
      dy += (ys[i] - my) * (ys[i] - my);
    }
    dx = Math.sqrt(dx); dy = Math.sqrt(dy);
    return dx && dy ? num / (dx * dy) : 0;
  }

  function linreg(xs, ys) {
    var n = xs.length;
    var mx = sum(xs) / n, my = sum(ys) / n;
    var denom = 0, num = 0;
    for (var i = 0; i < n; i++) {
      denom += (xs[i] - mx) * (xs[i] - mx);
      num += (xs[i] - mx) * (ys[i] - my);
    }
    var slope = denom ? num / denom : 0;
    return { slope: slope, intercept: my - slope * mx };
  }

  function buildProvince(name, row) {
    var cons1 = normalize(row.h1_cons);
    var cnt1 = normalize(row.h1_count);
    var cons2 = normalize(row.h2_cons);
    var cnt2 = normalize(row.h2_count);

    var lz1 = lorenz(cnt1, cons1);
    var lz2 = lorenz(cnt2, cons2);

    var g1Cons = groupSums(cons1, GROUPS_H1);
    var g1Cnt = groupSums(cnt1, GROUPS_H1);
    var g2Cons = {}, g2Cnt = {};
    H2_KEYS.forEach(function (k, i) {
      g2Cons[k] = round(cons2[i], 2);
      g2Cnt[k] = round(cnt2[i], 2);
    });

    var rec = {
      province: name,
      lat: row.lat === undefined ? null : row.lat,
      lon: row.lon === undefined ? null : row.lon,
      temp: row.temp === undefined ? null : row.temp,

      h1_cons: cons1.map(function (v) { return round(v, 2); }),
      h1_count: cnt1.map(function (v) { return round(v, 2); }),
      h2_cons: cons2.map(function (v) { return round(v, 2); }),
      h2_count: cnt2.map(function (v) { return round(v, 2); }),

      h1_cons_g: g1Cons, h1_count_g: g1Cnt,
      h2_cons_g: g2Cons, h2_count_g: g2Cnt,

      h1_intensity: intensity(cons1, cnt1),
      h2_intensity: intensity(cons2, cnt2),
      h1_intensity_g: {},
      h2_intensity_g: {},

      h1_lorenz: lz1,
      h2_lorenz: lz2,
      h1_gini: round(giniFromLorenz(lz1), 4),
      h2_gini: round(giniFromLorenz(lz2), 4),
      h1_top1: topShare(lz1, 1), h1_top5: topShare(lz1, 5),
      h1_top10: topShare(lz1, 10), h1_top20: topShare(lz1, 20),
      h1_bottom50: round(lorenzAt(lz1, 50.0), 2)
    };

    Object.keys(GROUPS_H1).forEach(function (k) {
      rec.h1_intensity_g[k] = g1Cnt[k] > 0.049 ? round(g1Cons[k] / g1Cnt[k], 2) : null;
    });
    H2_KEYS.forEach(function (k) {
      rec.h2_intensity_g[k] = g2Cnt[k] > 0.049 ? round(g2Cons[k] / g2Cnt[k], 2) : null;
    });

    rec.h1_median_tier = percentileTier(cnt1, 50.0);
    rec.h1_p90_tier = percentileTier(cnt1, 90.0);
    rec.h1_cons_median_tier = percentileTier(cons1, 50.0);
    rec.h1_over_pattern = round(100.0 - g1Cons.low, 2);
    rec.h1_over_pattern_count = round(100.0 - g1Cnt.low, 2);
    rec.h1_tail_cons = round(g1Cons.high + g1Cons.very, 2);
    rec.h1_tail_count = round(g1Cnt.high + g1Cnt.very, 2);
    rec.h1_cons_per_sub_low = g1Cnt.low ? round(g1Cons.low / g1Cnt.low, 3) : null;

    rec.season_shift_low_cons = round(g1Cons.low - g2Cons.low, 2);
    rec.season_shift_low_count = round(g1Cnt.low - g2Cnt.low, 2);
    rec.season_gini_shift = round(rec.h1_gini - rec.h2_gini, 4);

    return rec;
  }

  function rankBy(records, key, getter, reverse) {
    var src = getter || function (r) { return r[key]; };
    var ordered = records.slice().sort(function (a, b) {
      var av = src(a), bv = src(b);
      return reverse === false ? av - bv : bv - av;
    });
    return ordered.map(function (r) { return { province: r.province, value: src(r) }; });
  }

  /**
   * راه‌داده‌های خام (به سبک raw_data.json) را می‌گیرد و همان ساختار
   * window.NIGC را که build/make_webdata.py تولید می‌کند، برمی‌گرداند.
   */
  function build(raw) {
    var provincesOrder = raw.provinces_order;
    var nationalKey = raw.national_key;
    var rows = raw.rows;

    var records = provincesOrder.map(function (name) {
      return buildProvince(name, rows[name]);
    });
    var national = buildProvince(nationalKey, rows[nationalKey]);

    var rankings = {
      gini: rankBy(records, "h1_gini"),
      over_pattern: rankBy(records, "h1_over_pattern"),
      tail_cons: rankBy(records, "h1_tail_cons"),
      top10: rankBy(records, "h1_top10"),
      median_tier: rankBy(records, "h1_median_tier"),
      very_intensity: rankBy(records, null, function (r) { return r.h1_intensity_g.very || 0; }),
      low_share: rankBy(records, null, function (r) { return r.h1_cons_g.low; }, false)
    };

    var temps = records.map(function (r) { return r.temp; });
    var corrGetters = {
      gini: function (r) { return r.h1_gini; },
      over_pattern: function (r) { return r.h1_over_pattern; },
      tail_cons: function (r) { return r.h1_tail_cons; },
      median_tier: function (r) { return r.h1_median_tier; },
      low_cons: function (r) { return r.h1_cons_g.low; }
    };
    var climate = {};
    Object.keys(corrGetters).forEach(function (key) {
      var ys = records.map(corrGetters[key]);
      var fit = linreg(temps, ys);
      var r = pearson(temps, ys);
      climate[key] = {
        r: round(r, 3), slope: round(fit.slope, 4), intercept: round(fit.intercept, 4),
        r2: round(r * r, 3)
      };
    });

    var s = climate.over_pattern.slope, b = climate.over_pattern.intercept;
    records.forEach(function (r) {
      var predicted = s * r.temp + b;
      r.climate_expected = round(predicted, 2);
      r.climate_residual = round(r.h1_over_pattern - predicted, 2);
    });
    national.climate_expected = null;
    national.climate_residual = null;
    rankings.climate_residual = rankBy(records, "climate_residual");

    var heatProvinces = records.slice().sort(function (a, b) {
      return a.h1_cons_g.low - b.h1_cons_g.low;
    }).map(function (r) { return r.province; });
    var byName = {};
    records.forEach(function (r) { byName[r.province] = r; });
    var heat = {
      provinces: heatProvinces,
      cons: heatProvinces.map(function (p) { return byName[p].h1_cons; }),
      count: heatProvinces.map(function (p) { return byName[p].h1_count; })
    };

    var nat = national;
    var headline = {
      low_count: nat.h1_count_g.low,
      low_cons: nat.h1_cons_g.low,
      very_count: nat.h1_count_g.very,
      very_cons: nat.h1_cons_g.very,
      very_multiplier: nat.h1_intensity_g.very,
      tier12_multiplier: nat.h1_intensity[11],
      tier1_multiplier: nat.h1_intensity[0],
      gini: nat.h1_gini,
      gini_h2: nat.h2_gini,
      top10: nat.h1_top10,
      top5: nat.h1_top5,
      top1: nat.h1_top1,
      bottom50: nat.h1_bottom50,
      over_pattern: nat.h1_over_pattern,
      over_pattern_count: nat.h1_over_pattern_count,
      median_tier: nat.h1_median_tier,
      p90_tier: nat.h1_p90_tier,
      cons_median_tier: nat.h1_cons_median_tier,
      spread_gini: round(
        Math.max.apply(null, records.map(function (r) { return r.h1_gini; })) -
        Math.min.apply(null, records.map(function (r) { return r.h1_gini; })), 4),
      province_count: records.length
    };

    return {
      meta: {
        title: raw.meta && raw.meta.title,
        source: raw.meta && raw.meta.source,
        report_date: raw.meta && raw.meta.report_date,
        extract_date: raw.meta && raw.meta.extract_date,
        group_labels: raw.group_labels,
        groups_h1: raw.groups_h1,
        note_h1: raw.meta && raw.meta.note_h1,
        note_h2: raw.meta && raw.meta.note_h2
      },
      national: national,
      provinces: records,
      rankings: rankings,
      climate: climate,
      heat: heat,
      headline: headline
    };
  }

  var api = { build: build, round: round, normalize: normalize };
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  global.NIGC_ANALYTICS = api;
})(typeof self !== "undefined" ? self : this);
