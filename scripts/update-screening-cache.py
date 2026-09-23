#!/usr/bin/env python3
"""Refresh generated Workbox precache entries after editing static screening files."""
from pathlib import Path
import hashlib,re,json
root=Path(__file__).resolve().parents[1]
p=root/'sw.js';source=p.read_text()
manifest=re.search(r's\.precacheAndRoute\((\[.*?\]),',source).group(1)
try: entries=json.loads(manifest)
except json.JSONDecodeError:
    entries=[{'url':url,'revision':None if revision=='null' else revision.strip('"')} for url,revision in re.findall(r'\{url:"([^"]+)",revision:(null|"[^"]+")\}',manifest)]
entries=[entry for entry in entries if not entry['url'].startswith('video/')]
for path in sorted((root/'video').rglob('*')):
    if path.suffix not in ['.js','.css','.html']:continue
    entries.append({'url':path.relative_to(root).as_posix(),'revision':hashlib.md5(path.read_bytes()).hexdigest()})
for entry in entries:
    path=root/entry['url']
    if entry['revision'] is not None and path.exists():entry['revision']=hashlib.md5(path.read_bytes()).hexdigest()
encoded=json.dumps(entries,separators=(',',':'))
source=re.sub(r's\.precacheAndRoute\(\[.*?\],\{.*?\}\)',lambda _:f's.precacheAndRoute({encoded},{{ignoreURLParametersMatching:[/^utm_/,/^fbclid$/,/^v$/]}})',source,count=1)
p.write_text(source)
print(f'Updated {len(entries)} precache entries. settings.json and large media stay network-loaded.')
