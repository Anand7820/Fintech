# KYC Secure

Document verification dashboard (Next.js) + ML verification API (FastAPI).

## Quick start

### Terminal 1 — Backend (port 8000)

```bash
brew install tesseract poppler   # once
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

### Terminal 2 — Frontend (port 3000)

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3000

- **Preset scenarios** (Passport / License / Bill) run as interactive demos.
- **File upload** calls the real API at http://127.0.0.1:8000.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `address already in use` on 8000 | `lsof -i :8000` then `kill <PID>` |
| `uv_interface_addresses` error on `npm run dev` | Use `npm run dev` (binds to `127.0.0.1`) |
| API shows OFFLINE | Start backend: `cd backend && ./run.sh` |
| OCR / verify fails | Install Tesseract: `brew install tesseract` |

## API docs

http://127.0.0.1:8000/docs
