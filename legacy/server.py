"""
DEEN Commerce - Local Dashboard Server
Serves the web application at http://localhost:8085 and opens the browser automatically.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8085
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def run():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print(f"\n" + "=" * 60)
        print(f"DEEN Commerce: Net Sales & Return Reconciliation Suite")
        print(f"Dashboard running at: {url}")
        print(f"Press Ctrl+C to stop the server.")
        print("=" * 60 + "\n")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    run()
