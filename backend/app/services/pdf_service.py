"""
Generates plain-language PDF screening reports using ReportLab.

Design principles:
- Warm, non-alarming, teacher-friendly tone throughout.
- Never uses the words "diagnosis", "dyslexia confirmed", or "disorder".
- Shows all 5 indicator categories from §10 of the project brief.
- Includes developmental context (b/d reversals normal in children under 7).
- Provides specific professional referral routing (not just "see a specialist").
- Surfaces the dataset's clinical limitations transparently.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

BRAND_BLUE  = colors.HexColor("#2563EB")
BRAND_LIGHT = colors.HexColor("#EFF6FF")
AMBER       = colors.HexColor("#F59E0B")
AMBER_LIGHT = colors.HexColor("#FFFBEB")
GREEN       = colors.HexColor("#059669")
GREEN_LIGHT = colors.HexColor("#ECFDF5")
GREY        = colors.HexColor("#6B7280")
DARK        = colors.HexColor("#0F172A")
ORANGE_SOFT = colors.HexColor("#FEF3C7")


def generate_report(
    student_name: str,
    class_section: str,
    scan_id: str,
    indicators: dict,
    validation_accuracy: float,
    dataset_description: str,
    student_age: int = None,
) -> bytes:
    """Returns PDF as bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )

    styles = getSampleStyleSheet()
    title_style  = ParagraphStyle("title", fontSize=20, textColor=BRAND_BLUE,
                                   spaceAfter=3, alignment=TA_CENTER, fontName="Helvetica-Bold")
    sub_style    = ParagraphStyle("sub", fontSize=10, textColor=GREY,
                                   spaceAfter=2, alignment=TA_CENTER)
    h2_style     = ParagraphStyle("h2", fontSize=12, textColor=BRAND_BLUE,
                                   spaceBefore=10, spaceAfter=4, fontName="Helvetica-Bold")
    body_style   = ParagraphStyle("body", fontSize=9.5, leading=15, spaceAfter=5)
    small_style  = ParagraphStyle("small", fontSize=8, textColor=GREY, leading=12)
    note_style   = ParagraphStyle("note", fontSize=8.5, textColor=colors.HexColor("#92400E"),
                                   leading=13, backColor=ORANGE_SOFT, borderPadding=6)

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph("Saksham (सक्षम)", title_style))
    story.append(Paragraph("Early Learning-Difficulty Screening Report", sub_style))
    story.append(Paragraph(
        "<b>IMPORTANT:</b> This is an automated <b>screening tool</b>, not a clinical diagnostic instrument. "
        "Patterns identified here are visual indicators only — they do not confirm the presence of any "
        "learning difficulty. All findings must be interpreted by a qualified educational psychologist "
        "or special educator.",
        ParagraphStyle("disclaimer", fontSize=8.5, textColor=colors.HexColor("#1E3A8A"),
                       alignment=TA_CENTER, leading=13, backColor=colors.HexColor("#DBEAFE"),
                       borderPadding=5)
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=BRAND_BLUE, spaceAfter=8))

    # ── Student Information ───────────────────────────────────────────────────
    story.append(Paragraph("Student Information", h2_style))

    # Developmental context if age is available
    dev_note = ""
    if student_age is not None and student_age <= 7:
        dev_note = (
            f"  <b>Note:</b> This student is {student_age} years old. Letter reversals (b/d, p/q) "
            "are developmentally typical in children up to age 7 and should be interpreted with "
            "caution at this age stage."
        )

    info_data = [
        ["Student Name:", student_name],
        ["Class / Section:", class_section],
    ]
    if student_age is not None:
        age_cell = f"{student_age} years old"
        if student_age <= 7:
            age_cell += "  [Developmental caution — see note below]"
        info_data.append(["Student Age:", age_cell])
    info_data += [
        ["Screening Date:", datetime.now().strftime("%d %B %Y, %I:%M %p")],
        ["Screening Reference:", scan_id[:16] + "..."],
    ]

    info_table = Table(info_data, colWidths=[5*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ("FONTNAME",  (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE",  (0,0), (-1,-1), 9.5),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [BRAND_LIGHT, colors.white]),
        ("GRID",      (0,0), (-1,-1), 0.5, colors.HexColor("#DBEAFE")),
        ("PADDING",   (0,0), (-1,-1), 6),
    ]))
    story.append(info_table)

    if dev_note:
        story.append(Spacer(1, 6))
        story.append(Paragraph(dev_note, note_style))

    story.append(Spacer(1, 10))

    # ── Overall Screening Result ──────────────────────────────────────────────
    story.append(Paragraph("Overall Screening Summary", h2_style))
    total_count = indicators.get("total_indicator_count", indicators.get("indicator_count", 0))
    ml_count    = indicators.get("indicator_count", 0)
    manual_count = indicators.get("manual_indicator_count", 0)
    summary_flag = indicators.get("summary_flag", indicators.get("flag", ""))

    if total_count == 0:
        result_bg    = GREEN_LIGHT
        result_color = GREEN
        result_label = "No indicators detected (automated or teacher-observed)"
        result_note  = (
            "The handwriting sample did not show common automated or teacher-observed visual patterns "
            "associated with learning difficulties. Continued routine monitoring is recommended. "
            "A single screening session cannot be fully conclusive."
        )
    else:
        result_bg    = ORANGE_SOFT
        result_color = AMBER
        result_label = f"{total_count} of 5 indicator(s) flagged — further assessment recommended"
        result_note  = (
            "Some patterns worth a closer look were found. This does <b>not</b> mean the student "
            "has a learning difficulty. Many children show these patterns for a variety of reasons. "
            "Refer to the 'Recommended Next Steps' section for specific professional routing."
        )

    result_data = [["Result:", result_label]]
    result_table = Table(result_data, colWidths=[3.5*cm, 13.5*cm])
    result_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), result_bg),
        ("FONTNAME",   (0,0), (0,0), "Helvetica-Bold"),
        ("FONTNAME",   (1,0), (1,0), "Helvetica-Bold"),
        ("TEXTCOLOR",  (1,0), (1,0), result_color),
        ("FONTSIZE",   (0,0), (-1,-1), 9.5),
        ("GRID",       (0,0), (-1,-1), 0.5, colors.HexColor("#D1D5DB")),
        ("PADDING",    (0,0), (-1,-1), 8),
    ]))
    story.append(result_table)
    story.append(Spacer(1, 5))
    story.append(Paragraph(result_note, body_style))

    # ── 5-Indicator Breakdown ─────────────────────────────────────────────────
    story.append(Paragraph(
        "Indicator Breakdown — All 5 Categories (§10 Saksham Brief)",
        h2_style
    ))
    story.append(Paragraph(
        "<i>Indicators 1–2 are evaluated by the Saksham ML model. "
        "Indicators 3–5 are teacher-observed and recorded during the screening session.</i>",
        small_style
    ))
    story.append(Spacer(1, 5))

    def detected_cell(val):
        """Format indicator cell with clear YES/No labels."""
        if val is True:
            return "YES"
        elif val is False:
            return "No"
        else:
            return "Not assessed"

    rev_detected = indicators.get("Reversal", False)
    cor_detected = indicators.get("Corrected", False)
    sp_detected  = indicators.get("manual_irregular_spacing")
    bd_detected  = indicators.get("manual_baseline_drift")
    sz_detected  = indicators.get("manual_inconsistent_sizing")

    indicator_rows = [
        ["#", "Indicator", "Detected?", "Assessment Method", "What It Means"],
        [
            "1",
            "Letter Reversals (b/d, p/q)",
            detected_cell(rev_detected),
            "Automated (ML)",
            "Letters written in mirrored or reversed orientation — a known early visual indicator.",
        ],
        [
            "2",
            "Over-Correction / Heavy Erasing",
            detected_cell(cor_detected),
            "Automated (ML)",
            "Repeated rewriting suggesting difficulty maintaining consistent letter formation.",
        ],
        [
            "3",
            "Irregular Word/Letter Spacing",
            detected_cell(sp_detected),
            "Teacher-observed",
            "Erratic or unusually large/small gaps between letters or words.",
        ],
        [
            "4",
            "Baseline Drift (text not on line)",
            detected_cell(bd_detected),
            "Teacher-observed",
            "Text wandering above or below the ruled line instead of following it consistently.",
        ],
        [
            "5",
            "Inconsistent Letter Sizing",
            detected_cell(sz_detected),
            "Teacher-observed",
            "Erratic variation in letter heights within the same word or sentence.",
        ],
    ]

    col_widths = [0.6*cm, 4.2*cm, 2*cm, 3.5*cm, 6.7*cm]
    ind_table = Table(indicator_rows, colWidths=col_widths)
    ind_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), BRAND_BLUE),
        ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [BRAND_LIGHT, colors.white]),
        ("GRID",          (0,0), (-1,-1), 0.4, colors.HexColor("#DBEAFE")),
        ("PADDING",       (0,0), (-1,-1), 5),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        # Highlight YES cells in amber
        *[
            ("TEXTCOLOR", (2, r), (2, r), AMBER)
            for r, row in enumerate(indicator_rows)
            if r > 0 and row[2] == "YES"
        ],
        *[
            ("FONTNAME", (2, r), (2, r), "Helvetica-Bold")
            for r, row in enumerate(indicator_rows)
            if r > 0 and row[2] == "YES"
        ],
    ]))
    story.append(ind_table)
    story.append(Spacer(1, 4))

    reversal_prob = indicators.get("reversal_prob", 0.0)
    confidence    = indicators.get("confidence", 0.0)
    story.append(Paragraph(
        f"<i>ML model — dominant pattern: {indicators.get('dominant_class','?')} "
        f"(score {confidence*100:.1f}%) | Reversal probability: {reversal_prob*100:.1f}% "
        f"| Screening mode: sensitivity-optimised</i>",
        small_style
    ))

    # ── Developmental Context ─────────────────────────────────────────────────
    story.append(Paragraph("Developmental Context", h2_style))
    story.append(Paragraph(
        "Letter reversals (b/d, p/q) are <b>normal and expected</b> in children up to approximately "
        "age 7 and do not, on their own, indicate a learning difficulty in younger children. "
        "Persistent reversals beyond age 7–8, especially combined with reading difficulties or "
        "other indicators in this report, are more clinically meaningful and warrant referral. "
        "Always consider the student's overall developmental profile.",
        body_style
    ))

    # ── Recommended Next Steps ────────────────────────────────────────────────
    story.append(Paragraph("Recommended Next Steps", h2_style))
    if total_count == 0:
        steps = [
            "Continue routine classroom observation of reading, writing, and comprehension.",
            "If the teacher observes ongoing struggles in the coming weeks, a re-screening or "
            "specialist consultation is always available.",
            "No referral action is required at this time based on this screening.",
        ]
    else:
        steps = [
            "<b>Immediate:</b> Share this report with the school's special educator or counsellor "
            "within the next school week.",
            "<b>Referral pathway:</b> Request a psycho-educational assessment from a licensed "
            "educational psychologist (a Registered Rehabilitation Professional / RCI-certified "
            "specialist in India). District-level DIET centres and NGOs like Vidhi Centre for "
            "Legal Policy or Pratham can help locate assessors in government school contexts.",
            "<b>Parent communication:</b> Frame the conversation around 'understanding how the "
            "student learns best' — avoid using the word 'dyslexia' or implying diagnosis. "
            "Use the language: 'We noticed some patterns that a specialist can look at more closely.'",
            "<b>Classroom support (immediate, low-cost):</b> Preferential seating, additional time "
            "on written tasks, and multi-sensory instruction strategies can begin immediately while "
            "awaiting formal assessment.",
            "<b>Avoid:</b> Labelling, comparison with peers, or reducing written expectations "
            "without specialist guidance.",
        ]
    for step in steps:
        story.append(Paragraph(f"   {step}", body_style))

    # ── Footer / Transparency ─────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY, spaceBefore=12))
    story.append(Paragraph("Model & Dataset Transparency", h2_style))
    story.append(Paragraph(
        f"<b>Held-out test accuracy:</b> {validation_accuracy*100:.1f}% concordance with "
        "handwriting category labels on data strictly not seen during training. "
        "This is a classification concordance rate — not a clinical sensitivity/specificity measure "
        "validated against expert psycho-educational assessments.",
        small_style
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "<b>Dataset labelling note:</b> The training dataset categories (Corrected, Normal, Reversal) "
        "are curated image labels from an educational dataset. They were not independently validated "
        "by RCI-certified educational psychologists. This means the model's 'accuracy' reflects "
        "agreement with image-level labels, not agreement with clinical expert diagnosis.",
        small_style
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"<b>Dataset scope:</b> {dataset_description}",
        small_style
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "<b>Saksham is a screening aid only.</b> It does not diagnose any condition. "
        "Performance on handwriting from boards, regional Indian scripts, or age groups outside "
        "the training data has not been validated. Use only within stated scope.",
        small_style
    ))

    doc.build(story)
    return buf.getvalue()
