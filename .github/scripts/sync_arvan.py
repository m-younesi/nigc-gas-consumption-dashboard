"""
آینه‌کردن مخزن روی باکت آبجکت‌استوریج ابر آروان.

فقط فایل‌های تغییرکرده را می‌فرستد (مقایسهٔ MD5 با ETag) و فایل‌هایی را
که از مخزن حذف شده‌اند از باکت هم پاک می‌کند، تا باکت دقیقاً آینهٔ
شاخهٔ main باشد.

متغیرهای محیطی لازم:
  ARVAN_S3_ACCESS_KEY, ARVAN_S3_SECRET_KEY
  ARVAN_BUCKET (پیش‌فرض nigc-dashboard)
  ARVAN_REGION (پیش‌فرض ir-thr-at1)
"""
import concurrent.futures as cf
import hashlib
import mimetypes
import os
import sys

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                     "..", ".."))

# ویندوز و لینوکس برای چند پسوند نوع متفاوت (یا هیچ) می‌دهند؛ صریح می‌نویسیم
# تا فایل CSS به‌عنوان text/plain سرو نشود و مرورگر نادیده‌اش نگیرد.
EXTRA_TYPES = {
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".csv": "text/csv; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument."
             "presentationml.presentation",
    ".pdf": "application/pdf",
}

# اینها به باکت نمی‌روند: یا مال گیت‌اند یا مال ساخت
SKIP_DIRS = {".git", ".github", "node_modules"}


def content_type(key):
    ext = os.path.splitext(key)[1].lower()
    if ext in EXTRA_TYPES:
        return EXTRA_TYPES[ext]
    return mimetypes.guess_type(key)[0] or "application/octet-stream"


def cache_control(key):
    # HTML و JSON کوتاه کش می‌شوند تا ویرایش‌های پنل مدیریت زود دیده شود؛
    # فونت و تصویر که عوض نمی‌شوند، طولانی.
    ext = os.path.splitext(key)[1].lower()
    if ext in (".html", ".json"):
        return "public, max-age=60, must-revalidate"
    if ext in (".woff2", ".jpg", ".jpeg", ".png", ".svg", ".pdf", ".xlsx",
               ".pptx", ".csv"):
        return "public, max-age=604800"
    return "public, max-age=3600"


def md5_of(path):
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def local_files():
    out = {}
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            key = os.path.relpath(full, ROOT).replace(os.sep, "/")
            out[key] = full
    return out


def remote_objects(s3, bucket):
    out = {}
    token = None
    while True:
        kw = {"Bucket": bucket, "MaxKeys": 1000}
        if token:
            kw["ContinuationToken"] = token
        r = s3.list_objects_v2(**kw)
        for o in r.get("Contents", []):
            out[o["Key"]] = o.get("ETag", "").strip('"')
        if not r.get("IsTruncated"):
            break
        token = r.get("NextContinuationToken")
    return out


def main():
    ak = os.environ.get("ARVAN_S3_ACCESS_KEY", "")
    sk = os.environ.get("ARVAN_S3_SECRET_KEY", "")
    bucket = os.environ.get("ARVAN_BUCKET", "nigc-dashboard")
    region = os.environ.get("ARVAN_REGION", "ir-thr-at1")
    if not ak or not sk:
        print("::error::ARVAN_S3_ACCESS_KEY / ARVAN_S3_SECRET_KEY تعریف نشده‌اند")
        sys.exit(1)

    endpoint = "https://s3.%s.arvanstorage.ir" % region
    s3 = boto3.client(
        "s3", endpoint_url=endpoint,
        aws_access_key_id=ak, aws_secret_access_key=sk,
        config=Config(signature_version="s3v4", retries={"max_attempts": 3},
                      connect_timeout=20, read_timeout=120),
    )

    local = local_files()
    remote = remote_objects(s3, bucket)
    print("local objects : %d" % len(local))
    print("remote objects: %d" % len(remote))

    to_put = []
    for key, full in sorted(local.items()):
        etag = remote.get(key)
        # ETag برای آپلود تک‌تکه همان MD5 است؛ اگر چندتکه بود «-» دارد
        # و آن‌وقت مقایسه بی‌معنی است، پس محتاطانه دوباره می‌فرستیم.
        if etag and "-" not in etag and etag == md5_of(full):
            continue
        to_put.append((key, full))

    to_delete = sorted(set(remote) - set(local))

    print("to upload     : %d" % len(to_put))
    print("to delete     : %d" % len(to_delete))

    failures = []

    def put(item):
        key, full = item
        try:
            with open(full, "rb") as fh:
                s3.put_object(Bucket=bucket, Key=key, Body=fh.read(),
                              ACL="public-read", ContentType=content_type(key),
                              CacheControl=cache_control(key))
            return (key, None)
        except Exception as e:  # noqa: BLE001
            return (key, str(e)[:160])

    if to_put:
        with cf.ThreadPoolExecutor(max_workers=6) as ex:
            for key, err in ex.map(put, to_put):
                if err:
                    failures.append((key, err))
                    print("  FAIL upload %s: %s" % (key, err))
                else:
                    print("  put    %s" % key)

    for key in to_delete:
        try:
            s3.delete_object(Bucket=bucket, Key=key)
            print("  delete %s" % key)
        except ClientError as e:
            failures.append((key, str(e)[:160]))
            print("  FAIL delete %s: %s" % (key, e))

    if not to_put and not to_delete:
        print("باکت از قبل به‌روز است؛ کاری لازم نبود.")

    if failures:
        print("::error::%d عملیات ناموفق بود" % len(failures))
        sys.exit(1)

    print("\nsynced -> http://%s.s3-website.%s.arvanstorage.ir" % (bucket, region))


if __name__ == "__main__":
    main()
