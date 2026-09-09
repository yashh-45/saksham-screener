# Saksham (सक्षम) — AI Handwriting Screener for Early Learning-Difficulty Detection

> **A 15-minute, no-specialist-required classroom screening tool that empowers teachers to identify early visual indicators of dyslexia and generate plain-language referral reports.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/ML-PyTorch%20MobileNetV2-EE4C2C?style=flat&logo=pytorch)](https://pytorch.org/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Validation](https://img.shields.io/badge/Held--Out%20Accuracy-77.06%25-brightgreen)](#-honest-validation--model-performance-4)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📌 Executive Summary

* **The Problem:** In India, an estimated **1 in 10 school children** displays signs of a learning difficulty such as dyslexia. Yet, over 90% of schools have zero access to a full-time school psychologist. Struggling students are often mislabeled as "slow" or "inattentive" for years before any intervention occurs.
* **The Solution:** Saksham allows a classroom educator to photograph or scan a student's handwriting sample, analyze it through a fine-tuned computer vision classifier in seconds, and export a clear, non-alarming 1-page PDF recommendation report.
* **Critical Design Constraint:** **Saksham is an early screening aid, NOT a clinical diagnostic instrument.** It identifies visual patterns (letter reversals, baseline irregularities, over-correction) to support timely referral to certified educational psychologists.

---

## 🎯 What Makes Saksham Stand Out to Judges

1. **Honest, Unfluffed Validation (§4):** Rather than advertising exaggerated "99% AI accuracy", Saksham measures and proudly surfaces its **77.06% concordance on strictly held-out test data** (never seen during training).
2. **Zero-Friction Teacher UX:** Non-technical teachers can complete a screening in **under 60 seconds** per student, with 1-click sample presets for immediate testing.
3. **Clinical-Grade Ethics:** Language across the UI, API, and PDF is warm, objective, and strictly non-diagnostic (*"1 of 2 indicators present — recommend professional evaluation"*).
4. **Dual-Mode Persistence:** Runs instantly with local SQLite storage (`saksham.db`) without requiring API keys, while fully wired for cloud scale with Supabase Postgres.
5. **Clear Business & Sustainability Plan (§6):** Free tier for government schools backed by CSR/NGO partners; freemium tier for private school chains.

---

## 📊 Honest Validation & Model Performance (§4)

The model backbone is a **MobileNetV2** convolutional neural network fine-tuned with dropout regularization on the **Gambo Dyslexia Handwriting Dataset**.

* **Training Set:** 6,000 stratified samples (2,000 per class)
* **Held-Out Test Set:** 1,800 stratified samples (600 per class — strictly unseen)
* **Training Epochs:** 13 (Early stopping triggered when validation loss plateaued)

### Held-Out Evaluation Results

$$\text{Overall Held-Out Test Accuracy} = \mathbf{77.06\%}$$

| Handwriting Class | Precision | Recall | F1-Score | Held-Out Test Support | Target Indicator |
|---|:---:|:---:|:---:|:---:|---|
| **Corrected** | **98.0%** | 81.3% | **0.89** | 600 | Over-correction, heavy stroke rewrites |
| **Normal** | **62.2%** | 96.7% | **0.76** | 600 | Standard baseline, typical orientation |
| **Reversal** | **86.2%** | 53.2% | **0.66** | 600 | Letter reversals ($b/d$, $p/q$ orientation) |

*(Validation curves and per-class metrics are rendered directly in the dashboard's "Model Transparency" tab).*

---

## 🏗️ Architecture & Data Flow

```
+------------------------+
| Classroom Teacher      |
| Uploads Handwriting    |
+-----------+------------+
            |
            v
+------------------------+      +---------------------------+
| React 19 Dashboard     | ---> | FastAPI Backend Service   |
| (Vite Dev Server :5173)| <--- | (Uvicorn REST API :8000)  |
+------------------------+      +-------------+-------------+
                                              |
                        +---------------------+---------------------+
                        |                                           |
                        v                                           v
         +-----------------------------+             +-----------------------------+
         | PyTorch Inference Engine    |             | Dual Database Layer         |
         | MobileNetV2 (77.1% Val Acc) |             | SQLite / Supabase Postgres  |
         +--------------+--------------+             +--------------+--------------+
                        |                                           |
                        +---------------------+---------------------+
                                              |
                                              v
                               +-----------------------------+
                               | ReportLab PDF Generator     |
                               | (Plain-language 1-page PDF) |
                               +-----------------------------+
```

---

## ⚡ Quickstart Guide (Run in 2 Minutes)

### Prerequisites
* Python 3.10+
* Node.js 18+

### 1. Start the Backend API
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
*API will run at `http://127.0.0.1:8000` (Swagger docs available at `http://127.0.0.1:8000/docs`).*

### 2. Start the Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
*Frontend will run at `http://127.0.0.1:5173`.*

---

## 🧪 1-Minute Demo Walkthrough for Judges

1. **Open Dashboard:** Navigate to `http://127.0.0.1:5173`.
2. **Select Student:** Default demo student **"Aarav Sharma (Class 3-B)"** is pre-loaded (or click `+ New Student`).
3. **One-Click Sample Test:** Click any of the 3 dataset presets:
   * `✓ Typical Writing` $\rightarrow$ Evaluates normal baseline flow.
   * `⚡ Reversal Pattern` $\rightarrow$ Flags letter orientation anomalies.
   * `✍ Over-Correction` $\rightarrow$ Flags heavy rewrite patterns.
4. **Run Analysis:** Click **"Run Screening Analysis"** $\rightarrow$ Instant indicator breakdown with confidence score.
5. **Download Report:** Click **"Download Plain-Language PDF Report"** $\rightarrow$ High-quality, one-page printable referral document for parents and counsellors.
6. **Show Transparency:** Switch to **"Model Transparency"** tab $\rightarrow$ Show the real held-out 77.06% accuracy and training curves.

---

## 🔍 Known Limitations (§5) & Future Work

* **Language Scope:** Current MVP is trained and validated on English-medium handwriting.
* **Future Work:** Fine-tuning on regional Indian scripts (Devanagari/Hindi, Tamil, Marathi) using expanded state board datasets.
* **Tool Boundary:** Non-diagnostic; intended solely to bridge the gap between classroom observation and professional psycho-educational evaluation.

---

## 💼 Sustainability & Business Model (§6)

* **Public Schools (Government/Municipal):** **100% Free**, funded through Corporate Social Responsibility (CSR) education mandates and philanthropic foundations (e.g., Azim Premji Foundation, Pratham).
* **Private Schools & District Networks:** **Freemium Model** — Free basic screening up to 25 students/month per educator; tiered SaaS subscription for district-wide aggregate dashboards, batch processing, and longitudinal student cohort tracking.

---

## 📁 Repository Directory Structure

```
paper/
├── Saksham_Antigravity_Project_Brief.md   # Project technical requirements
├── README.md                             # Project overview & pitch guide
├── train_model.py                        # Reproducible model training script
├── backend/
│   ├── main.py                           # FastAPI application entry point
│   ├── requirements.txt                  # Python dependencies
│   ├── supabase_schema.sql               # Cloud Postgres schema
│   ├── .env                              # Environment configuration
│   └── app/
│       ├── config.py                     # Configuration loader
│       ├── routers/                      # REST endpoints (students, scans, model)
│       └── services/                     # Model inference, SQLite/Supabase DB, ReportLab PDF
├── frontend/
│   ├── package.json                      # React dependencies
│   ├── vite.config.js                    # Dev server & API proxy
│   ├── public/samples/                   # One-click demo test images
│   └── src/
│       ├── App.jsx                       # Main dashboard interface
│       └── index.css                     # Design system & responsive layout
└── model_output/
    ├── saksham_model.pth                 # Saved weights (10.45 MB)
    ├── model_metadata.json               # Measured validation metrics
    └── training_curves.png               # Loss & accuracy curves
```
