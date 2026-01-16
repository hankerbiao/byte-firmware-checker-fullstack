from pathlib import Path
from typing import Any, List, Tuple
import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageTemplate,
    Frame,
)

from app.core.config import settings


def register_fonts() -> Tuple[str, str]:
    """
    Registers fonts and returns (body_font_name, title_font_name).
    Prioritizes custom font, then STSong-Light, then Helvetica.
    """
    font_name = "CNBody"
    title_font_name = "CNTitle"
    font_path = settings.FWAUDIT_PDF_FONT_PATH
    registered = False

    if font_path and Path(font_path).is_file():
        try:
            pdfmetrics.registerFont(TTFont(font_name, font_path))
            # We use the same font for title if only one is provided
            pdfmetrics.registerFont(TTFont(title_font_name, font_path))
            registered = True
        except Exception:
            registered = False

    if not registered:
        try:
            base_cjk_font = "STSong-Light"
            pdfmetrics.registerFont(UnicodeCIDFont(base_cjk_font))
            font_name = base_cjk_font
            title_font_name = base_cjk_font
            registered = True
        except Exception:
            registered = False

    if not registered:
        font_name = "Helvetica"
        title_font_name = "Helvetica-Bold"

    return font_name, title_font_name


def generate_audit_report_pdf_file(audit_id: str, report: dict[str, Any]) -> str:
    report_dir = Path(settings.FWAUDIT_REPORT_DIR)
    report_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = report_dir / f"{audit_id}.pdf"

    if pdf_path.is_file():
        return str(pdf_path)

    body_font, title_font = register_fonts()

    # --- Styles ---
    styles = getSampleStyleSheet()

    # Define custom colors
    color_dark_blue = colors.HexColor('#1A365D')
    color_text_primary = colors.HexColor('#2D3748')
    color_text_secondary = colors.HexColor('#718096')
    color_border = colors.HexColor('#E2E8F0')
    color_bg_header = colors.HexColor('#F7FAFC')

    style_title = ParagraphStyle(
        name='AuditTitle',
        parent=styles['Title'],
        fontName=title_font,
        fontSize=22,
        leading=28,
        alignment=TA_CENTER,
        textColor=color_dark_blue,
        spaceAfter=5 * mm
    )

    style_subtitle = ParagraphStyle(
        name='AuditSubtitle',
        parent=styles['Normal'],
        fontName="Helvetica",
        fontSize=12,
        alignment=TA_CENTER,
        textColor=color_text_secondary,
        spaceAfter=15 * mm
    )

    style_h2 = ParagraphStyle(
        name='AuditH2',
        parent=styles['Heading2'],
        fontName=title_font,
        fontSize=14,
        leading=18,
        textColor=color_dark_blue,
        spaceBefore=12,
        spaceAfter=8,
    )

    style_normal = ParagraphStyle(
        name='AuditNormal',
        parent=styles['Normal'],
        fontName=body_font,
        fontSize=10,
        leading=14,
        textColor=color_text_primary,
    )

    style_table_header = ParagraphStyle(
        name='TableHeader',
        parent=style_normal,
        fontName=title_font,
        fontSize=10,
        textColor=colors.white,
        alignment=TA_CENTER
    )

    style_check_name = ParagraphStyle(
        name='CheckName',
        parent=style_normal,
        fontName=title_font,
        fontSize=10.5,
        textColor=color_text_primary,
        spaceAfter=2
    )

    style_check_desc = ParagraphStyle(
        name='CheckDesc',
        parent=style_normal,
        fontSize=9,
        textColor=color_text_secondary,
        leading=12
    )

    # --- Document Setup ---
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    def header_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 9)
        canvas.setFillColor(color_text_secondary)
        page_num_text = f"Page {doc.page}"
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, page_num_text)
        canvas.drawString(15 * mm, 10 * mm, "ByteDance Firmware Compliance Audit")
        
        # Draw a decorative line at top
        canvas.setStrokeColor(color_dark_blue)
        canvas.setLineWidth(1)
        canvas.line(15 * mm, A4[1] - 15 * mm, A4[0] - 15 * mm, A4[1] - 15 * mm)
        
        canvas.restoreState()

    story = []

    # 1. Title Section
    story.append(Paragraph("字节固件合规审计报告", style_title))
    story.append(Paragraph("ByteDance Firmware Compliance Audit Report", style_subtitle))

    # 2. Metadata Table
    report_id = str(report.get("id", ""))

    def format_timestamp(value: str) -> str:
        if not value:
            return ""
        raw = value
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        try:
            dt = datetime.datetime.fromisoformat(raw)
        except Exception:
            return value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        dt_local = dt.astimezone(datetime.timezone(datetime.timedelta(hours=8)))
        return dt_local.strftime("%Y-%m-%d %H:%M:%S")

    timestamp = str(report.get("timestamp", ""))
    firmware_type = str(report.get("firmwareType", ""))
    product_name = str(report.get("productName", ""))
    version = str(report.get("version", ""))

    meta_data = [
        ["审计任务 ID / Audit ID", report_id],
        ["审计时间 / Timestamp", timestamp],
        ["固件类型 / Type", firmware_type],
        ["产品名称 / Product", product_name],
        ["版本号 / Version", version],
    ]

    meta_table_rows = []
    for k, v in meta_data:
        meta_table_rows.append([
            Paragraph(k, ParagraphStyle('MetaKey', parent=style_normal, fontName=title_font, alignment=TA_RIGHT, textColor=color_text_secondary)),
            Paragraph(v, style_normal)
        ])

    t_meta = Table(meta_table_rows, colWidths=[60 * mm, 110 * mm], hAlign='CENTER')
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), color_bg_header),
        ('GRID', (0, 0), (-1, -1), 0.5, color_border),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))

    story.append(Paragraph("审计元信息 / Audit Information", style_h2))
    story.append(t_meta)
    story.append(Spacer(1, 8 * mm))

    # 3. Summary Section
    summary = report.get("summary") or {}
    total = str(summary.get("total", 0))
    passed = str(summary.get("passed", 0))
    warning = str(summary.get("warning", 0))
    failed = str(summary.get("failed", 0))

    # Styles for stats
    style_num_base = ParagraphStyle('NumBase', parent=style_normal, fontSize=16, alignment=TA_CENTER, fontName=title_font, spaceBefore=4)
    style_num_total = ParagraphStyle('NumTotal', parent=style_num_base, textColor=colors.HexColor('#2B6CB0'))
    style_num_pass = ParagraphStyle('NumPass', parent=style_num_base, textColor=colors.HexColor('#2F855A'))
    style_num_warn = ParagraphStyle('NumWarn', parent=style_num_base, textColor=colors.HexColor('#C05621'))
    style_num_fail = ParagraphStyle('NumFail', parent=style_num_base, textColor=colors.HexColor('#C53030'))

    summary_table_data = [
        [
            Paragraph("总检查项", style_table_header),
            Paragraph("合规项", style_table_header),
            Paragraph("警告", style_table_header),
            Paragraph("错误", style_table_header)
        ],
        [
            Paragraph(total, style_num_total),
            Paragraph(passed, style_num_pass),
            Paragraph(warning, style_num_warn),
            Paragraph(failed, style_num_fail)
        ]
    ]

    t_summary = Table(summary_table_data, colWidths=[42 * mm] * 4, hAlign='CENTER')
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#4299E1')), # Blue
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#48BB78')), # Green
        ('BACKGROUND', (2, 0), (2, 0), colors.HexColor('#ED8936')), # Orange
        ('BACKGROUND', (3, 0), (3, 0), colors.HexColor('#F56565')), # Red
        ('BACKGROUND', (0, 1), (-1, 1), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, color_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, color_border),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))

    story.append(Paragraph("审计概览 / Audit Summary", style_h2))
    story.append(t_summary)
    story.append(Spacer(1, 8 * mm))

    # 4. Detailed Checks Section
    checks = report.get("checks") or []

    indexed_checks: List[tuple[int, dict[str, Any]]] = [
        (idx + 1, c) for idx, c in enumerate(checks)
    ]

    warning_checks: List[tuple[int, dict[str, Any]]] = [
        (index, c)
        for index, c in indexed_checks
        if str(c.get("status", "")).upper() == "WARNING"
    ]
    failed_checks: List[tuple[int, dict[str, Any]]] = [
        (index, c)
        for index, c in indexed_checks
        if str(c.get("status", "")).upper() == "FAIL"
    ]

    def build_issue_table(issue_checks: List[tuple[int, dict[str, Any]]], title_text: str):
        if not issue_checks:
            return

        story.append(Paragraph(title_text, style_h2))

        table_data = [[
            Paragraph("序号/No.", style_table_header),
            Paragraph("类别/Category", style_table_header),
            Paragraph("检查内容/Details", style_table_header),
        ]]

        row_styles_local: List[Tuple[Any, ...]] = []

        for row_idx, (index_value, check) in enumerate(issue_checks, start=1):
            category = str(check.get("category", ""))
            name = str(check.get("name", ""))
            description = check.get("description", "")
            standard = check.get("standard", "")

            category_para = Paragraph(category, ParagraphStyle(
                'WarnErrCategoryCell',
                parent=style_normal,
                alignment=TA_CENTER,
                textColor=color_text_secondary,
                fontSize=9
            ))

            index_para = Paragraph(str(index_value), ParagraphStyle(
                'WarnErrIndexCell',
                parent=style_normal,
                alignment=TA_CENTER,
                textColor=color_text_secondary,
                fontSize=9
            ))

            details_flowables: List[Any] = [Paragraph(name, style_check_name)]
            if description:
                details_flowables.append(Paragraph(description, style_check_desc))
            if standard:
                details_flowables.append(Spacer(1, 1.5 * mm))
                details_flowables.append(Paragraph(f"<b>规范/Standard:</b> {standard}", style_check_desc))

            table_data.append([
                index_para,
                category_para,
                details_flowables,
            ])

            row_styles_local.append(('LINEBELOW', (0, row_idx), (-1, row_idx), 0.5, color_border))

        t_issues = Table(
            table_data,
            colWidths=[18 * mm, 35 * mm, 122 * mm],
            hAlign='CENTER'
        )

        table_style_list_local: List[Tuple[Any, ...]] = [
            ('BACKGROUND', (0, 0), (-1, 0), color_dark_blue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]
        table_style_list_local.extend(row_styles_local)
        t_issues.setStyle(TableStyle(table_style_list_local))

        story.append(t_issues)
        story.append(Spacer(1, 6 * mm))

    if warning_checks:
        build_issue_table(warning_checks, "警告项概览 / Warning Items")

    if failed_checks:
        build_issue_table(failed_checks, "错误项概览 / Error Items")

    story.append(Paragraph("详细检查项 / Detailed Checks", style_h2))

    check_table_data = [[
        Paragraph("序号/No.", style_table_header),
        Paragraph("状态/Status", style_table_header),
        Paragraph("类别/Category", style_table_header),
        Paragraph("检查内容/Details", style_table_header),
    ]]

    # Helper for status colors
    def get_status_props(s):
        if s == "PASS":
            return colors.HexColor('#F0FFF4'), colors.HexColor('#22543D'), "通过"
        if s == "WARNING":
            return colors.HexColor('#FFFAF0'), colors.HexColor('#9C4221'), "警告"
        if s == "FAIL":
            return colors.HexColor('#FFF5F5'), colors.HexColor('#9B2C2C'), "错误"
        return colors.white, color_text_primary, s

    row_styles = []
    
    for i, check in enumerate(checks):
        status = str(check.get("status", ""))
        category = str(check.get("category", ""))
        name = str(check.get("name", ""))
        description = check.get("description", "")
        standard = check.get("standard", "")

        bg_color, text_color, status_label = get_status_props(status)

        index_para = Paragraph(str(i + 1), ParagraphStyle(
            'CheckIndexCell',
            parent=style_normal,
            alignment=TA_CENTER,
            textColor=color_text_secondary,
            fontSize=9,
        ))

        status_para = Paragraph(status_label, ParagraphStyle(
            'StatusCell', parent=style_normal, alignment=TA_CENTER, textColor=text_color, fontName=title_font
        ))
        
        category_para = Paragraph(category, ParagraphStyle(
            'CategoryCell', parent=style_normal, alignment=TA_CENTER, textColor=color_text_secondary, fontSize=9
        ))

        details_flowables = [Paragraph(name, style_check_name)]
        if description:
            details_flowables.append(Paragraph(description, style_check_desc))
        if standard:
            details_flowables.append(Spacer(1, 1.5 * mm))
            details_flowables.append(Paragraph(f"<b>规范/Standard:</b> {standard}", style_check_desc))

        check_table_data.append([
            index_para,
            status_para,
            category_para,
            details_flowables
        ])

        row_idx = i + 1
        row_styles.append(('BACKGROUND', (1, row_idx), (1, row_idx), bg_color))
        row_styles.append(('LINEBELOW', (0, row_idx), (-1, row_idx), 0.5, color_border))

    t_checks = Table(
        check_table_data,
        colWidths=[15 * mm, 25 * mm, 35 * mm, 100 * mm],
        repeatRows=1,
        hAlign='CENTER'
    )
    
    table_style_list = [
        ('BACKGROUND', (0, 0), (-1, 0), color_dark_blue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]
    table_style_list.extend(row_styles)
    t_checks.setStyle(TableStyle(table_style_list))

    story.append(t_checks)

    # Build the PDF
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)

    return str(pdf_path)
