'use strict';

(function () {

  var API_BASE = 'https://nigc-admin.ahantoday.workers.dev';
  var TOKEN_KEY = 'nigc_admin_token';

  var state = {
    token: null,
    content: null,
    rawData: null,
    activeTab: null
  };

  var els = {};

  function qs(id) { return document.getElementById(id); }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function setStatus(text, isError) {
    if (!els.statusMsg) return;
    els.statusMsg.textContent = text || '';
    els.statusMsg.style.color = isError ? 'var(--critical)' : 'var(--ink-2)';
  }

  function showLogin() {
    els.loginScreen.style.display = 'flex';
    els.appScreen.style.display = 'none';
  }

  function showApp() {
    els.loginScreen.style.display = 'none';
    els.appScreen.style.display = 'block';
  }

  function apiFetch(path, options) {
    options = options || {};
    var headers = options.headers || {};
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    if (options.body) headers['Content-Type'] = 'application/json';
    options.headers = headers;
    return fetch(API_BASE + path, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function init() {
    els.loginScreen = qs('loginScreen');
    els.appScreen = qs('appScreen');
    els.passwordInput = qs('passwordInput');
    els.loginBtn = qs('loginBtn');
    els.loginError = qs('loginError');
    els.statusMsg = qs('statusMsg');
    els.reloadBtn = qs('reloadBtn');
    els.saveBtn = qs('saveBtn');
    els.logoutBtn = qs('logoutBtn');
    els.tabButtons = qs('tabButtons');
    els.panels = qs('panels');

    els.loginBtn.addEventListener('click', doLogin);
    els.passwordInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doLogin();
    });
    els.reloadBtn.addEventListener('click', function () {
      if (window.confirm('بازخوانی از گیت‌هاب باعث از دست رفتن تغییرات ذخیره‌نشده می‌شود. ادامه می‌دهید؟')) {
        loadContent();
      }
    });
    els.saveBtn.addEventListener('click', saveContent);
    els.logoutBtn.addEventListener('click', doLogout);

    var existingToken = sessionStorage.getItem(TOKEN_KEY);
    if (existingToken) {
      state.token = existingToken;
      showApp();
      loadContent();
    } else {
      showLogin();
    }
  }

  ready(init);

  function doLogin() {
    var password = els.passwordInput.value || '';
    if (!password) return;
    els.loginBtn.disabled = true;
    els.loginError.textContent = '';
    apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password: password })
    }).then(function (res) {
      els.loginBtn.disabled = false;
      if (res.ok && res.data && res.data.token) {
        state.token = res.data.token;
        sessionStorage.setItem(TOKEN_KEY, state.token);
        els.passwordInput.value = '';
        showApp();
        loadContent();
      } else {
        els.loginError.textContent = 'رمز عبور نادرست است.';
      }
    }).catch(function (err) {
      // خطا را در کنسول هم می‌گذاریم؛ وگرنه ایرادِ شبکه/CORS از بیرون
      // از یک «رمز اشتباه» قابل تشخیص نیست.
      if (window.console) console.error('login failed:', err);
      els.loginBtn.disabled = false;
      els.loginError.textContent = 'خطا در برقراری ارتباط با سرور.';
    });
  }

  function doLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    state.token = null;
    state.content = null;
    state.rawData = null;
    showLogin();
  }

  function loadContent() {
    setStatus('در حال بارگذاری اطلاعات از گیت‌هاب...');
    els.saveBtn.disabled = true;
    els.reloadBtn.disabled = true;
    apiFetch('/api/content', { method: 'GET' }).then(function (res) {
      els.saveBtn.disabled = false;
      els.reloadBtn.disabled = false;
      if (res.status === 401) {
        doLogout();
        return;
      }
      if (!res.ok || !res.data || !res.data.content) {
        setStatus('خطا در بارگذاری اطلاعات: ' + (res.data && (res.data.error || res.data.detail) || 'نامشخص'), true);
        return;
      }
      state.content = res.data.content;
      state.rawData = res.data.raw_data;
      buildTabs();
      setStatus('اطلاعات با موفقیت بارگذاری شد.');
    }).catch(function () {
      els.saveBtn.disabled = false;
      els.reloadBtn.disabled = false;
      setStatus('خطا در برقراری ارتباط با سرور.', true);
    });
  }

  function saveContent() {
    if (!state.content || !state.rawData) return;
    try {
      collectAllPanels();
    } catch (e) {
      setStatus('خطا در خواندن مقادیر فرم: ' + e.message, true);
      return;
    }
    els.saveBtn.disabled = true;
    els.reloadBtn.disabled = true;
    setStatus('در حال ذخیره و انتشار...');
    apiFetch('/api/content', {
      method: 'POST',
      body: JSON.stringify({ content: state.content, raw_data: state.rawData })
    }).then(function (res) {
      els.saveBtn.disabled = false;
      els.reloadBtn.disabled = false;
      if (res.status === 401) {
        doLogout();
        return;
      }
      if (!res.ok || !res.data || res.data.ok !== true) {
        setStatus('خطا در ذخیره‌سازی: ' + (res.data && (res.data.error || res.data.detail) || 'نامشخص'), true);
        return;
      }
      setStatus('ذخیره شد. انتشار روی وب‌سایت تا ۱ دقیقهٔ دیگر تکمیل می‌شود.');
    }).catch(function () {
      els.saveBtn.disabled = false;
      els.reloadBtn.disabled = false;
      setStatus('خطا در برقراری ارتباط با سرور هنگام ذخیره.', true);
    });
  }
  function getByPath(root, path) {
    var parts = path.split('.');
    var cur = root;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setByPath(root, path, value) {
    var parts = path.split('.');
    var cur = root;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function readInputValue(el) {
    var type = el.getAttribute('data-type') || 'text';
    if (type === 'checkbox') return el.checked;
    if (type === 'number') {
      var raw = el.value;
      if (raw === '' || raw == null) return null;
      var num = parseFloat(raw);
      return isNaN(num) ? null : num;
    }
    return el.value;
  }

  function writeInputValue(el, value) {
    var type = el.getAttribute('data-type') || 'text';
    if (type === 'checkbox') {
      el.checked = !!value;
    } else if (type === 'number') {
      el.value = (value === null || value === undefined) ? '' : value;
    } else {
      el.value = (value === null || value === undefined) ? '' : value;
    }
  }

  function collectAllPanels() {
    var refRoots = { content: state.content, rawData: state.rawData };
    var els2 = els.panels.querySelectorAll('[data-bind]');
    for (var i = 0; i < els2.length; i++) {
      var el = els2[i];
      var path = el.getAttribute('data-bind');
      var dot = path.indexOf('.');
      var rootName = path.substring(0, dot);
      var subPath = path.substring(dot + 1);
      var root = refRoots[rootName];
      if (!root) continue;
      setByPath(root, subPath, readInputValue(el));
    }
  }

  function bindField(el, path, value) {
    el.setAttribute('data-bind', path);
    writeInputValue(el, value);
  }

  function makeTextField(labelText, path, value, multiline) {
    var wrap = document.createElement('div');
    wrap.className = 'field';
    var label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);
    var input = document.createElement(multiline ? 'textarea' : 'input');
    if (!multiline) input.type = 'text';
    input.setAttribute('data-type', 'text');
    bindField(input, path, value);
    wrap.appendChild(input);
    return wrap;
  }

  function makeNumberField(labelText, path, value) {
    var wrap = document.createElement('div');
    wrap.className = 'field';
    var label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);
    var input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.setAttribute('data-type', 'number');
    bindField(input, path, value);
    wrap.appendChild(input);
    return wrap;
  }

  function makeCheckboxField(labelText, path, value) {
    var wrap = document.createElement('div');
    wrap.className = 'field inline';
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('data-type', 'checkbox');
    bindField(input, path, value);
    var label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(input);
    wrap.appendChild(label);
    return wrap;
  }
  var SECTION_TITLES = {
    glance: 'یک نگاه', ladder: 'نردبان پله‌ها', flow: 'جریان مصرف', inequality: 'نابرابری',
    map: 'نقشهٔ کشور', matrix: 'ماتریس استان‌ها', climate: 'اقلیم و رفتار', season: 'دو فصل',
    explorer: 'کاوشگر استان', table: 'داده‌ها', downloads: 'دانلود', method: 'روش‌شناسی'
  };

  var FIELD_LABELS = {
    visible: 'نمایش این بخش', number: 'شمارهٔ بخش', title: 'عنوان', body: 'متن توضیحی',
    card1_title: 'عنوان کارت ۱', card1_sub: 'زیرعنوان کارت ۱',
    card2_title: 'عنوان کارت ۲', card2_sub: 'زیرعنوان کارت ۲',
    card3_title: 'عنوان کارت ۳', card3_sub: 'زیرعنوان کارت ۳',
    compare_title: 'عنوان مقایسه', compare_sub: 'زیرعنوان مقایسه',
    footnote: 'پانوشت', col1_html: 'ستون اول (HTML)', col2_html: 'ستون دوم (HTML)'
  };

  var LONG_TEXT_FIELDS = { body: 1, col1_html: 1, col2_html: 1, footnote: 1 };

  function buildTabs() {
    els.tabButtons.innerHTML = '';
    els.panels.innerHTML = '';
    var tabs = [
      { id: 'meta', label: 'متادیتا و سئو', build: buildMetaPanel },
      { id: 'hero', label: 'بخش قهرمان', build: buildHeroPanel },
      { id: 'nav', label: 'نوار بالا و بخش‌ها', build: buildNavPanel },
      { id: 'sections', label: 'متن بخش‌ها', build: buildSectionsPanel },
      { id: 'theme', label: 'رنگ‌ها (روشن/تیره)', build: buildThemePanel },
      { id: 'downloads', label: 'دانلودها', build: buildDownloadsPanel },
      { id: 'outputs', label: 'محتوای فایل‌های خروجی', build: buildOutputsPanel },
      { id: 'columns', label: 'ستون‌های جدول', build: buildColumnsPanel },
      { id: 'rawdata', label: 'داده‌های خام استان‌ها', build: buildRawDataPanel }
    ];

    tabs.forEach(function (tab, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = tab.label;
      btn.addEventListener('click', function () { activateTab(tab.id); });
      btn.setAttribute('data-tab-btn', tab.id);
      els.tabButtons.appendChild(btn);

      var panel = document.createElement('div');
      panel.className = 'panel';
      panel.setAttribute('data-panel', tab.id);
      els.panels.appendChild(panel);
      tab.build(panel);

      if (index === 0) {
        btn.classList.add('active');
        panel.classList.add('active');
        state.activeTab = tab.id;
      }
    });
  }

  function activateTab(id) {
    state.activeTab = id;
    var buttons = els.tabButtons.querySelectorAll('[data-tab-btn]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].getAttribute('data-tab-btn') === id);
    }
    var panels = els.panels.querySelectorAll('[data-panel]');
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.toggle('active', panels[j].getAttribute('data-panel') === id);
    }
  }
  var META_LABELS = {
    site_title: 'عنوان سایت (Tab Title)', site_description: 'توضیحات سئو',
    og_title: 'عنوان اشتراک‌گذاری (OG)', og_description: 'توضیح اشتراک‌گذاری (OG)',
    brand_title: 'عنوان برند (نوار بالا)', brand_subtitle: 'زیرعنوان برند',
    footer_line1: 'خط اول پاورقی', footer_line2: 'خط دوم پاورقی'
  };

  function buildMetaPanel(panel) {
    var card = document.createElement('div');
    card.className = 'card';
    var h3 = document.createElement('h3');
    h3.textContent = 'متادیتا و سئو';
    card.appendChild(h3);
    var meta = state.content.meta;
    Object.keys(META_LABELS).forEach(function (key) {
      var multiline = key === 'site_description' || key === 'og_description';
      card.appendChild(makeTextField(META_LABELS[key], 'content.meta.' + key, meta[key], multiline));
    });
    panel.appendChild(card);

    var rawMeta = state.rawData.meta || {};
    var card2 = document.createElement('div');
    card2.className = 'card';
    var h32 = document.createElement('h3');
    h32.textContent = 'متادیتای دادهٔ خام';
    card2.appendChild(h32);
    var rawLabels = {
      title: 'عنوان گزارش', source: 'منبع', report_date: 'تاریخ گزارش',
      extract_date: 'تاریخ استخراج', note_h1: 'توضیح نیمهٔ اول', note_h2: 'توضیح نیمهٔ دوم'
    };
    Object.keys(rawLabels).forEach(function (key) {
      card2.appendChild(makeTextField(rawLabels[key], 'rawData.meta.' + key, rawMeta[key], false));
    });
    panel.appendChild(card2);
  }

  var HERO_LABELS = {
    eyebrow: 'برچسب بالای عنوان', title: 'عنوان اصلی', title_emphasis: 'ادامهٔ عنوان (تأکیدی)',
    lead: 'متن مقدمه', meta_source: 'منبع (زیر عنوان)', meta_date: 'تاریخ گزارش (زیر عنوان)',
    meta_scope: 'دامنهٔ گزارش (زیر عنوان)', bg_image: 'مسیر تصویر پس‌زمینه', bg_alt: 'متن جایگزین تصویر'
  };

  function buildHeroPanel(panel) {
    var card = document.createElement('div');
    card.className = 'card';
    var h3 = document.createElement('h3');
    h3.textContent = 'بخش قهرمان (Hero)';
    card.appendChild(h3);
    var hero = state.content.hero;
    Object.keys(HERO_LABELS).forEach(function (key) {
      card.appendChild(makeTextField(HERO_LABELS[key], 'content.hero.' + key, hero[key], key === 'lead'));
    });
    panel.appendChild(card);
  }

  function buildNavPanel(panel) {
    var navCard = document.createElement('div');
    navCard.className = 'card';
    var h3 = document.createElement('h3');
    h3.textContent = 'برچسب‌های نوار بالا (Nav)';
    navCard.appendChild(h3);
    var hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'برچسب هر آیتم منو را می‌توانید تغییر دهید. برای حذف یک بخش از منو، آن را از تب «متن بخش‌ها» غیرفعال کنید.';
    navCard.appendChild(hint);
    state.content.nav.forEach(function (item, index) {
      navCard.appendChild(makeTextField(item.id, 'content.nav.' + index + '.label', item.label, false));
    });
    panel.appendChild(navCard);

    var visCard = document.createElement('div');
    visCard.className = 'card';
    var h32 = document.createElement('h3');
    h32.textContent = 'نمایش یا پنهان‌سازی بخش‌ها';
    visCard.appendChild(h32);
    var sections = state.content.sections;
    Object.keys(sections).forEach(function (sid) {
      var row = document.createElement('div');
      row.className = 'section-visible-row';
      var label = document.createElement('span');
      label.textContent = (sections[sid].number ? sections[sid].number + ' — ' : '') + (SECTION_TITLES[sid] || sid);
      row.appendChild(label);
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.setAttribute('data-type', 'checkbox');
      bindField(cb, 'content.sections.' + sid + '.visible', sections[sid].visible);
      row.appendChild(cb);
      visCard.appendChild(row);
    });
    panel.appendChild(visCard);
  }
  function buildSectionsPanel(panel) {
    var sections = state.content.sections;
    Object.keys(sections).forEach(function (sid) {
      var sec = sections[sid];
      var card = document.createElement('div');
      card.className = 'card';
      var h3 = document.createElement('h3');
      var tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = sid;
      h3.textContent = (sec.number ? sec.number + ' — ' : '') + (SECTION_TITLES[sid] || sid) + ' ';
      h3.appendChild(tag);
      card.appendChild(h3);
      Object.keys(sec).forEach(function (key) {
        if (key === 'visible' || key === 'number') return;
        var label = FIELD_LABELS[key] || key;
        var multiline = !!LONG_TEXT_FIELDS[key];
        card.appendChild(makeTextField(label, 'content.sections.' + sid + '.' + key, sec[key], multiline));
      });
      panel.appendChild(card);
    });
  }

  var THEME_VAR_LABELS = {
    '--plane': 'زمینهٔ کلی', '--surface-1': 'سطح ۱', '--surface-2': 'سطح ۲', '--surface-3': 'سطح ۳',
    '--border': 'حاشیه', '--border-str': 'حاشیهٔ پررنگ',
    '--ink': 'متن اصلی', '--ink-2': 'متن ثانویه', '--ink-muted': 'متن کم‌رنگ',
    '--grid': 'خطوط شبکهٔ نمودار', '--axis': 'محور نمودار',
    '--c-subs': 'رنگ مشترکین', '--c-gas': 'رنگ مصرف گاز', '--c-gas-lift': 'رنگ مصرف گاز (روشن‌تر)',
    '--g1': 'گروه ۱', '--g2': 'گروه ۲', '--g3': 'گروه ۳', '--g4': 'گروه ۴',
    '--s1': 'طیف ۱', '--s2': 'طیف ۲', '--s3': 'طیف ۳', '--s4': 'طیف ۴',
    '--s5': 'طیف ۵', '--s6': 'طیف ۶', '--s7': 'طیف ۷',
    '--d-neg-3': 'انحراف منفی ۳', '--d-neg-2': 'انحراف منفی ۲', '--d-neg-1': 'انحراف منفی ۱',
    '--d-mid': 'انحراف میانه', '--d-pos-1': 'انحراف مثبت ۱', '--d-pos-2': 'انحراف مثبت ۲', '--d-pos-3': 'انحراف مثبت ۳',
    '--ok': 'وضعیت خوب', '--warn': 'هشدار', '--serious': 'جدی', '--critical': 'بحرانی'
  };

  function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
  }

  function buildThemeModeFields(container, modeKey, modeObj) {
    var title = document.createElement('div');
    title.className = 'theme-mode-title';
    title.textContent = modeKey === 'dark' ? 'حالت تیره' : 'حالت روشن';
    container.appendChild(title);
    var grid = document.createElement('div');
    grid.className = 'grid3';
    Object.keys(modeObj).forEach(function (varName) {
      var value = modeObj[varName];
      var wrap = document.createElement('div');
      wrap.className = 'color-field';
      var nameEl = document.createElement('span');
      nameEl.className = 'var-name';
      nameEl.textContent = THEME_VAR_LABELS[varName] || varName;
      nameEl.title = varName;
      var textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.setAttribute('data-type', 'text');
      var path = 'content.theme.' + modeKey + '.' + varName;
      bindField(textInput, path, value);
      wrap.appendChild(nameEl);
      if (isHexColor(value)) {
        var colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = value;
        colorInput.addEventListener('input', function () {
          textInput.value = colorInput.value;
        });
        textInput.addEventListener('input', function () {
          if (isHexColor(textInput.value)) colorInput.value = textInput.value;
        });
        wrap.appendChild(colorInput);
      }
      wrap.appendChild(textInput);
      grid.appendChild(wrap);
    });
    container.appendChild(grid);
  }

  function buildThemePanel(panel) {
    var card = document.createElement('div');
    card.className = 'card';
    var h3 = document.createElement('h3');
    h3.textContent = 'رنگ‌های تم';
    card.appendChild(h3);
    var hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'برای اکثر متغیرها می‌توانید از انتخابگر رنگ استفاده کنید. مقادیر rgba باید به‌صورت متنی ویرایش شوند.';
    card.appendChild(hint);
    var theme = state.content.theme;
    buildThemeModeFields(card, 'dark', theme.dark);
    buildThemeModeFields(card, 'light', theme.light);
    panel.appendChild(card);
  }
  var DOWNLOAD_LABELS = {
    file: 'مسیر فایل', download_name: 'نام فایل هنگام دانلود (خالی = دانلود مستقیم)',
    title: 'عنوان', size: 'اندازه/توضیح کوتاه', description: 'توضیحات',
    icon: 'آیکون (pdf/ppt/xls/img/csv)', tone: 'رنگ (متغیر CSS مثل var(--ok))'
  };

  function buildDownloadsPanel(panel) {
    var card = document.createElement('div');
    card.className = 'card';
    var h3 = document.createElement('h3');
    h3.textContent = 'دانلودها';
    card.appendChild(h3);
    var list = document.createElement('div');
    card.appendChild(list);

    function render() {
      list.innerHTML = '';
      state.content.downloads.forEach(function (item, index) {
        var row = document.createElement('div');
        row.className = 'list-row';
        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'حذف ✕';
        removeBtn.addEventListener('click', function () {
          state.content.downloads.splice(index, 1);
          render();
        });
        row.appendChild(removeBtn);
        var grid = document.createElement('div');
        grid.className = 'grid2';
        Object.keys(DOWNLOAD_LABELS).forEach(function (key) {
          grid.appendChild(makeTextField(DOWNLOAD_LABELS[key], 'content.downloads.' + index + '.' + key, item[key], false));
        });
        row.appendChild(grid);
        list.appendChild(row);
      });
    }
    render();

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn add-row-btn';
    addBtn.textContent = '+ افزودن دانلود جدید';
    addBtn.addEventListener('click', function () {
      collectAllPanels();
      state.content.downloads.push({ file: '', download_name: '', title: '', size: '', description: '', icon: 'pdf', tone: 'var(--ok)' });
      render();
    });
    card.appendChild(addBtn);
    panel.appendChild(card);
  }

  /* ---------------- محتوای فایل‌های خروجی (PDF / پوستر / آفیس) --------------- */

  var OUTPUT_LABELS = {
    shared: {
      _title: 'هویت مشترک — در همهٔ خروجی‌ها می‌آید',
      org: 'نام سازمان',
      department: 'واحد سازمانی',
      period: 'دوره',
      report_date: 'تاریخ گزارش مبدأ',
      scope: 'دامنهٔ گزارش',
      source_note: 'توضیح منبع داده',
      footer: 'پاورقی'
    },
    report: {
      _title: 'گزارش PDF',
      title: 'عنوان جلد',
      title_emphasis: 'عنوان تأکیدشده (خط دوم)',
      lead: 'متن معرفی جلد',
      label_scope: 'برچسب «دامنه»',
      label_date: 'برچسب «تاریخ»',
      label_source: 'برچسب «منبع»',
      label_interactive: 'برچسب «نسخهٔ تعاملی»',
      value_interactive: 'مقدار «نسخهٔ تعاملی»',
      h_summary: 'عنوان: خلاصهٔ مدیریتی',
      h_method: 'عنوان: داده و روش',
      h_ladder: 'عنوان: نردبان پله‌ها',
      h_inequality: 'عنوان: نابرابری',
      h_map: 'عنوان: نقشه',
      h_climate: 'عنوان: اقلیم',
      h_season: 'عنوان: دو فصل',
      h_international: 'عنوان: تفسیر و مقایسه',
      h_conclusion: 'عنوان: راهکار و نتیجه‌گیری',
      h_province_table: 'عنوان: جدول استان‌ها',
      h_cons_table: 'عنوان: جدول مصرف',
      h_subs_table: 'عنوان: جدول مشترکین'
    },
    poster: {
      _title: 'پوستر',
      title: 'عنوان',
      title_emphasis: 'عنوان تأکیدشده',
      h_ladder: 'عنوان: نردبان پله‌ها',
      h_inequality: 'عنوان: نابرابری',
      h_map: 'عنوان: نقشه'
    }
  };

  var LONG_OUTPUT_FIELDS = { lead: 1, cover_note: 1, footer: 1 };

  function makeColorField(labelText, path, value) {
    var wrap = document.createElement('div');
    wrap.className = 'field';
    var label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);

    var row = document.createElement('div');
    row.className = 'color-field';
    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.setAttribute('data-type', 'text');
    bindField(textInput, path, value);
    if (isHexColor(value)) {
      var colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = value;
      colorInput.addEventListener('input', function () {
        textInput.value = colorInput.value;
      });
      textInput.addEventListener('input', function () {
        if (isHexColor(textInput.value)) colorInput.value = textInput.value;
      });
      row.appendChild(colorInput);
    }
    row.appendChild(textInput);
    wrap.appendChild(row);
    return wrap;
  }

  function buildOutputGroup(panel, groupKey, obj) {
    var labels = OUTPUT_LABELS[groupKey];
    var card = document.createElement('div');
    card.className = 'card';
    var h3 = document.createElement('h3');
    h3.textContent = labels._title;
    card.appendChild(h3);

    var grid = document.createElement('div');
    grid.className = 'grid2';
    Object.keys(labels).forEach(function (key) {
      if (key === '_title') return;
      var multiline = !!LONG_OUTPUT_FIELDS[key];
      var field = makeTextField(labels[key], 'content.outputs.' + groupKey + '.' + key,
                                obj[key], multiline);
      // متن‌های بلند تمام عرض کارت را بگیرند
      if (multiline) field.style.gridColumn = '1 / -1';
      grid.appendChild(field);
    });
    card.appendChild(grid);
    panel.appendChild(card);
  }

  function buildOutputsPanel(panel) {
    var outputs = state.content.outputs;
    if (!outputs) {
      var warn = document.createElement('div');
      warn.className = 'hint';
      warn.textContent = 'بلوک outputs در content.json نیست؛ چیزی برای ویرایش وجود ندارد.';
      panel.appendChild(warn);
      return;
    }

    var hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'این متن‌ها در گزارش PDF، پوستر، پاورپوینت و اکسل به کار '
      + 'می‌روند. بعد از ذخیره، فایل‌های دانلودی خودکار بازسازی می‌شوند '
      + '(چند دقیقه طول می‌کشد).';
    panel.appendChild(hint);

    ['shared', 'report', 'poster'].forEach(function (key) {
      if (outputs[key]) buildOutputGroup(panel, key, outputs[key]);
    });

    var office = outputs.office || {};

    if (office.pptx) {
      var pcard = document.createElement('div');
      pcard.className = 'card';
      var ph = document.createElement('h3');
      ph.textContent = 'پاورپوینت';
      pcard.appendChild(ph);
      var pgrid = document.createElement('div');
      pgrid.className = 'grid2';
      pgrid.appendChild(makeTextField('عنوان جلد', 'content.outputs.office.pptx.title',
                                      office.pptx.title));
      pgrid.appendChild(makeTextField('زیرعنوان جلد', 'content.outputs.office.pptx.subtitle',
                                      office.pptx.subtitle));
      pgrid.appendChild(makeColorField('رنگ تأکید', 'content.outputs.office.pptx.accent',
                                       office.pptx.accent));
      pcard.appendChild(pgrid);
      var note = makeTextField('توضیح جلد', 'content.outputs.office.pptx.cover_note',
                               office.pptx.cover_note, true);
      pcard.appendChild(note);
      pcard.appendChild(makeCheckboxField('اسلایدهای نمودار ساخته شوند',
                                          'content.outputs.office.pptx.include_charts',
                                          office.pptx.include_charts !== false));
      panel.appendChild(pcard);
    }

    if (office.xlsx) {
      var xcard = document.createElement('div');
      xcard.className = 'card';
      var xh = document.createElement('h3');
      xh.textContent = 'اکسل';
      xcard.appendChild(xh);
      var xgrid = document.createElement('div');
      xgrid.className = 'grid2';
      xgrid.appendChild(makeTextField('عنوان برگهٔ راهنما',
                                      'content.outputs.office.xlsx.title',
                                      office.xlsx.title));
      xgrid.appendChild(makeColorField('رنگ تأکید', 'content.outputs.office.xlsx.accent',
                                       office.xlsx.accent));
      xcard.appendChild(xgrid);
      panel.appendChild(xcard);
    }
  }

  function buildColumnsPanel(panel) {
    var card = document.createElement('div');
    card.className = 'card';
    var h3 = document.createElement('h3');
    h3.textContent = 'ستون‌های جدول';
    card.appendChild(h3);
    var hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'کلید (key) باید دقیقاً با ساختار دادهٔ محاسبه‌شده مطابقت داشته باشد؛ فقط برچسب و تعداد اعشار را تغییر دهید مگر مطمئن باشید.';
    card.appendChild(hint);
    var list = document.createElement('div');
    card.appendChild(list);

    function render() {
      list.innerHTML = '';
      state.content.table_columns.forEach(function (col, index) {
        var row = document.createElement('div');
        row.className = 'list-row';
        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'حذف ✕';
        removeBtn.addEventListener('click', function () {
          state.content.table_columns.splice(index, 1);
          render();
        });
        row.appendChild(removeBtn);
        var grid = document.createElement('div');
        grid.className = 'grid3';
        grid.appendChild(makeTextField('کلید (key)', 'content.table_columns.' + index + '.key', col.key, false));
        grid.appendChild(makeTextField('برچسب', 'content.table_columns.' + index + '.label', col.label, false));
        grid.appendChild(makeNumberField('تعداد اعشار', 'content.table_columns.' + index + '.decimals', col.decimals));
        row.appendChild(grid);
        list.appendChild(row);
      });
    }
    render();

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn add-row-btn';
    addBtn.textContent = '+ افزودن ستون جدید';
    addBtn.addEventListener('click', function () {
      collectAllPanels();
      state.content.table_columns.push({ key: '', label: '', decimals: 1 });
      render();
    });
    card.appendChild(addBtn);
    panel.appendChild(card);
  }
  function buildRawDataPanel(panel) {
    var card = document.createElement('div');
    card.className = 'card';
    var h3 = document.createElement('h3');
    h3.textContent = 'داده‌های خام استان‌ها';
    card.appendChild(h3);
    var note = document.createElement('div');
    note.className = 'datagrid-note';
    note.textContent = 'واحدها به درصد هستند مگر «دما» (سانتی‌گراد) و «عرض/طول جغرافیایی». نام استان‌ها قابل ویرایش نیست چون با نقشه و ترتیب استان‌ها مرتبط است.';
    card.appendChild(note);

    var wrap = document.createElement('div');
    wrap.className = 'datagrid-wrap';
    var table = document.createElement('table');
    table.className = 'datagrid';
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');

    function addHeaderCell(text) {
      var th = document.createElement('th');
      th.textContent = text;
      headRow.appendChild(th);
    }
    addHeaderCell('استان');
    for (var i = 1; i <= 12; i++) addHeaderCell('مصرف پ' + i + ' (سرد)');
    for (var i2 = 1; i2 <= 12; i2++) addHeaderCell('مشترک پ' + i2 + ' (سرد)');
    for (var i3 = 1; i3 <= 4; i3++) addHeaderCell('مصرف پ' + i3 + ' (گرم)');
    for (var i4 = 1; i4 <= 4; i4++) addHeaderCell('مشترک پ' + i4 + ' (گرم)');
    addHeaderCell('دما');
    addHeaderCell('عرض جغرافیایی');
    addHeaderCell('طول جغرافیایی');
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    var rows = state.rawData.rows;
    var order = state.rawData.provinces_order || Object.keys(rows).filter(function (name) { return name !== state.rawData.national_key; });
    var nationalKey = state.rawData.national_key;
    var allNames = order.concat(nationalKey && rows[nationalKey] ? [nationalKey] : []);

    allNames.forEach(function (name) {
      var rowData = rows[name];
      if (!rowData) return;
      var tr = document.createElement('tr');
      var nameTd = document.createElement('td');
      nameTd.textContent = name;
      tr.appendChild(nameTd);

      function addNumberCell(path, value) {
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.setAttribute('data-type', 'number');
        bindField(input, path, value);
        td.appendChild(input);
        tr.appendChild(td);
      }

      var basePath = 'rawData.rows.' + name;
      rowData.h1_cons.forEach(function (v, idx) { addNumberCell(basePath + '.h1_cons.' + idx, v); });
      rowData.h1_count.forEach(function (v, idx) { addNumberCell(basePath + '.h1_count.' + idx, v); });
      rowData.h2_cons.forEach(function (v, idx) { addNumberCell(basePath + '.h2_cons.' + idx, v); });
      rowData.h2_count.forEach(function (v, idx) { addNumberCell(basePath + '.h2_count.' + idx, v); });
      addNumberCell(basePath + '.temp', rowData.temp);
      addNumberCell(basePath + '.lat', rowData.lat);
      addNumberCell(basePath + '.lon', rowData.lon);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    card.appendChild(wrap);
    panel.appendChild(card);
  }

})();
