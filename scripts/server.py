#!/usr/bin/env python3
"""Flertrådet lokal server for utvikling og verifisering.

python3 -m http.server er enkeltrådet. Når flere verifiseringsskript (eller
flere agenter) treffer den samtidig, blir forespørsler avvist og headless
Chrome viser en feilside i stedet for appen. Denne håndterer parallelle
forespørsler.

    python3 scripts/server.py [port]
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8721


class Stille(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


if __name__ == "__main__":
    handler = partial(Stille, directory=str(ROT))
    with ThreadingHTTPServer(("127.0.0.1", PORT), handler) as s:
        print(f"tjener {ROT} på http://localhost:{PORT}", flush=True)
        s.serve_forever()
