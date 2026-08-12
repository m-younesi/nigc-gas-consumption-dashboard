(() => {
  "use strict";

  const rows = window.GAS_DATA || [];
  const national = rows.find((row) => row.province === "کل کشور");
  const provinces = rows.filter((row) => row.province !== "کل کشور");
  const groups = [
    { key: "low", label: "کم‌مصرف", color: "#54d6be" },
    { key: "medium", label: "متوسط", color: "#55a8ff" },
    { key: "high", label: "پرمصرف", color: "#ffb45c" },
    { key: "very", label: "بسیار پرمصرف", color: "#ff5b6e" }
  ];
  const faDigits = "۰۱۲۳۴۵۶۷۸۹";
  const state = { province: "کل کشور", half: "h2", metric: "cons" };

  const $ = (selector) => document.querySelector(selector);
  const ns = "http://www.w3.org/2000/svg";
  const provinceSelect = $("#provinceSelect");
  const tooltip = $("#chartTooltip");

  function faNumber(value, digits = 1) {
    const text = Number(value).toFixed(digits).replace(".", "٫");
    return text.replace(/\d/g, (digit) => faDigits[digit]);
  }

  function svgNode(name, attributes = {}, text = "") {
    const node = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  }

  function rowByName(name) {
    return rows.find((row) => row.province === name) || national;
  }

  function upper(row, half, metric) {
    return row[`${half}_${metric}_high`] + row[`${half}_${metric}_very`];
  }

  function intensity(row, half) {
    const count = upper(row, half, "count");
    return count ? upper(row, half, "cons") / count : 0;
  }

  function metricValue(row, metric, half) {
    if (metric === "intensity") return intensity(row, half);
    return upper(row, half, metric);
  }

  function clearSvg(svg) {
    Array.from(svg.children).forEach((child) => {
      if (!["title", "desc"].includes(child.tagName.toLowerCase())) child.remove();
    });
  }

  function showTooltip(event, html) {
    tooltip.innerHTML = html;
    tooltip.classList.add("visible");
    const pad = 14;
    const rect = tooltip.getBoundingClientRect();
    let left = event.clientX + 14;
    let top = event.clientY + 14;
    if (left + rect.width > window.innerWidth - pad) left = event.clientX - rect.width - 14;
    if (top + rect.height > window.innerHeight - pad) top = event.clientY - rect.height - 14;
    tooltip.style.left = `${Math.max(pad, left)}px`;
    tooltip.style.top = `${Math.max(pad, top)}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
  }

  function bindMark(node, labelBuilder, selectProvince) {
    node.setAttribute("tabindex", "0");
    node.addEventListener("pointermove", (event) => showTooltip(event, labelBuilder()));
    node.addEventListener("pointerleave", hideTooltip);
    node.addEventListener("focus", (event) => {
      const rect = event.target.getBoundingClientRect();
      showTooltip({ clientX: rect.left + rect.width / 2, clientY: rect.top }, labelBuilder());
    });
    node.addEventListener("blur", hideTooltip);
    if (selectProvince) {
      node.style.cursor = "pointer";
      node.addEventListener("click", () => {
        state.province = selectProvince;
        provinceSelect.value = selectProvince;
        render();
      });
    }
  }

  function renderFlow() {
    const row = rowByName(state.province);
    const halfLabel = state.half === "h1" ? "نیمه اول" : "نیمه دوم";
    const svg = $("#flowChart");
    clearSvg(svg);

    const x0 = 90;
    const width = 780;
    const topY = 98;
    const bottomY = 390;
    const barH = 66;
    const gap = 7;
    const topValues = groups.map((group) => row[`${state.half}_count_${group.key}`]);
    const bottomValues = groups.map((group) => row[`${state.half}_cons_${group.key}`]);
    const topTotal = topValues.reduce((sum, value) => sum + value, 0);
    const bottomTotal = bottomValues.reduce((sum, value) => sum + value, 0);
    let topCursor = x0;
    let bottomCursor = x0;

    svg.appendChild(svgNode("text", { x: 870, y: 56, class: "axis-label", "text-anchor": "end" }, "سهم تعداد مشترکان"));
    svg.appendChild(svgNode("text", { x: 870, y: 494, class: "axis-label", "text-anchor": "end" }, "سهم مصرف"));

    groups.forEach((group, index) => {
      const topW = width * topValues[index] / topTotal;
      const bottomW = width * bottomValues[index] / bottomTotal;
      const topStart = topCursor;
      const bottomStart = bottomCursor;
      const d = [
        `M ${topStart + gap / 2} ${topY + barH}`,
        `C ${topStart + gap / 2} ${topY + 170}, ${bottomStart + gap / 2} ${bottomY - 105}, ${bottomStart + gap / 2} ${bottomY}`,
        `L ${bottomStart + bottomW - gap / 2} ${bottomY}`,
        `C ${bottomStart + bottomW - gap / 2} ${bottomY - 105}, ${topStart + topW - gap / 2} ${topY + 170}, ${topStart + topW - gap / 2} ${topY + barH}`,
        "Z"
      ].join(" ");
      const ribbon = svgNode("path", {
        d,
        fill: group.color,
        opacity: ".24",
        stroke: group.color,
        "stroke-opacity": ".45"
      });
      bindMark(ribbon, () => `<strong>${group.label}</strong><br>مشترکان: ${faNumber(topValues[index])}٪<br>مصرف: ${faNumber(bottomValues[index])}٪`);
      svg.appendChild(ribbon);

      const topRect = svgNode("rect", {
        x: topStart + gap / 2,
        y: topY,
        width: Math.max(1, topW - gap),
        height: barH,
        rx: 5,
        fill: group.color
      });
      const bottomRect = svgNode("rect", {
        x: bottomStart + gap / 2,
        y: bottomY,
        width: Math.max(1, bottomW - gap),
        height: barH,
        rx: 5,
        fill: group.color
      });
      [topRect, bottomRect].forEach((mark) => bindMark(mark, () => `<strong>${group.label}</strong><br>مشترکان: ${faNumber(topValues[index])}٪<br>مصرف: ${faNumber(bottomValues[index])}٪`));
      svg.appendChild(topRect);
      svg.appendChild(bottomRect);

      if (topW > 96) {
        svg.appendChild(svgNode("text", {
          x: topStart + topW / 2,
          y: topY + 42,
          class: "flow-value",
          "text-anchor": "middle"
        }, `${faNumber(topValues[index])}٪`));
      }
      if (bottomW > 96) {
        svg.appendChild(svgNode("text", {
          x: bottomStart + bottomW / 2,
          y: bottomY + 42,
          class: "flow-value",
          "text-anchor": "middle"
        }, `${faNumber(bottomValues[index])}٪`));
      }
      topCursor += topW;
      bottomCursor += bottomW;
    });

    const upperCount = upper(row, state.half, "count");
    const upperCons = upper(row, state.half, "cons");
    const upperIntensity = intensity(row, state.half);
    $("#upperCountValue").textContent = `${faNumber(upperCount)}٪`;
    $("#upperConsValue").textContent = `${faNumber(upperCons)}٪`;
    $("#upperIntensityValue").textContent = `${faNumber(upperIntensity)} برابر`;
    $("#flowNarrative").textContent =
      `در ${state.province} و ${halfLabel}، پله‌های ۷ تا ۱۲ با ${faNumber(upperCount)} درصد از مشترکان، ${faNumber(upperCons)} درصد از مصرف را ساخته‌اند.`;
  }

  function renderRisk() {
    const svg = $("#riskChart");
    clearSvg(svg);
    const half = state.half;
    const selected = rowByName(state.province);
    const plot = { x: 86, y: 55, w: 790, h: 500 };
    const xMax = Math.max(25, ...provinces.map((row) => upper(row, half, "count"))) * 1.08;
    const yMax = Math.max(4, ...provinces.map((row) => intensity(row, half))) * 1.04;
    const xScale = (value) => plot.x + value / xMax * plot.w;
    const yScale = (value) => plot.y + plot.h - value / yMax * plot.h;
    const nationalX = upper(national, half, "count");
    const nationalY = intensity(national, half);

    const quadrants = [
      { x: plot.x, y: plot.y, w: xScale(nationalX) - plot.x, h: yScale(nationalY) - plot.y, fill: "rgba(85,168,255,.035)" },
      { x: xScale(nationalX), y: plot.y, w: plot.x + plot.w - xScale(nationalX), h: yScale(nationalY) - plot.y, fill: "rgba(255,91,110,.055)" },
      { x: plot.x, y: yScale(nationalY), w: xScale(nationalX) - plot.x, h: plot.y + plot.h - yScale(nationalY), fill: "rgba(84,214,190,.025)" },
      { x: xScale(nationalX), y: yScale(nationalY), w: plot.x + plot.w - xScale(nationalX), h: plot.y + plot.h - yScale(nationalY), fill: "rgba(255,180,92,.04)" }
    ];
    quadrants.forEach((q) => svg.appendChild(svgNode("rect", q)));

    for (let i = 0; i <= 5; i += 1) {
      const xValue = xMax * i / 5;
      const yValue = yMax * i / 5;
      const x = xScale(xValue);
      const y = yScale(yValue);
      svg.appendChild(svgNode("line", { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.h, stroke: "rgba(133,151,180,.16)" }));
      svg.appendChild(svgNode("line", { x1: plot.x, y1: y, x2: plot.x + plot.w, y2: y, stroke: "rgba(133,151,180,.16)" }));
      svg.appendChild(svgNode("text", { x, y: plot.y + plot.h + 34, class: "axis-tick", "text-anchor": "middle" }, faNumber(xValue, 0)));
      if (i > 0) svg.appendChild(svgNode("text", { x: plot.x - 18, y: y + 5, class: "axis-tick", "text-anchor": "end" }, faNumber(yValue, 1)));
    }

    svg.appendChild(svgNode("line", {
      x1: xScale(nationalX), y1: plot.y, x2: xScale(nationalX), y2: plot.y + plot.h,
      stroke: "#54d6be", "stroke-opacity": ".55", "stroke-dasharray": "7 8"
    }));
    svg.appendChild(svgNode("line", {
      x1: plot.x, y1: yScale(nationalY), x2: plot.x + plot.w, y2: yScale(nationalY),
      stroke: "#54d6be", "stroke-opacity": ".55", "stroke-dasharray": "7 8"
    }));

    provinces.forEach((row) => {
      const xValue = upper(row, half, "count");
      const yValue = intensity(row, half);
      const isSelected = row.province === state.province;
      const circle = svgNode("circle", {
        cx: xScale(xValue),
        cy: yScale(yValue),
        r: isSelected ? 12 : 6.5,
        fill: isSelected ? "#ff5b6e" : "#607393",
        opacity: isSelected ? "1" : ".72",
        stroke: isSelected ? "#f8fbff" : "#09101f",
        "stroke-width": isSelected ? "3" : "1"
      });
      bindMark(circle, () => `<strong>${row.province}</strong><br>مشترکان پله‌های بالا: ${faNumber(xValue)}٪<br>شدت نسبی: ${faNumber(yValue)} برابر`, row.province);
      svg.appendChild(circle);
      if (isSelected) {
        svg.appendChild(svgNode("text", {
          x: xScale(xValue),
          y: yScale(yValue) - 21,
          class: "risk-label",
          "text-anchor": "middle"
        }, row.province));
      }
    });

    const nationalCircle = svgNode("circle", {
      cx: xScale(nationalX), cy: yScale(nationalY), r: 9,
      fill: "#54d6be", stroke: "#09101f", "stroke-width": "2"
    });
    bindMark(nationalCircle, () => `<strong>کل کشور</strong><br>مشترکان پله‌های بالا: ${faNumber(nationalX)}٪<br>شدت نسبی: ${faNumber(nationalY)} برابر`, "کل کشور");
    svg.appendChild(nationalCircle);
    svg.appendChild(svgNode("text", {
      x: xScale(nationalX) + 15, y: yScale(nationalY) - 13, class: "risk-label"
    }, "کل کشور"));

    svg.appendChild(svgNode("text", {
      x: plot.x + plot.w / 2, y: 635, class: "axis-label", "text-anchor": "middle"
    }, "سهم مشترکان پله‌های ۷ تا ۱۲ (درصد)"));
    svg.appendChild(svgNode("text", {
      x: 20, y: plot.y + plot.h / 2, class: "axis-label", "text-anchor": "middle",
      transform: `rotate(-90 20 ${plot.y + plot.h / 2})`
    }, "شدت مصرف نسبی (برابر)"));

    const selX = upper(selected, half, "count");
    const selY = intensity(selected, half);
    const frequency = selX >= nationalX ? "بالاتر" : "پایین‌تر";
    const severity = selY >= nationalY ? "بالاتر" : "پایین‌تر";
    $("#riskDetail").textContent =
      `${selected.province}: فراوانی پله‌های بالا ${frequency} از میانگین کشور و شدت مصرف ${severity} از میانگین کشور است.`;
  }

  function renderRanking() {
    const svg = $("#rankingChart");
    clearSvg(svg);
    const metric = state.metric;
    const half = state.half;
    const ranked = [...provinces]
      .sort((a, b) => metricValue(b, metric, half) - metricValue(a, metric, half))
      .slice(0, 10);
    const maxValue = Math.max(...ranked.map((row) => metricValue(row, metric, half)));
    const plot = { x: 105, y: 42, w: 635, rowH: 58 };
    const selectedRank = [...provinces]
      .sort((a, b) => metricValue(b, metric, half) - metricValue(a, metric, half))
      .findIndex((row) => row.province === state.province) + 1;

    ranked.forEach((row, index) => {
      const value = metricValue(row, metric, half);
      const width = plot.w * value / maxValue;
      const y = plot.y + index * plot.rowH;
      const isSelected = row.province === state.province;
      svg.appendChild(svgNode("line", {
        x1: plot.x, y1: y + 24, x2: plot.x + plot.w, y2: y + 24,
        stroke: "rgba(16,24,42,.11)", "stroke-width": "7"
      }));
      const bar = svgNode("line", {
        x1: plot.x, y1: y + 24, x2: plot.x + width, y2: y + 24,
        stroke: isSelected ? "#ff5b6e" : "#8c7cff",
        "stroke-width": isSelected ? "12" : "8",
        "stroke-linecap": "round"
      });
      bindMark(bar, () => `<strong>${row.province}</strong><br>${metricLabel(metric)}: ${formatMetric(value, metric)}`, row.province);
      svg.appendChild(bar);
      svg.appendChild(svgNode("circle", {
        cx: plot.x + width, cy: y + 24, r: isSelected ? 9 : 7,
        fill: isSelected ? "#ff5b6e" : "#8c7cff"
      }));
      svg.appendChild(svgNode("text", {
        x: 900, y: y + 30, class: "ranking-label", "text-anchor": "end",
        "font-weight": isSelected ? "700" : "400"
      }, row.province));
      svg.appendChild(svgNode("text", {
        x: plot.x - 18, y: y + 30, class: "ranking-value", "text-anchor": "end"
      }, formatMetric(value, metric)));
      svg.appendChild(svgNode("text", {
        x: 935, y: y + 30, class: "ranking-value", "text-anchor": "end"
      }, faNumber(index + 1, 0)));
    });

    const halfLabel = half === "h1" ? "نیمه اول" : "نیمه دوم";
    $("#rankNarrative").textContent =
      state.province === "کل کشور"
        ? `ده استان نخست در ${halfLabel} بر اساس ${metricLabel(metric)} نمایش داده شده‌اند. انتخاب هر نقطه یا نام، کل روایت را روی همان استان تنظیم می‌کند.`
        : `${state.province} در ${halfLabel} از نظر ${metricLabel(metric)} رتبه ${faNumber(selectedRank, 0)} را میان ۳۱ استان دارد.`;
    $("#metricDefinition").textContent =
      metric === "intensity"
        ? "شدت نسبی، سهم مصرف پله‌های ۷ تا ۱۲ را بر سهم تعداد مشترکان همان پله‌ها تقسیم می‌کند."
        : metric === "cons"
          ? "این نما سهم پله‌های ۷ تا ۱۲ از کل مصرف خانگی استان را مقایسه می‌کند."
          : "این نما سهم پله‌های ۷ تا ۱۲ از کل مشترکان خانگی استان را مقایسه می‌کند.";
  }

  function metricLabel(metric) {
    return metric === "cons" ? "سهم مصرف پله‌های بالا" : metric === "count" ? "سهم مشترکان پله‌های بالا" : "شدت نسبی";
  }

  function formatMetric(value, metric) {
    return metric === "intensity" ? `${faNumber(value)}×` : `${faNumber(value)}٪`;
  }

  function render() {
    renderFlow();
    renderRisk();
    renderRanking();
  }

  function initialize() {
    rows.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.province;
      option.textContent = row.province;
      provinceSelect.appendChild(option);
    });
    provinceSelect.value = state.province;
    provinceSelect.addEventListener("change", () => {
      state.province = provinceSelect.value;
      render();
    });
    $("#halfControl").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-half]");
      if (!button) return;
      state.half = button.dataset.half;
      $("#halfControl").querySelectorAll("button").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      render();
    });
    $("#metricControl").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-metric]");
      if (!button) return;
      state.metric = button.dataset.metric;
      $("#metricControl").querySelectorAll("button").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      renderRanking();
    });
    render();
  }

  initialize();
})();
