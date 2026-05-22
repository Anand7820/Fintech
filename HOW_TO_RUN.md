# How to Run the KYC Verification Project

This project consists of a **Frontend** (Next.js) and a **Backend** (FastAPI). You will need to open **two separate terminal windows** to run both servers simultaneously.

---

## 1. Starting the Backend API

Open your first terminal window and run the following commands:

```bash
# Navigate to the backend directory
cd /Users/anandkamble/Desktop/KYC/backend

# Activate the virtual environment
source .venv/bin/activate

# Start the FastAPI server
./run.sh
```

*(Note: `run.sh` will start the server on port 8000. If you get an **"Address already in use"** error, see the troubleshooting section below.)*

---

## 2. Starting the Frontend Dashboard

Open your second terminal window and run the following commands:

```bash
# Navigate to the root KYC directory
cd /Users/anandkamble/Desktop/KYC

# Install dependencies (only needed once)
npm install

# Start the Next.js development server
npm run dev
```

After running this, open your web browser and go to: **[http://127.0.0.1:3000](http://127.0.0.1:3000)**

---

## Troubleshooting

### "Address already in use" error on the backend (Port 8000 is blocked)

If you see an `[Errno 48] Address already in use` error when running the backend, it means another process is using port 8000. You have two options:

**Option 1: Run the backend on a different port (e.g., 8001)**
```bash
# Make sure you are in the backend folder and the virtual environment is activated
export PYTHONPATH=.
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

**Option 2: Kill the process that is blocking port 8000**
Find the process ID (PID) using the port:
```bash
lsof -i :8000
```
Then kill it using the PID shown in the output:
```bash
kill -9 <PID>
```
Then try running `./run.sh` again.

---

### "Tesseract not found" or OCR errors
The backend uses Tesseract to extract text from documents. If you get an error regarding missing OCR dependencies, make sure you install them via Homebrew:
```bash
brew install tesseract poppler
```
