# KYC SECURE V1.2

Real-time Intelligent Document Auditing Platform.

This project consists of a Next.js frontend for the KYC dashboard and a FastAPI backend with Tesseract OCR for document processing and verification.

## Prerequisites

- Node.js (v18 or higher)
- Python (v3.9 or higher)
- Tesseract OCR (`brew install tesseract`)
- Poppler (`brew install poppler` for `pdftoppm`)

## Project Structure

- `src/`: Next.js frontend code
- `backend/`: FastAPI Python backend code

## How to Run

### 1. Start the Backend

The backend runs on port 8000 and is responsible for OCR and document verification.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the Frontend

The frontend runs on port 3000. It expects the backend to be available at `http://localhost:8000`.

```bash
# In a new terminal window
cd /path/to/KYC
npm install
npm run dev
```

### 3. Usage

1. Open your browser and navigate to `http://localhost:3000`.
2. Wait for the API status to show **CONNECTED**.
3. You can either use the interactive template buttons to run preset scenarios (Passport, License, Utility Bill), or upload a custom image/PDF for verification.

## Architecture

- **Frontend**: Next.js App Router, React Hooks, Tailwind CSS, Lucide React icons.
- **Backend**: FastAPI, Tesseract OCR, PyMuPDF, OpenCV.

## Features

- Real-time processing logs.
- Automatic document field extraction (Name, DOB, Document ID, etc.).
- Image pre-processing (deskew, binarization).
- Forgery risk scoring based on structural integrity.
- Biometric verification simulation.
