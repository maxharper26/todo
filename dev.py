"""
Local dev server — mimics the Vercel API + serves the frontend.
Run: python dev.py
Then open: http://localhost:3000
"""
import json, os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

TASKS_FILE = Path(__file__).parent / 'tasks.json'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent / 'public'), **kwargs)

    def do_GET(self):
        if self.path == '/api/tasks':
            data = json.loads(TASKS_FILE.read_text()) if TASKS_FILE.exists() else {'tasks': []}
            self._json(200, data)
        else:
            # strip query string and serve static files
            self.path = self.path.split('?')[0] or '/'
            if self.path == '/': self.path = '/index.html'
            super().do_GET()

    def do_PUT(self):
        if self.path == '/api/tasks':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
            TASKS_FILE.write_text(json.dumps(body, indent=2))
            self._json(200, {'ok': True})

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def _json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, fmt, *args):
        print(f"  {self.address_string()} {fmt % args}")

if __name__ == '__main__':
    port = 3000
    print(f"Dev server running → http://localhost:{port}")
    print("Ctrl+C to stop\n")
    HTTPServer(('', port), Handler).serve_forever()
