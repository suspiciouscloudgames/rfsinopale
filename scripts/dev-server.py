#!/usr/bin/env python3
"""Local screening/tablet servers with byte ranges for browser video seeking."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
import re
ROOT = Path(__file__).resolve().parents[1]
class MediaHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def send_head(self):
        self.byte_range = None
        path = Path(self.translate_path(self.path))
        header = self.headers.get('Range')
        if not header or not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', header.strip())
        if not match or not size or not any(match.groups()):
            self.send_error(416); return None
        first, last = match.groups()
        start = int(first) if first else max(0, size-int(last))
        end = min(int(last),size-1) if first and last else size-1
        if start >= size or end < start:
            self.send_response(416); self.send_header('Content-Range',f'bytes */{size}'); self.end_headers(); return None
        stream = path.open('rb'); stream.seek(start)
        self.byte_range = end-start+1
        self.send_response(206)
        self.send_header('Content-type', self.guess_type(str(path)))
        self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length',str(self.byte_range))
        self.end_headers()
        return stream
    def copyfile(self, source, outputfile):
        try:
            if self.byte_range is None: return super().copyfile(source,outputfile)
            remaining=self.byte_range
            while remaining:
                data=source.read(min(65536,remaining))
                if not data: break
                outputfile.write(data); remaining-=len(data)
        except (BrokenPipeError,ConnectionResetError): pass
class Screening(MediaHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def do_GET(self):
        if not self.path.startswith('/rfsinopale/'):
            self.send_error(404);return
        self.path=self.path[len('/rfsinopale'):];super().do_GET()
    def do_HEAD(self):
        if not self.path.startswith('/rfsinopale/'):
            self.send_error(404);return
        self.path=self.path[len('/rfsinopale'):];super().do_HEAD()
class Tablet(MediaHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT.parent/'gamepoem'),**kw)
if __name__=='__main__':
    screen=ThreadingHTTPServer(('127.0.0.1',5189),Screening)
    tablet=ThreadingHTTPServer(('127.0.0.1',5190),Tablet)
    Thread(target=tablet.serve_forever,daemon=True).start()
    print('Screening: http://127.0.0.1:5189/rfsinopale/video/\nSettings: http://127.0.0.1:5189/rfsinopale/video/settings.html\nTablet: http://127.0.0.1:5190/?room=sinopale',flush=True)
    try: screen.serve_forever()
    except KeyboardInterrupt:pass
    finally:screen.server_close();tablet.shutdown();tablet.server_close()
