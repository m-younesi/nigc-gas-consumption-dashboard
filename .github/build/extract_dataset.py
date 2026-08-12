# -*- coding: utf-8 -*-
"""
dataset.json را از assets/js/data.js بیرون می‌کشد.

data.js با «window.NIGC = <همان محتوای dataset.json>;» شروع می‌شود، پس
لازم نیست analytics.py را دوباره اجرا کنیم — که جدول‌های خام منبع را
می‌خواهد و آن‌ها در مخزن نیستند. پنل مدیریت هم data.js را به‌روز
می‌کند، پس این تنها منبعی است که همیشه تازه است.

استفاده: python extract_dataset.py <data.js> <dataset.json>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

PREFIX = "window.NIGC = "


def extract(js_text):
    start = js_text.find(PREFIX)
    if start == -1:
        raise SystemExit("در data.js عبارت «window.NIGC = » پیدا نشد")
    start += len(PREFIX)

    # تا انتهای همین انتساب جلو می‌رویم. نمی‌شود به اولین «;\n» تکیه کرد،
    # چون داخل رشته‌های فارسی هم ممکن است بیاید؛ پس آکولادها را می‌شماریم
    # و رشته‌ها و کاراکترهای escape را رد می‌کنیم.
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(js_text)):
        ch = js_text[i]
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if in_str:
            if ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return js_text[start:i + 1]
    raise SystemExit("انتهای شیء window.NIGC پیدا نشد")


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    src = Path(sys.argv[1])
    dest = Path(sys.argv[2])

    raw = extract(src.read_text(encoding="utf-8"))
    data = json.loads(raw)  # اگر ناقص برداشته باشیم، همین‌جا می‌ترکد

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(data, ensure_ascii=False, indent=2),
                    encoding="utf-8")
    print("%s  (%d استان، %.0f KB)" % (
        dest, len(data.get("provinces", []) or []),
        dest.stat().st_size / 1024))


if __name__ == "__main__":
    main()
