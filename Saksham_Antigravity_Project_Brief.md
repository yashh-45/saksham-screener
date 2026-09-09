# Saksham — AI Handwriting Screener for Early Learning-Difficulty Detection

## Project Brief for Development (Antigravity / Agentic Coding Session)

---

## 1. One-line description

Saksham is a web tool that lets a classroom teacher upload a short handwriting sample from a student, runs it through a fine-tuned image classifier to detect known visual indicators of dyslexia (letter reversals, irregular spacing, baseline drift), and generates a plain-language PDF report recommending — never diagnosing — a professional evaluation when indicators are present.

## 2. Problem this solves

An estimated 1 in 10 Indian schoolchildren shows signs of a learning difficulty like dyslexia, but most schools (government and private) have no school psychologist and no screening process. Struggling students are often mislabeled "slow" or "lazy" for years before anyone investigates the real cause. Saksham gives any teacher a 15-minute, no-specialist-required way to flag a student early and route them to proper help.

## 3. Critical constraint — read this before building anything

**This is a screening tool, not a diagnostic tool.** Every output, UI label, and report must say things like "N of 5 common indicators present — recommend professional evaluation," never "this student has dyslexia" or any definitive clinical claim. Do not build or word anything that implies a medical diagnosis. This constraint applies to model outputs, UI copy, PDF report language, and API response fields.

## 4. Honest validation requirement — non-negotiable

The model's real, measured performance must be tracked and surfaced, not assumed or glossed over:
- Hold out a proper test split before training (never validate on data the model has seen)
- Compute and record actual accuracy, precision/recall (or sensitivity/specificity) on that held-out set
- Surface this number in the dashboard/report footer and in any pitch material — e.g. "72% concordance with labeled indicators on held-out data — a first-pass signal, not a clinical measure"
- If the number is mediocre, say so plainly. A modest, honestly-reported number is a stronger deliverable than an unverified claim of "AI-powered accuracy" — judges and real users trust the former and distrust the latter
- Never report training accuracy as if it were validation accuracy — this is a common and serious mistake to avoid

## 5. Known limitations to state explicitly, not hide

Handwriting varies by age, board/curriculum, language exposure, and even the writing instrument used. Don't let the pitch or the product imply broader coverage than what was actually tested:
- State clearly (in the UI "About" section, README, and any pitch material): *"This MVP is trained and validated on English-medium handwriting samples from [dataset's actual age/grade range]. Performance on other boards, regional languages, or age groups outside this range has not been validated."*
- Treat cross-board and regional-language generalization as explicit, named future work — not an implied current capability
- This scoping makes the tool *more* credible, not less ambitious — it shows the team understands the edges of their own system

## 6. Sustainability / funding model (answer this before it's asked)

A screening tool aimed at schools with "no budget for specialists" needs an explicit answer for who pays for the tool itself. Pick one path and state it consistently across the product's About/landing content and any pitch material:
- **NGO/CSR-funded**: free for government schools, funded through education-focused CSR or NGO partnerships
- **Freemium**: free basic screening per student/month, paid tier for bulk scanning, analytics, or multi-school dashboards for larger private school groups or districts
Do not leave this unanswered — an unaddressed "who pays for this" gap is one of the first questions a reviewer, judge, or real school administrator will ask.

## 7. Scope for this build (MVP — hackathon Round 2)

**In scope:**
- Single handwriting-sample upload → indicator analysis → stored result → PDF report
- Basic teacher-facing dashboard: upload, view a student's scan history, download report
- Simple student records (name, class/section, list of past scans)

**Out of scope for MVP (mention as "future work" only):**
- Speech/reading-aloud analysis
- Multi-language handwriting support beyond English
- Cross-board / cross-curriculum validation beyond the training dataset's scope (see §5)
- Parent-facing login/portal
- Any clinical/diagnostic certification claims

## 8. Tech stack

| Layer | Choice |
|---|---|
| Backend | FastAPI (Python), Pydantic for request/response schemas |
| Database | Supabase (Postgres) |
| Model | CNN, fine-tuned on a labeled handwriting dataset (see §7) |
| Report generation | ReportLab (Python) for PDF output |
| Frontend | React (simple dashboard — upload form, results view, scan history table) |
| Image handling | Pillow / OpenCV for preprocessing before model inference |

## 9. Core architecture / data flow

```
Teacher uploads handwriting image (JPG/PNG)
        ↓
FastAPI receives image → preprocesses (resize, normalize, denoise)
        ↓
CNN model runs inference → outputs per-indicator scores
        ↓
Backend combines scores into: indicator list + overall flag (e.g. "3 of 5 present")
        ↓
Result + original scan metadata saved to Supabase
        ↓
ReportLab generates a one-page PDF: student info, indicators found, plain-language explanation, recommendation
        ↓
Dashboard shows scan history + lets teacher download the PDF
```

## 10. Dataset & model approach

- Use a publicly available labeled handwriting dataset for dyslexia indicators (search Kaggle for "dyslexia handwriting dataset" — there are a few labeled image sets of dyslexic vs. non-dyslexic handwriting samples). Confirm license allows hackathon/educational use, and record the dataset's actual age/grade range and language — this feeds directly into the limitations statement in §5.
- Fine-tune a CNN (a lightweight pretrained backbone like ResNet18/MobileNetV2 is fine — this does not need to be state-of-the-art, it needs to be explainable and honestly validated on a held-out test split, per §4).
- Do not overclaim accuracy. Report whatever the real validation accuracy is, and frame the tool's value as "consistent, evidence-based flagging," not "clinical-grade detection."
- Indicator categories to target (based on common dyslexia handwriting research): letter reversals (b/d, p/q), inconsistent letter sizing, irregular spacing between letters/words, baseline drift (words not sitting on a line), inconsistent letter formation.

## 11. Suggested API endpoints

```
POST   /students                     → create a student record
GET    /students/{id}                → get student + scan history
POST   /students/{id}/scans          → upload a handwriting image, triggers analysis
GET    /scans/{scan_id}               → get indicator results for a scan
GET    /scans/{scan_id}/report        → generate/download the PDF report
GET    /students                      → list all students (for teacher dashboard)
GET    /model/validation-stats        → return the model's held-out validation metrics (for §4 transparency)
```

## 12. Suggested database schema (Supabase/Postgres)

```
students
  id (uuid, pk)
  name (text)
  class_section (text)
  created_at (timestamp)

scans
  id (uuid, pk)
  student_id (fk → students.id)
  image_url (text)          -- stored via Supabase storage
  indicators_found (jsonb)  -- e.g. {"reversals": true, "spacing": false, ...}
  indicator_count (int)
  created_at (timestamp)

reports
  id (uuid, pk)
  scan_id (fk → scans.id)
  pdf_url (text)
  created_at (timestamp)

model_metadata
  id (uuid, pk)
  version (text)
  validation_accuracy (numeric)
  validation_precision (numeric)
  validation_recall (numeric)
  dataset_description (text)   -- age/grade range, language, size — for the limitations statement
  trained_at (timestamp)
```

## 13. Build order (recommended milestones)

1. Source and inspect the dataset; confirm labels, licensing, and its actual age/grade/language coverage
2. Train/fine-tune the CNN; validate on a held-out split; record real accuracy honestly (§4) and store it in `model_metadata`
3. Wrap the model in a FastAPI `/scans` endpoint that returns indicator scores
4. Set up Supabase tables and connect the backend to store results
5. Build the ReportLab PDF template (plain-language, teacher-friendly tone) — include the validation-accuracy footer and limitations line
6. Build the minimal React dashboard: upload form → results view → scan history, plus an "About this tool" section covering limitations (§5) and funding model (§6)
7. End-to-end test: upload a real sample → see indicators → download a working PDF

## 14. Tone & UX guidance

- Dashboard language should be warm and non-alarming (e.g. "Some patterns worth a closer look" rather than "Warning: Risk Detected")
- Never show a bare pass/fail — always show which specific indicators triggered and why
- Keep the teacher-facing UI extremely simple: this needs to be usable by a non-technical teacher in under a minute per student
- Always show the model's validation accuracy and dataset limitations somewhere visible — never bury this in fine print

## 15. What "done" looks like for the hackathon demo

A working flow where: a real (or sample) handwriting image is uploaded through the dashboard → the model runs and returns indicator results within a few seconds → the dashboard displays the flagged indicators clearly, alongside the model's real held-out validation accuracy → a PDF report can be downloaded with the same information in plain language, including the limitations statement. The team should be able to state, out loud and from memory: the real validation number, the dataset's scope/limits, and the funding model for taking this beyond one classroom.
