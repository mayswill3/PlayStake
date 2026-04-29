#!/usr/bin/env python3
"""
Payment Processor Evaluation PDF Generator for PlayStake
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

# Brand colours
NAVY = HexColor("#0F1F3D")
NAVY_MID = HexColor("#1A3560")
ACCENT = HexColor("#2563EB")
ACCENT_LIGHT = HexColor("#DBEAFE")
LIGHT_GREY = HexColor("#F8F9FB")
MID_GREY = HexColor("#E2E8F0")
DARK_GREY = HexColor("#475569")
BODY_TEXT = HexColor("#1E293B")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN_H = 2.0 * cm
MARGIN_V = 2.2 * cm
CONTENT_W = PAGE_W - 2 * MARGIN_H


def build_styles():
    base = getSampleStyleSheet()

    styles = {}

    styles["cover_title"] = ParagraphStyle(
        "cover_title",
        fontName="Helvetica-Bold",
        fontSize=26,
        leading=32,
        textColor=WHITE,
        alignment=TA_LEFT,
        spaceAfter=8,
    )
    styles["cover_sub"] = ParagraphStyle(
        "cover_sub",
        fontName="Helvetica",
        fontSize=13,
        leading=18,
        textColor=HexColor("#93C5FD"),
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    styles["cover_date"] = ParagraphStyle(
        "cover_date",
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=HexColor("#CBD5E1"),
        alignment=TA_LEFT,
    )
    styles["h1"] = ParagraphStyle(
        "h1",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=20,
        textColor=NAVY,
        spaceBefore=18,
        spaceAfter=6,
        borderPadding=(0, 0, 4, 0),
    )
    styles["h2"] = ParagraphStyle(
        "h2",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=NAVY_MID,
        spaceBefore=12,
        spaceAfter=4,
    )
    styles["body"] = ParagraphStyle(
        "body",
        fontName="Helvetica",
        fontSize=9.5,
        leading=15,
        textColor=BODY_TEXT,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    )
    styles["body_left"] = ParagraphStyle(
        "body_left",
        fontName="Helvetica",
        fontSize=9.5,
        leading=15,
        textColor=BODY_TEXT,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    styles["bullet"] = ParagraphStyle(
        "bullet",
        fontName="Helvetica",
        fontSize=9.5,
        leading=15,
        textColor=BODY_TEXT,
        leftIndent=14,
        bulletIndent=0,
        spaceAfter=3,
    )
    styles["verdict"] = ParagraphStyle(
        "verdict",
        fontName="Helvetica-BoldOblique",
        fontSize=9.5,
        leading=14,
        textColor=NAVY_MID,
        spaceBefore=4,
        spaceAfter=4,
    )
    styles["table_header"] = ParagraphStyle(
        "table_header",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=WHITE,
        alignment=TA_LEFT,
    )
    styles["table_cell"] = ParagraphStyle(
        "table_cell",
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=BODY_TEXT,
        alignment=TA_LEFT,
    )
    styles["table_cell_dim"] = ParagraphStyle(
        "table_cell_dim",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=DARK_GREY,
        alignment=TA_LEFT,
    )
    styles["rank"] = ParagraphStyle(
        "rank",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=BODY_TEXT,
        leftIndent=0,
        spaceAfter=4,
    )
    styles["callout"] = ParagraphStyle(
        "callout",
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=NAVY,
        spaceAfter=4,
    )
    styles["section_number"] = ParagraphStyle(
        "section_number",
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=ACCENT,
        spaceBefore=0,
        spaceAfter=2,
    )

    return styles


class CoverPage(Flowable):
    """Renders a full-bleed navy cover panel."""

    def __init__(self, width, height, styles):
        super().__init__()
        self.width = width
        self.height = height
        self.styles = styles

    def draw(self):
        c = self.canv
        # Full navy background
        c.setFillColor(NAVY)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)

        # Accent bar on left
        c.setFillColor(ACCENT)
        c.rect(0, 0, 5, self.height, fill=1, stroke=0)

        # Subtle geometric decoration — top-right corner arc
        c.setFillColor(NAVY_MID)
        c.rect(self.width - 90, self.height - 90, 90, 90, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.circle(self.width - 90, self.height, 70, fill=1, stroke=0)

        # PlayStake wordmark
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(ACCENT)
        c.drawString(MARGIN_H, self.height - 3.2 * cm, "PLAYSTAKE")

        # Divider
        c.setStrokeColor(HexColor("#1E3A6E"))
        c.setLineWidth(0.5)
        c.line(MARGIN_H, self.height - 3.6 * cm, self.width - MARGIN_H, self.height - 3.6 * cm)

        # Document title
        c.setFont("Helvetica-Bold", 26)
        c.setFillColor(WHITE)
        title_y = self.height - 5.5 * cm
        c.drawString(MARGIN_H, title_y, "Payment Processor")
        c.drawString(MARGIN_H, title_y - 0.9 * cm, "Evaluation")

        # Rule under title
        c.setStrokeColor(ACCENT)
        c.setLineWidth(2)
        c.line(MARGIN_H, title_y - 1.5 * cm, MARGIN_H + 6 * cm, title_y - 1.5 * cm)

        # Subtitle
        c.setFont("Helvetica", 13)
        c.setFillColor(HexColor("#93C5FD"))
        c.drawString(MARGIN_H, title_y - 2.3 * cm, "PlayStake  \u2014  Confidential")

        # Date
        c.setFont("Helvetica", 10)
        c.setFillColor(HexColor("#94A3B8"))
        c.drawString(MARGIN_H, title_y - 3.1 * cm, "April 2026")

        # Bottom section — "Prepared for"
        bottom_y = 4 * cm
        c.setStrokeColor(HexColor("#1E3A6E"))
        c.setLineWidth(0.5)
        c.line(MARGIN_H, bottom_y + 1.4 * cm, self.width - MARGIN_H, bottom_y + 1.4 * cm)

        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#64748B"))
        c.drawString(MARGIN_H, bottom_y + 0.6 * cm, "PREPARED FOR")

        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(WHITE)
        c.drawString(MARGIN_H, bottom_y - 0.1 * cm, "PlayStake — Product & Investor Relations")

        # Classification badge
        badge_x = self.width - MARGIN_H - 3.2 * cm
        badge_y = bottom_y - 0.2 * cm
        c.setFillColor(HexColor("#1E3A6E"))
        c.roundRect(badge_x, badge_y, 3.2 * cm, 0.7 * cm, 3, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(HexColor("#93C5FD"))
        c.drawCentredString(badge_x + 1.6 * cm, badge_y + 0.2 * cm, "CONFIDENTIAL")

    def wrap(self, availW, availH):
        return self.width, self.height


class HeaderRule(Flowable):
    """A thin coloured rule used below section headings."""

    def __init__(self, width, color=ACCENT):
        super().__init__()
        self.width = width
        self.color = color
        self.height = 1.5

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(1.5)
        self.canv.line(0, 0, self.width, 0)

    def wrap(self, availW, availH):
        return self.width, self.height


def page_template(canvas_obj, doc):
    """Header and footer on every content page."""
    canvas_obj.saveState()
    w, h = A4

    # Header
    canvas_obj.setFillColor(NAVY)
    canvas_obj.rect(0, h - 1.4 * cm, w, 1.4 * cm, fill=1, stroke=0)

    canvas_obj.setFillColor(ACCENT)
    canvas_obj.rect(0, h - 1.4 * cm, 4, 1.4 * cm, fill=1, stroke=0)

    canvas_obj.setFont("Helvetica-Bold", 8)
    canvas_obj.setFillColor(WHITE)
    canvas_obj.drawString(MARGIN_H, h - 0.85 * cm, "PLAYSTAKE")

    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(HexColor("#93C5FD"))
    canvas_obj.drawCentredString(w / 2, h - 0.85 * cm, "Payment Processor Evaluation — Confidential")

    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(HexColor("#94A3B8"))
    canvas_obj.drawRightString(w - MARGIN_H, h - 0.85 * cm, "April 2026")

    # Footer
    canvas_obj.setFillColor(MID_GREY)
    canvas_obj.rect(0, 0, w, 1.0 * cm, fill=1, stroke=0)

    canvas_obj.setFillColor(ACCENT)
    canvas_obj.rect(0, 0, 4, 1.0 * cm, fill=1, stroke=0)

    canvas_obj.setFont("Helvetica", 7.5)
    canvas_obj.setFillColor(DARK_GREY)
    canvas_obj.drawString(MARGIN_H, 0.35 * cm, "PlayStake Ltd — For authorised recipients only. Not for distribution.")

    canvas_obj.setFont("Helvetica-Bold", 8)
    canvas_obj.setFillColor(NAVY)
    canvas_obj.drawRightString(w - MARGIN_H, 0.35 * cm, f"Page {doc.page}")

    canvas_obj.restoreState()


def section_heading(number, title, styles):
    items = []
    items.append(Spacer(1, 6))
    items.append(Paragraph(f"Section {number}", styles["section_number"]))
    items.append(Paragraph(title, styles["h1"]))
    items.append(HeaderRule(CONTENT_W))
    items.append(Spacer(1, 6))
    return items


def callout_box(text, styles, bg=ACCENT_LIGHT, border=ACCENT):
    """Returns a single-cell table that looks like a callout box."""
    p = Paragraph(text, styles["callout"])
    t = Table([[p]], colWidths=[CONTENT_W - 2])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LINECOLOR", (0, 0), (-1, -1), border),
        ("LINEBEFORE", (0, 0), (0, -1), 3, border),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [bg]),
        ("ROWBORDERCOLORS", (0, 0), (-1, -1), border),
    ]))
    return t


def build_comparison_table(styles):
    s = styles

    col_w = [5.8 * cm, 4.5 * cm, 4.5 * cm, 4.5 * cm]

    dimensions = [
        ("Gambling stance",
         "Restricted — needs approval, can be revoked",
         "Native vertical — built for it",
         "Accepts gambling with valid licence"),
        ("Account stability",
         "High termination risk",
         "Contractually stable",
         "Stable — heavy compliance monitoring"),
        ("Who uses it",
         "Tech startups (pre-licence)",
         "iGaming startups, mid-market operators",
         "Large established operators"),
        ("Minimum size",
         "None",
         "Small–mid stage",
         "Prefers established volume"),
        ("Onboarding time",
         "Hours (test), days (live)",
         "Weeks",
         "Months — heavy underwriting"),
        ("API quality",
         "Excellent",
         "Good",
         "Poor — legacy SOAP/XML"),
        ("Developer experience",
         "Best in class",
         "Modern REST, decent docs",
         "Painful — enterprise integrators"),
        ("Payment methods",
         "Cards, wallets",
         "Cards, open banking, crypto, prepaid, 500+ local methods",
         "Cards, wallets, some local methods"),
        ("Chargeback handling",
         "Strict 1% threshold",
         "Gaming-specific, higher tolerance",
         "Gaming-specific, higher tolerance"),
        ("KYC / AML tooling",
         "Generic",
         "Built-in gaming compliance flows",
         "Built-in but complex to configure"),
        ("Responsible gambling",
         "None",
         "Built-in deposit limits, self-exclusion",
         "Built-in but separate integration"),
        ("Settlement speed",
         "2–7 days",
         "Negotiable, T+1 possible",
         "2–3 days standard"),
        ("Pricing model",
         "Fixed (2.9% + 30¢)",
         "Negotiable",
         "Negotiable — monthly minimums"),
        ("Monthly minimum fees",
         "None",
         "Low",
         "Yes — £500–£1,000+/month"),
        ("Suitable for PlayStake now?",
         "Demo only",
         "Once licensed",
         "Too heavyweight for early stage"),
    ]

    header_row = [
        Paragraph("Dimension", s["table_header"]),
        Paragraph("Stripe", s["table_header"]),
        Paragraph("Nuvei", s["table_header"]),
        Paragraph("Worldpay", s["table_header"]),
    ]

    data = [header_row]
    for i, (dim, stripe, nuvei, worldpay) in enumerate(dimensions):
        row = [
            Paragraph(dim, s["table_cell_dim"]),
            Paragraph(stripe, s["table_cell"]),
            Paragraph(nuvei, s["table_cell"]),
            Paragraph(worldpay, s["table_cell"]),
        ]
        data.append(row)

    table = Table(data, colWidths=col_w, repeatRows=1)

    row_count = len(data)
    ts = TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        # Alternating rows
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.4, MID_GREY),
        ("LINEBELOW", (0, 0), (-1, 0), 1, ACCENT),
        # Highlight Nuvei column header
        ("BACKGROUND", (2, 0), (2, 0), ACCENT),
        # Nuvei column subtle tint on data rows
        ("BACKGROUND", (2, 1), (2, row_count - 1), HexColor("#EFF6FF")),
        # Last row — suitability — bold
        ("FONTNAME", (0, row_count - 1), (-1, row_count - 1), "Helvetica-Bold"),
        ("BACKGROUND", (0, row_count - 1), (-1, row_count - 1), HexColor("#F1F5F9")),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ])
    table.setStyle(ts)
    return table


def build_licensing_table(styles):
    s = styles
    col_w = [4.2 * cm, 4.5 * cm, 3.5 * cm, 3.1 * cm]

    header = [
        Paragraph("Jurisdiction", s["table_header"]),
        Paragraph("Licence Body", s["table_header"]),
        Paragraph("Timeline", s["table_header"]),
        Paragraph("Cost (approx)", s["table_header"]),
    ]
    rows = [
        ["United Kingdom", "UKGC (UK Gambling Commission)", "4–6 months", "£40,000–£80,000"],
        ["Malta", "MGA (Malta Gaming Authority)", "3–5 months", "€25,000–€50,000"],
        ["Gibraltar", "Gibraltar Regulatory Authority", "4–6 months", "£30,000–£60,000"],
        ["Isle of Man", "GSC (Gambling Supervision Commission)", "3–5 months", "£20,000–£40,000"],
    ]

    data = [header]
    for r in rows:
        data.append([Paragraph(cell, s["table_cell"]) for cell in r])

    # Bold the Malta row (recommended)
    data[2] = [Paragraph(cell, ParagraphStyle(
        "bold_cell",
        parent=s["table_cell"],
        fontName="Helvetica-Bold",
    )) for cell in rows[1]]

    table = Table(data, colWidths=col_w, repeatRows=1)
    ts = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        ("GRID", (0, 0), (-1, -1), 0.4, MID_GREY),
        ("LINEBELOW", (0, 0), (-1, 0), 1, ACCENT),
        # Highlight MGA row
        ("BACKGROUND", (0, 2), (-1, 2), HexColor("#EFF6FF")),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ])
    table.setStyle(ts)
    return table


def build_migration_table(styles):
    s = styles

    change_col = 6.5 * cm
    file_col = CONTENT_W - change_col

    change_header = [
        Paragraph("Change Type", s["table_header"]),
        Paragraph("File", s["table_header"]),
    ]

    changes = [
        ("Replace", "src/lib/payments/stripe.ts  →  Nuvei API wrapper"),
        ("Replace", "src/app/api/webhooks/stripe/route.ts  →  Nuvei notification handler"),
        ("Update UI", "src/app/(dashboard)/wallet/deposit/page.tsx  →  swap PaymentElement for Nuvei hosted form"),
        ("Update config", "Environment variables  →  swap Stripe keys for Nuvei credentials"),
    ]
    unchanged = [
        ("No change", "src/lib/ledger/  (all ledger logic)"),
        ("No change", "Escrow and bet settlement logic"),
        ("No change", "Game logic and session management"),
    ]

    data = [change_header]
    for change_type, file_path in changes:
        data.append([
            Paragraph(change_type, ParagraphStyle("ct", parent=s["table_cell"], fontName="Helvetica-Bold", textColor=ACCENT)),
            Paragraph(file_path, s["table_cell"]),
        ])
    # Separator row
    data.append([
        Paragraph("— Unchanged —", ParagraphStyle("sep", parent=s["table_cell"], fontName="Helvetica-BoldOblique", textColor=DARK_GREY)),
        Paragraph("", s["table_cell"]),
    ])
    for change_type, file_path in unchanged:
        data.append([
            Paragraph(change_type, ParagraphStyle("nc", parent=s["table_cell"], textColor=HexColor("#16A34A"), fontName="Helvetica-Bold")),
            Paragraph(file_path, s["table_cell"]),
        ])

    table = Table(data, colWidths=[change_col, file_col], repeatRows=1)
    sep_row = len(changes) + 1
    ts = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
        ("GRID", (0, 0), (-1, -1), 0.4, MID_GREY),
        ("LINEBELOW", (0, 0), (-1, 0), 1, ACCENT),
        # Separator row
        ("BACKGROUND", (0, sep_row), (-1, sep_row), HexColor("#F1F5F9")),
        ("SPAN", (0, sep_row), (-1, sep_row)),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ])
    table.setStyle(ts)
    return table


def cover_page_template(canvas_obj, doc):
    """No header/footer on cover page."""
    pass


def build_document():
    from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate

    output_path = "/Users/mays/Projects/PlayStake/docs/payment-processor-evaluation.pdf"

    doc = BaseDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN_H,
        rightMargin=MARGIN_H,
        topMargin=MARGIN_V + 0.6 * cm,
        bottomMargin=MARGIN_V,
        title="Payment Processor Evaluation — PlayStake",
        author="PlayStake",
        subject="Confidential — April 2026",
    )

    # Cover page frame — full page, no margins
    cover_frame = Frame(0, 0, PAGE_W, PAGE_H, leftPadding=0, rightPadding=0,
                        topPadding=0, bottomPadding=0, id="cover")
    # Content frame — with margins and space for header/footer
    content_frame = Frame(
        MARGIN_H, MARGIN_V,
        PAGE_W - 2 * MARGIN_H,
        PAGE_H - 2 * MARGIN_V - 1.4 * cm,
        id="normal",
    )

    cover_template = PageTemplate(id="Cover", frames=[cover_frame], onPage=cover_page_template)
    content_template = PageTemplate(id="Content", frames=[content_frame], onPage=page_template)
    doc.addPageTemplates([cover_template, content_template])

    from reportlab.platypus import NextPageTemplate

    styles = build_styles()
    story = []

    # ------------------------------------------------------------------ Cover
    story.append(NextPageTemplate("Cover"))
    story.append(CoverPage(PAGE_W, PAGE_H, styles))
    story.append(NextPageTemplate("Content"))
    story.append(PageBreak())

    # ------------------------------------------------- Section 1: Exec Summary
    story.extend(section_heading("1", "Executive Summary", styles))
    story.append(Paragraph(
        "PlayStake is an early-stage peer-to-peer skill wagering platform built on a modern "
        "Next.js stack with a double-entry ledger, escrow system, and real-money deposit and "
        "withdrawal flows. This document evaluates three payment processors — <b>Stripe</b>, "
        "<b>Nuvei</b>, and <b>Worldpay</b> — and provides a recommendation for the platform's "
        "payment infrastructure roadmap.",
        styles["body"],
    ))
    story.append(Spacer(1, 4))
    story.append(callout_box(
        "<b>Key finding:</b> All three processors require a valid gambling licence before "
        "processing real-money gaming transactions. The licensing prerequisite is non-negotiable "
        "and applies universally. Operating real-money gambling without a licence (e.g. UKGC or "
        "MGA) is not legally viable regardless of processor choice.",
        styles,
    ))
    story.append(Spacer(1, 10))

    # -------------------------------------------------- Section 2: Recommendation
    story.extend(section_heading("2", "Recommendation", styles))
    story.append(callout_box(
        "<b>Primary recommendation: Nuvei</b> — once a gambling licence is secured.",
        styles,
        bg=HexColor("#EFF6FF"),
        border=ACCENT,
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Ranked recommendation:", styles["h2"]))

    ranks = [
        ("1", "Nuvei", "Right fit, right stage — purpose-built for iGaming. Begin onboarding discussions once licensed."),
        ("2", "Stripe", "Suitable for demos and pre-licence testing only. Do not use in production for real-money gambling."),
        ("3", "Worldpay", "Revisit at Series A+ when volume and team size justify the overhead."),
    ]

    for num, name, desc in ranks:
        rank_data = [[
            Paragraph(num, ParagraphStyle(
                "rn", fontName="Helvetica-Bold", fontSize=14,
                textColor=WHITE, alignment=TA_CENTER,
            )),
            Paragraph(f"<b>{name}</b>  —  {desc}", styles["body_left"]),
        ]]
        circle_col = 0.7 * cm
        t = Table(rank_data, colWidths=[circle_col, CONTENT_W - circle_col - 0.4 * cm])
        bg = ACCENT if num == "1" else NAVY_MID if num == "2" else DARK_GREY
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), bg),
            ("TOPPADDING", (0, 0), (0, 0), 8),
            ("BOTTOMPADDING", (0, 0), (0, 0), 8),
            ("LEFTPADDING", (0, 0), (0, 0), 2),
            ("RIGHTPADDING", (0, 0), (0, 0), 2),
            ("TOPPADDING", (0, 0), (1, 0), 8),
            ("BOTTOMPADDING", (0, 0), (1, 0), 8),
            ("LEFTPADDING", (1, 0), (1, 0), 10),
            ("RIGHTPADDING", (1, 0), (1, 0), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, MID_GREY),
            ("BACKGROUND", (1, 0), (1, 0), LIGHT_GREY),
        ]))
        story.append(t)
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 8))

    # ----------------------------------------------- Section 3: Comparison Table
    story.extend(section_heading("3", "Processor Comparison", styles))
    story.append(Paragraph(
        "The following table compares Stripe, Nuvei, and Worldpay across fifteen dimensions "
        "relevant to a licensed real-money gaming platform. The Nuvei column is highlighted "
        "to reflect the primary recommendation.",
        styles["body"],
    ))
    story.append(Spacer(1, 6))
    story.append(build_comparison_table(styles))
    story.append(Spacer(1, 10))

    # ----------------------------------------- Section 4: Detailed Assessments
    story.extend(section_heading("4", "Detailed Processor Assessments", styles))

    # Stripe
    story.append(KeepTogether([
        Paragraph("Stripe", styles["h2"]),
        Paragraph(
            "Stripe is the current integration in the PlayStake codebase. It is excellent for "
            "development and investor demos due to its test mode, developer tooling, and fast "
            "activation. However, Stripe classifies gambling as a restricted business. Accounts "
            "can be terminated without warning, and funds can be held for 90–180 days on "
            "termination. For a platform where user funds are held in escrow, this represents "
            "an existential operational risk in production.",
            styles["body"],
        ),
        callout_box(
            "<b>Verdict:</b> Retain for demos and pre-licence development. "
            "Do not use in production for real-money gambling.",
            styles,
            bg=HexColor("#FEF9C3"),
            border=HexColor("#CA8A04"),
        ),
    ]))
    story.append(Spacer(1, 8))

    # Nuvei
    story.append(KeepTogether([
        Paragraph("Nuvei", styles["h2"]),
        Paragraph(
            "Nuvei is a payment technology company purpose-built for high-growth verticals "
            "including iGaming, sports betting, and skill wagering. Their Player Accounts API "
            "is designed specifically for the deposit → wallet → withdrawal lifecycle that "
            "PlayStake operates. They offer 500+ payment methods, built-in KYC/AML, responsible "
            "gambling tools, and a stable contractual relationship for licensed gaming operators.",
            styles["body"],
        ),
        Paragraph(
            "For the PlayStake codebase, the migration involves replacing the Stripe payments "
            "library and webhook handler — the ledger, escrow, and settlement layers remain "
            "entirely unchanged. Estimated development effort is one week.",
            styles["body"],
        ),
        callout_box(
            "<b>Verdict:</b> Primary recommendation. Begin onboarding discussions once a "
            "gambling licence is in hand.",
            styles,
            bg=HexColor("#F0FDF4"),
            border=HexColor("#16A34A"),
        ),
    ]))
    story.append(Spacer(1, 8))

    # Worldpay
    story.append(KeepTogether([
        Paragraph("Worldpay", styles["h2"]),
        Paragraph(
            "Worldpay (FIS) is one of the largest payment processors in the world and serves "
            "major gambling operators globally. However, it is designed for enterprise-scale "
            "operators with established trading history, compliance teams, and significant "
            "volume. Their API is based on legacy SOAP/XML and lacks a modern SDK. Monthly "
            "minimum fees, a lengthy sales and underwriting process, and heavy integration "
            "complexity make it unsuitable for an early-stage platform.",
            styles["body"],
        ),
        callout_box(
            "<b>Verdict:</b> Not suitable at current stage. Revisit at Series A+ when volume "
            "and team size justify the overhead.",
            styles,
            bg=HexColor("#FEF2F2"),
            border=HexColor("#DC2626"),
        ),
    ]))
    story.append(Spacer(1, 6))

    # ----------------------------------------------- Section 5: Licensing Roadmap
    story.extend(section_heading("5", "Licensing Roadmap", styles))
    story.append(Paragraph(
        "No payment processor — including Stripe — will process real-money gambling transactions "
        "without a valid gambling licence. The table below outlines the four most accessible "
        "licensing jurisdictions for a UK-based early-stage operator. The Malta MGA licence is "
        "highlighted as the recommended starting point.",
        styles["body"],
    ))
    story.append(Spacer(1, 6))
    story.append(build_licensing_table(styles))
    story.append(Spacer(1, 6))
    story.append(callout_box(
        "<b>Malta (MGA) is generally the recommended starting point</b> for early-stage European "
        "iGaming operators due to its EU passporting, recognised brand, and faster processing "
        "times relative to UKGC. Estimated licensing costs are exclusive of legal fees.",
        styles,
        bg=HexColor("#EFF6FF"),
        border=ACCENT,
    ))
    story.append(Spacer(1, 8))

    # ------------------------------------------ Section 6: Migration Plan
    story.extend(section_heading("6", "Migration Plan: Stripe → Nuvei", styles))
    story.append(Paragraph(
        "Once a licence is secured, the technical migration from Stripe to Nuvei is "
        "straightforward due to the platform's architecture. The double-entry ledger, escrow "
        "system, and game logic are entirely payment-processor-agnostic. Only the thin "
        "integration layer changes.",
        styles["body"],
    ))
    story.append(Spacer(1, 6))
    story.append(build_migration_table(styles))
    story.append(Spacer(1, 8))
    story.append(callout_box(
        "<b>Estimated effort: 1 week of development work.</b> The ledger, escrow, game logic, "
        "and session management layers require no changes. Only the payment integration layer "
        "and its associated UI component are replaced.",
        styles,
        bg=HexColor("#F0FDF4"),
        border=HexColor("#16A34A"),
    ))
    story.append(Spacer(1, 8))

    # ------------------------------------------- Section 7: Interim Strategy
    story.extend(section_heading("7", "Interim Strategy (Pre-Licence)", styles))
    story.append(Paragraph(
        "For investor demonstrations and platform testing prior to obtaining a gambling licence, "
        "the following approach is recommended:",
        styles["body"],
    ))
    story.append(Spacer(1, 4))

    bullets = [
        "Use Stripe in <b>test mode</b> with realistic transaction flows to demonstrate product mechanics.",
        "Set low deposit limits (£10–£50) in configuration to limit exposure during any soft-launch testing.",
        "Restrict registration to invite-only or specific email addresses.",
        "Do not process real money until a gambling licence is obtained.",
        "Frame investor demos around the product mechanics, architecture, and licensing roadmap — not live transactions.",
    ]
    for b in bullets:
        story.append(Paragraph(f"\u2022  {b}", styles["bullet"]))

    story.append(Spacer(1, 8))
    story.append(callout_box(
        "<b>Important:</b> Any real-money transaction flow — even small amounts — without a "
        "valid gambling licence creates legal and regulatory exposure. Stripe test mode provides "
        "a safe, realistic environment for all pre-licence demonstrations.",
        styles,
        bg=HexColor("#FEF9C3"),
        border=HexColor("#CA8A04"),
    ))

    story.append(Spacer(1, 16))
    story.append(HRFlowable(width=CONTENT_W, thickness=0.5, color=MID_GREY))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "This document is confidential and intended solely for authorised recipients. "
        "PlayStake Ltd, April 2026.",
        ParagraphStyle(
            "footer_note",
            fontName="Helvetica",
            fontSize=8,
            textColor=DARK_GREY,
            alignment=TA_CENTER,
        ),
    ))

    doc.build(story)
    print(f"PDF generated: {output_path}")
    return output_path


if __name__ == "__main__":
    build_document()
