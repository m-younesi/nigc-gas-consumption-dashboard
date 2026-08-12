/* ==========================================================================
   بارگذاری محتوای پویا: content.json را می‌خواند، متن‌ها/نوار/نمایانی
   بخش‌ها/رنگ‌های تم را پیش از اجرای app.js روی صفحه اعمال می‌کند.
   ========================================================================== */
(function () {
  "use strict";

  function pick(obj, path) {
    return path.split(".").reduce(function (o, k) {
      return o == null ? null : o[k];
    }, obj);
  }

  function applyText(content) {
    var nodes = document.querySelectorAll("[data-c]");
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var path = node.getAttribute("data-c");
      var value = pick(content, path);
      if (value == null) continue;
      if (node.hasAttribute("data-c-html")) {
        if (node.hasAttribute("data-c-append-credits")) {
          var credits = document.getElementById("credits");
          node.innerHTML = value;
          var host = document.createElement("div");
          host.className = "credits";
          host.id = "credits";
          node.appendChild(host);
        } else {
          node.innerHTML = value;
        }
      } else if (node.tagName === "META") {
        node.setAttribute("content", value);
      } else {
        node.textContent = value;
      }
    }
  }

  function applyHero(content) {
    var hero = content.hero;
    if (!hero) return;
    var titleNode = document.getElementById("heroTitle");
    if (titleNode && hero.title != null) {
      titleNode.textContent = "";
      titleNode.appendChild(document.createTextNode(hero.title + " "));
      var em = document.createElement("em");
      em.textContent = hero.title_emphasis || "";
      titleNode.appendChild(em);
    }
    var bgImg = document.getElementById("heroBgImg");
    if (bgImg && hero.bg_image) {
      bgImg.setAttribute("src", hero.bg_image);
      bgImg.setAttribute("alt", hero.bg_alt || "");
    }
  }

  function applyNav(content) {
    var nav = document.getElementById("nav");
    if (!nav || !content.nav) return;
    nav.innerHTML = "";
    content.nav.forEach(function (item) {
      var section = content.sections && content.sections[item.id];
      if (section && section.visible === false) return;
      var a = document.createElement("a");
      a.setAttribute("href", "#" + item.id);
      a.textContent = item.label;
      nav.appendChild(a);
    });
  }

  function applyVisibility(content) {
    if (!content.sections) return;
    Object.keys(content.sections).forEach(function (id) {
      var visible = content.sections[id].visible;
      var el = document.getElementById(id);
      if (el) el.style.display = visible === false ? "none" : "";
    });
  }

  function applyTheme(content) {
    if (!content.theme) return;
    var existing = document.getElementById("nigc-content-theme");
    if (existing) existing.parentNode.removeChild(existing);
    var style = document.createElement("style");
    style.id = "nigc-content-theme";
    var css = "";
    ["dark", "light"].forEach(function (mode) {
      var vars = content.theme[mode];
      if (!vars) return;
      var selector = mode === "dark" ? ":root, :root[data-theme=\"dark\"]" : ":root[data-theme=\"light\"]";
      var body = Object.keys(vars).map(function (key) {
        return key + ": " + vars[key] + ";";
      }).join(" ");
      css += selector + " { " + body + " }\n";
    });
    style.textContent = css;
    document.head.appendChild(style);
  }

  function apply(content) {
    window.NIGC_CONTENT = content;
    applyTheme(content);
    applyText(content);
    applyHero(content);
    applyNav(content);
    applyVisibility(content);
    document.dispatchEvent(new CustomEvent("nigc-content-ready", { detail: content }));
  }

  function boot() {
    /* این اسکریپت پیش از data.js/app.js بارگذاری می‌شود، پس باید داده را
       به‌صورت همگام بگیرد تا محتوای صفحه پیش از رندر بخش‌های دیگر آماده باشد. */
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "content.json", false);
      xhr.send(null);
      if (xhr.status === 0 || xhr.status === 200) {
        apply(JSON.parse(xhr.responseText));
        return;
      }
    } catch (err) {
      if (window.console) console.warn("content.json failed to load", err);
    }
    window.NIGC_CONTENT = window.NIGC_CONTENT || {};
  }

  boot();
})();
