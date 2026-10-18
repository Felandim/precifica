#!/usr/bin/env python3
"""Avisa o IndexNow (Bing, Yandex, etc.) de todas as URLs do sitemap do Precifica no Cloudflare Pages."""
import json, re, sys, urllib.request, urllib.error
BASE = "https://precifica-br.pages.dev"
KEY = "b194160086fe05ae546c3b59e0aecb88"
urls = re.findall(r"<loc>([^<]+)</loc>", open("/workspace/precifica/sitemap.xml", encoding="utf-8").read())
urls = [u for u in urls if u.startswith(BASE)]
with urllib.request.urlopen(urllib.request.Request(f"{BASE}/{KEY}.txt", headers={"User-Agent": "PrecificaIndexNow/1.0"}), timeout=20) as r:
    if r.read().decode().strip() != KEY:
        sys.exit("chave IndexNow no ar não confere")
body = json.dumps({"host": BASE.split("//")[1], "key": KEY, "keyLocation": f"{BASE}/{KEY}.txt", "urlList": urls}).encode()
for ep in ("https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"):
    req = urllib.request.Request(ep, data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(ep, r.status, len(urls), "URLs")
    except urllib.error.HTTPError as e:
        print(ep, "HTTP", e.code, e.read()[:200])
