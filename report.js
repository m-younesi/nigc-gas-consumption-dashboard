(() => {
  "use strict";
  const rows = window.GAS_DATA;
  const national = rows.find((row) => row.province === "کل کشور");
  const provinces = rows.filter((row) => row.province !== "کل کشور");
  const groups = [
    ["low", "کم‌مصرف", "#54d6be"],
    ["medium", "متوسط", "#55a8ff"],
    ["high", "پرمصرف", "#ffb45c"],
    ["very", "بسیار پرمصرف", "#ff5b6e"]
  ];
  const digits = "۰۱۲۳۴۵۶۷۸۹";
  const fa = (value, decimals = 1) => Number(value).toFixed(decimals).replace(".", "٫").replace(/\d/g, (d) => digits[d]);
  const upper = (row, half, metric) => row[`${half}_${metric}_high`] + row[`${half}_${metric}_very`];
  const intensity = (row, half) => upper(row, half, "cons") / upper(row, half, "count");

  function svg(width, height) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("viewBox", `0 0 ${width} ${height}`);
    return node;
  }
  function el(name, attrs, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  }

  function stacked(container, rowsToDraw) {
    const chart = svg(1000, 340);
    rowsToDraw.forEach((item, rowIndex) => {
      const [label, half, metric] = item;
      const y = 55 + rowIndex * 130;
      chart.appendChild(el("text", { x: 955, y: y - 15, "text-anchor": "end", fill: "#596579", "font-size": "20", "font-weight": "700" }, label));
      let x = 40;
      groups.forEach(([key, groupLabel, color]) => {
        const value = national[`${half}_${metric}_${key}`];
        const width = value * 9.15;
        chart.appendChild(el("rect", { x, y, width, height: 62, fill: color }));
        if (width > 65) chart.appendChild(el("text", { x: x + width / 2, y: y + 39, "text-anchor": "middle", fill: "#09101f", "font-size": "18", "font-weight": "700" }, `${fa(value)}٪`));
        x += width;
      });
    });
    container.appendChild(chart);
  }

  stacked(document.getElementById("reportFlowH1"), [
    ["سهم تعداد مشترکان", "h1", "count"],
    ["سهم مصرف", "h1", "cons"]
  ]);
  stacked(document.getElementById("reportSeasonal"), [
    ["نیمه اول · سهم مصرف", "h1", "cons"],
    ["نیمه دوم · سهم مصرف", "h2", "cons"]
  ]);

  function ranking() {
    const chart = svg(1000, 620);
    const ranked = provinces.map((row) => ({ ...row, delta: upper(row, "h2", "cons") - upper(row, "h1", "cons") }))
      .sort((a, b) => b.delta - a.delta).slice(0, 12);
    const max = ranked[0].delta;
    ranked.forEach((row, index) => {
      const y = 26 + index * 48;
      chart.appendChild(el("line", { x1: 115, y1: y, x2: 750, y2: y, stroke: "#dddcd6", "stroke-width": "9" }));
      chart.appendChild(el("line", { x1: 115, y1: y, x2: 115 + row.delta / max * 635, y2: y, stroke: "#ff5b6e", "stroke-width": "9", "stroke-linecap": "round" }));
      chart.appendChild(el("circle", { cx: 115 + row.delta / max * 635, cy: y, r: 7, fill: "#ff5b6e" }));
      chart.appendChild(el("text", { x: 955, y: y + 6, "text-anchor": "end", fill: "#172035", "font-size": "17", "font-weight": index < 3 ? "700" : "400" }, row.province));
      chart.appendChild(el("text", { x: 95, y: y + 6, "text-anchor": "end", fill: "#657084", "font-size": "15", "font-weight": "700" }, `+${fa(row.delta)}`));
    });
    document.getElementById("reportRanking").appendChild(chart);
  }

  function risk() {
    const chart = svg(1000, 620);
    const plot = { x: 95, y: 35, w: 790, h: 500 };
    const maxX = 25;
    const maxY = 4;
    const sx = (v) => plot.x + v / maxX * plot.w;
    const sy = (v) => plot.y + plot.h - v / maxY * plot.h;
    for (let i = 0; i <= 5; i += 1) {
      const x = plot.x + plot.w * i / 5;
      const y = plot.y + plot.h * i / 5;
      chart.appendChild(el("line", { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.h, stroke: "#d9dce2" }));
      chart.appendChild(el("line", { x1: plot.x, y1: y, x2: plot.x + plot.w, y2: y, stroke: "#d9dce2" }));
    }
    const nx = upper(national, "h2", "count");
    const ny = intensity(national, "h2");
    chart.appendChild(el("line", { x1: sx(nx), y1: plot.y, x2: sx(nx), y2: plot.y + plot.h, stroke: "#54d6be", "stroke-dasharray": "7 7" }));
    chart.appendChild(el("line", { x1: plot.x, y1: sy(ny), x2: plot.x + plot.w, y2: sy(ny), stroke: "#54d6be", "stroke-dasharray": "7 7" }));
    provinces.forEach((row) => {
      const highlight = ["کردستان", "آذربایجان غربی", "کهگیلویه و بویراحمد", "هرمزگان", "بوشهر", "فارس"].includes(row.province);
      chart.appendChild(el("circle", { cx: sx(upper(row, "h2", "count")), cy: sy(intensity(row, "h2")), r: highlight ? 8 : 5, fill: highlight ? "#ff5b6e" : "#7183a0", opacity: highlight ? "1" : ".72" }));
      if (highlight) chart.appendChild(el("text", { x: sx(upper(row, "h2", "count")), y: sy(intensity(row, "h2")) - 13, "text-anchor": "middle", fill: "#263148", "font-size": "12", "font-weight": "700" }, row.province));
    });
    chart.appendChild(el("circle", { cx: sx(nx), cy: sy(ny), r: 8, fill: "#54d6be" }));
    chart.appendChild(el("text", { x: sx(nx) + 12, y: sy(ny) - 10, fill: "#263148", "font-size": "13", "font-weight": "700" }, "کل کشور"));
    chart.appendChild(el("text", { x: plot.x + plot.w / 2, y: 600, "text-anchor": "middle", fill: "#657084", "font-size": "15" }, "سهم مشترکان پله‌های بالا"));
    chart.appendChild(el("text", { x: 25, y: plot.y + plot.h / 2, "text-anchor": "middle", fill: "#657084", "font-size": "15", transform: `rotate(-90 25 ${plot.y + plot.h / 2})` }, "شدت مصرف نسبی"));
    document.getElementById("reportRisk").appendChild(chart);
  }

  ranking();
  risk();
  document.documentElement.dataset.ready = "true";
})();
