# KYC Verification API (FastAPI)

Asynchronous FastAPI backend for document verification, identity registry matching, and dashboard metrics.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Service health check |
| `POST` | `/api/v1/verify-document` | Multipart upload → preprocessing, OCR, forgery detection |
| `POST` | `/api/v1/validate-identity` | Compare OCR fields to mock core registry |
| `GET` | `/api/v1/dashboard-metrics` | Aggregate verified / flagged / pending counts |

## Prerequisites

- Python 3.11+
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) installed on the host
- Poppler (for PDF support): `brew install poppler` on macOS

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

## Example requests

### Verify document

```bash
curl -X POST "http://localhost:8000/api/v1/verify-document" \
  -H "accept: application/json" \
  -F "file=@/path/to/passport.jpg"
```

### Validate identity

```bash
curl -X POST "http://localhost:8000/api/v1/validate-identity" \
  -H "Content-Type: application/json" \
  -d '{"document_id":"P98421098","name":"Sarah Elizabeth Harrington","date_of_birth":"14 OCT 1992"}'
```

### Dashboard metrics

```bash
curl "http://localhost:8000/api/v1/dashboard-metrics"
```

## Mock registry IDs

- `P98421098` — Sarah Elizabeth Harrington
- `DL88210344` — Marcus Aurelius
- `99887766551` — Robert Johnson
- `P12345678` — Jane Doe
- `ABCPK1234F` — Rajesh Kumar Sharma (PAN)
- `DL88210344` — Marcus Aurelius (Driver's License)

## Project layout

```
backend/
├── app/
│   ├── api/routes/       # FastAPI routers
│   ├── core/             # Config & exceptions
│   ├── models/           # Pydantic schemas
│   ├── registry/         # Mock identity registry
│   └── services/         # Preprocessing, OCR, forgery, verification
├── requirements.txt
└── README.md
```
