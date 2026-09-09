# Saksham — Hackathon Pitch & Judge Q&A Guide

Use this document to prepare your spoken presentation and live demonstration for the judges.

---

## 🎙️ 2-Minute Elevator Pitch Script (Memorize This)

> *"Good morning judges. In India, an estimated **1 in 10 schoolchildren** shows signs of a learning difficulty like dyslexia. But in over 90% of schools, there is no school psychologist, no screening protocol, and no budget for specialists.*
>
> *As a result, struggling children spend 3 to 5 critical formative years being mislabeled as 'slow', 'careless', or 'lazy' before anyone investigates the underlying cause.*
>
> *We built **Saksham** (सक्षम). Saksham gives any primary classroom teacher a **15-minute, zero-specialist-required screening tool** to flag early indicators and route students to timely professional care.*
>
> *Here is how it works: the teacher simply takes a photo of a handwriting sample. In less than 3 seconds, our fine-tuned computer vision model analyzes visual markers—like letter reversals and stroke over-correction. The teacher immediately receives an objective indicator breakdown and can download a **plain-language, 1-page PDF referral report** to share with parents and counsellors.*
>
> *Crucially, **Saksham never diagnoses**. It is strictly an early screening aid. We also reject artificial claims of '99% accuracy': our model achieves an honest, measured **77.1% concordance on strictly held-out test data**.*
>
> *With Saksham, no child has to fall through the cracks just because their school lacks a full-time specialist."*

---

## 💻 60-Second Live Demo Choreography

| Time | Action on Screen | What You Say |
|---|---|---|
| **0:00 - 0:15** | Open `http://localhost:5173`. Show student selection (*Aarav Sharma - Class 3-B*). Point out the non-diagnostic warning banner at the top. | *"Here is the teacher dashboard. Notice right away that every screen reinforces that this is a screening tool, never a clinical diagnosis."* |
| **0:15 - 0:30** | Click the **⚡ Reversal Pattern** sample chip. Click **Run Screening Analysis**. Watch the loading spinner and live card transition. | *"Teachers don't need technical skills. They upload a notebook photo or select a scan. Within seconds, our PyTorch MobileNet model evaluates letter orientation and line continuity."* |
| **0:30 - 0:45** | Highlight the result card: *"1 of 2 indicators present (Reversal)"* and the confidence breakdown. Click **Download Plain-Language PDF Report**. Open the downloaded PDF. | *"The output is warm and non-alarming: 'Some patterns worth a closer look'. And with one click, the teacher gets a beautifully formatted 1-page report ready for parent-teacher conferences."* |
| **0:45 - 1:00** | Switch to the **Model Transparency** tab. Show the **77.1% held-out test accuracy**, per-class F1 scores, and training curves. | *"Finally, our Model Transparency tab displays real metrics on unseen held-out data. We believe medical and educational AI must be grounded in total scientific honesty."* |

---

## 🎯 The 3 Tough Questions Judges Will Ask (& Winning Answers)

### Question 1: *"77% accuracy seems low compared to 95%+ claims in other AI projects. Why should we trust this?"*

> **Winning Answer:**
> *"Most projects claim 95% or 99% accuracy because they evaluate on training data, use synthetic clean benchmarks, or leak test data into their pipeline. In the real world, handwriting variation among 7-to-10-year-olds is noisy and complex.
>
> Our 77.06% accuracy was evaluated strictly on **held-out test samples the model never saw**. Furthermore, our precision on over-correction is **98%**, and on reversals it is **86%**.
>
> Most importantly: **Saksham is a first-pass triage tool, not a clinical MRI.** In a school with zero screening, flagging 77% of at-risk students with high precision is the difference between getting help early versus years of neglect."*

---

### Question 2: *"Does this work for Hindi, Tamil, or regional Indian languages?"*

> **Winning Answer:**
> *"Not yet, and we state that limitation explicitly in Section 5 of our brief and directly in our 'Scope & Limitations' tab.
>
> This MVP is validated on English-medium handwriting from primary school cohorts. Dyslexic visual indicators in Indian scripts like Devanagari or Tamil present differently—such as matra placement confusion or conjunct consonant distortion.
>
> Expanding our fine-tuning to regional scripts with state educational boards is our primary Phase 2 milestone."*

---

### Question 3: *"Who pays for this? Government schools don't have budgets for software."*

> **Winning Answer:**
> *"We designed a two-pronged funding model specifically for this reality:
> 1. **Public Schools:** 100% free, funded via Corporate Social Responsibility (CSR) education mandates from tech and banking enterprises, alongside philanthropic foundations like Azim Premji Foundation and Pratham.
> 2. **Private & International Schools:** A freemium SaaS model—individual teachers get free screening for up to 25 students a month; school networks pay an annual institutional license for district analytics, batch scanning, and longitudinal student progress tracking."*

---

## 🏆 Checklist Before Pitching

- [x] Backend running on `http://127.0.0.1:8000`
- [x] Frontend running on `http://127.0.0.1:5173`
- [x] Sample buttons (*Normal*, *Reversal*, *Corrected*) working smoothly
- [x] PDF download tested and opening cleanly
- [x] Transparency tab showing 77.06% validation accuracy and training curves
- [x] Team understands the 3 judge answers above
