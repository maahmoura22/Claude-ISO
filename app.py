import os
from flask import Flask, Response

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_FILE = os.path.join(BASE_DIR, "iso-tolerancias.html")

@app.route("/")
def index():
    with open(HTML_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    return Response(content, mimetype="text/html")

@app.route("/health")
def health():
    return "ok", 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
