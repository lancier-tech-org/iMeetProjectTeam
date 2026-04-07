# core/super_adminDashboard/invoice_generator.py

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from django.db import models
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, KeepTogether
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfgen import canvas
from django.utils import timezone as dj_timezone
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Professional Blue Color Scheme
BRAND_BLUE = colors.HexColor('#1e5a96')  # Deep professional blue
LIGHT_BLUE = colors.HexColor('#d0e1f3')  # Light blue for table headers
TABLE_BORDER = colors.HexColor('#a0b8d1')  # Border color
TEXT_DARK = colors.HexColor('#2c3e50')
TEXT_GRAY = colors.HexColor('#5a6c7d')

class Invoice(models.Model):
    id = models.AutoField(primary_key=True)
    invoice_number = models.CharField(max_length=100, unique=True)
    transaction_id = models.ForeignKey(
        'core.PaymentTransaction', on_delete=models.CASCADE, db_column='transaction_id',
        related_name='invoices'
    )
    user_id = models.ForeignKey(
        'core.User', on_delete=models.CASCADE, db_column='user_id',
        related_name='invoices'
    )
    customer_name = models.CharField(max_length=100)
    customer_email = models.CharField(max_length=100)
    customer_state = models.CharField(max_length=100)
    plan_name = models.CharField(max_length=50)
    plan_type = models.CharField(max_length=10)
    billing_period = models.CharField(max_length=10)
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    gst_type = models.CharField(max_length=12)
    cgst = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    sgst = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    igst = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    invoice_s3_url = models.CharField(max_length=500)
    invoice_mongodb_id = models.CharField(max_length=50)
    invoice_status = models.CharField(max_length=10, default='GENERATED')
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=dj_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_invoices'
        app_label = 'core'


def create_invoices_table():
    """Create tbl_invoices table with all required columns and indexes"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tbl_invoices (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    invoice_number VARCHAR(100) NOT NULL UNIQUE COMMENT 'Unique invoice number (e.g., iMeetPro-INV-2026-01-0007)',
                    transaction_id INT NOT NULL COMMENT 'Foreign key to tbl_payment_transactions',
                    user_id INT NOT NULL COMMENT 'Foreign key to tbl_Users',
                    customer_name VARCHAR(100) NOT NULL,
                    customer_email VARCHAR(100) NOT NULL,
                    customer_state VARCHAR(100) NOT NULL COMMENT 'Customer billing state for GST',
                    plan_name VARCHAR(50) NOT NULL,
                    plan_type ENUM('basic','pro','pro_max') NOT NULL,
                    billing_period ENUM('monthly','yearly') NOT NULL,
                    base_price DECIMAL(10,2) NOT NULL COMMENT 'Price before GST',
                    gst_rate DECIMAL(5,2) NOT NULL COMMENT 'GST percentage applied',
                    gst_amount DECIMAL(10,2) NOT NULL COMMENT 'GST amount',
                    total_price DECIMAL(10,2) NOT NULL COMMENT 'Total with GST',
                    currency VARCHAR(3) DEFAULT 'INR',
                    gst_type ENUM('INTRASTATE','INTERSTATE') NOT NULL COMMENT 'Type of GST applied',
                    cgst DECIMAL(10,2) DEFAULT 0.00 COMMENT 'CGST amount (intrastate only)',
                    sgst DECIMAL(10,2) DEFAULT 0.00 COMMENT 'SGST amount (intrastate only)',
                    igst DECIMAL(10,2) DEFAULT 0.00 COMMENT 'IGST amount (interstate only)',
                    invoice_s3_url VARCHAR(500) NOT NULL COMMENT 'S3 path to PDF file',
                    invoice_mongodb_id VARCHAR(50) NOT NULL COMMENT 'MongoDB ObjectId for full invoice data',
                    invoice_status ENUM('GENERATED','EMAILED','FAILED') DEFAULT 'GENERATED',
                    email_sent TINYINT(1) DEFAULT 0 COMMENT '1 if email sent successfully',
                    email_sent_at DATETIME DEFAULT NULL COMMENT 'When email was sent',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    KEY idx_transaction_id (transaction_id),
                    KEY idx_user_id (user_id),
                    KEY idx_invoice_number (invoice_number),
                    KEY idx_invoice_status (invoice_status),
                    KEY idx_created_at (created_at),
                    KEY idx_customer_email (customer_email),
                    CONSTRAINT tbl_invoices_ibfk_1 FOREIGN KEY (transaction_id) REFERENCES tbl_payment_transactions (id) ON DELETE CASCADE,
                    CONSTRAINT tbl_invoices_ibfk_2 FOREIGN KEY (user_id) REFERENCES tbl_Users (ID) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores invoice metadata and references to S3/MongoDB'
            """)
            logging.debug("tbl_invoices table created successfully")
    except (ProgrammingError, OperationalError) as e:
        logging.error(f"Failed to create tbl_invoices table: {e}")

def generate_gst_invoice(transaction_data, order_data, plan_data, company_data, gst_breakdown, invoice_number, output_path):
    """
    Generate GST-compliant professional invoice PDF with modern blue theme
    
    Args:
        transaction_data: Dictionary containing transaction details
        order_data: Dictionary containing order and customer details
        plan_data: Dictionary containing plan and pricing details
        company_data: Dictionary containing company details
        gst_breakdown: Dictionary containing GST calculation {gst_type, cgst, sgst, igst}
        invoice_number: Invoice number (e.g., "INV-456")
        output_path: Full path where PDF should be saved
    
    Returns:
        str: Path to generated PDF file
    """
    try:
        # Create PDF document
        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40,
        )
        
        # Container for flowable objects
        elements = []
        
        # Define styles
        styles = getSampleStyleSheet()
        
        # Custom styles
        company_name_style = ParagraphStyle(
            'CompanyName',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=BRAND_BLUE,
            spaceAfter=2,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold',
            leftIndent=0,
        )
        
        date_style = ParagraphStyle(
            'DateStyle',
            parent=styles['Normal'],
            fontSize=11,
            textColor=BRAND_BLUE,
            spaceAfter=20,
            alignment=TA_LEFT,
            fontName='Helvetica',
        )
        
        invoice_title_style = ParagraphStyle(
            'InvoiceTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=BRAND_BLUE,
            spaceAfter=12,
            spaceBefore=8,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold',
        )
        
        section_label_style = ParagraphStyle(
            'SectionLabel',
            parent=styles['Normal'],
            fontSize=9,
            textColor=TEXT_GRAY,
            spaceAfter=2,
            fontName='Helvetica-Bold',
        )
        
        section_value_style = ParagraphStyle(
            'SectionValue',
            parent=styles['Normal'],
            fontSize=9,
            textColor=TEXT_DARK,
            spaceAfter=4,
            fontName='Helvetica',
        )
        
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=11,
            textColor=BRAND_BLUE,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
            spaceAfter=10,
        )
        
        footer_small_style = ParagraphStyle(
            'FooterSmall',
            parent=styles['Normal'],
            fontSize=8,
            textColor=TEXT_GRAY,
            alignment=TA_CENTER,
            fontName='Helvetica',
        )
        
        # ==================== HEADER WITH BLUE LINE ====================
        
        # Company Name with blue left border effect
        company_header = Table(
            [[Paragraph(f"<b>{company_data['Company_Trade_Name'].upper()}</b>", company_name_style)]],
            colWidths=[7*inch]
        )
        company_header.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (0, 0), 4, BRAND_BLUE),
            ('LEFTPADDING', (0, 0), (0, 0), 8),
            ('BOTTOMPADDING', (0, 0), (0, 0), 2),
            ('TOPPADDING', (0, 0), (0, 0), 8),
        ]))
        elements.append(company_header)
        
        # Invoice Date
        invoice_date = datetime.now().strftime('%B %d, %Y')
        date_para = Paragraph(invoice_date, date_style)
        elements.append(date_para)
        
        # ==================== INVOICE NUMBER ====================
        
        invoice_title = Paragraph(f"<b>INVOICE {invoice_number}</b>", invoice_title_style)
        elements.append(invoice_title)
        elements.append(Spacer(1, 8))
        
        # ==================== BILL TO / SHIP TO TABLE ====================
        
        # Prepare billing information
        bill_to_content = [
            [Paragraph("<b>Bill to</b>", section_label_style), Paragraph("<b>Ship to</b>", section_label_style)],
            [
                Table([
                    [Paragraph("<b>Customer</b>", section_label_style), Paragraph(order_data['Name'], section_value_style)],
                    [Paragraph("<b>Customer ID#</b>", section_label_style), Paragraph(f"{order_data.get('User_ID', 'N/A')}", section_value_style)],
                    [Paragraph("<b>Address</b>", section_label_style), 
                     Paragraph(f"{order_data['Address_Line1']}, {order_data['City']}", section_value_style)],
                    [Paragraph("<b>Phone</b>", section_label_style), Paragraph(order_data['Mobile_Number'], section_value_style)],
                ], colWidths=[1*inch, 2*inch]),
                
                Table([
                    [Paragraph("<b>Recipient</b>", section_label_style), Paragraph(order_data['Name'], section_value_style)],
                    [Paragraph("<b>Address</b>", section_label_style), 
                     Paragraph(f"{order_data['Address_Line1']}, {order_data['City']}", section_value_style)],
                    [Paragraph("<b>Phone</b>", section_label_style), Paragraph(order_data['Mobile_Number'], section_value_style)],
                    [Paragraph("<b>Email</b>", section_label_style), Paragraph(order_data['Email'], section_value_style)],
                ], colWidths=[1*inch, 2*inch]),
            ],
            [
                Table([
                    [Paragraph("<b>Payment Due</b>", section_label_style), 
                     Paragraph(datetime.now().strftime('%B %d, %Y'), section_value_style)],
                    [Paragraph("<b>Payment Status</b>", section_label_style), 
                     Paragraph(transaction_data.get('Payment_Status', 'CAPTURED'), section_value_style)],
                    [Paragraph("<b>Payment Terms</b>", section_label_style), 
                     Paragraph("Paid Online", section_value_style)],
                ], colWidths=[1.2*inch, 1.8*inch]),
                
                Table([
                    [Paragraph("<b>Invoice Date</b>", section_label_style), 
                     Paragraph(invoice_date, section_value_style)],
                    [Paragraph("<b>Transaction ID</b>", section_label_style), 
                     Paragraph(transaction_data.get('Razorpay_Payment_ID', 'N/A')[:20], section_value_style)],
                    [Paragraph("<b>GST Treatment</b>", section_label_style), 
                     Paragraph(gst_breakdown['gst_type'], section_value_style)],
                ], colWidths=[1.2*inch, 1.8*inch]),
            ]
        ]
        
        bill_ship_table = Table(bill_to_content, colWidths=[3.5*inch, 3.5*inch])
        bill_ship_table.setStyle(TableStyle([
            # Header row background
            ('BACKGROUND', (0, 0), (-1, 0), LIGHT_BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), TEXT_DARK),
            
            # Grid and borders
            ('GRID', (0, 0), (-1, -1), 0.5, TABLE_BORDER),
            ('BOX', (0, 0), (-1, -1), 1, TABLE_BORDER),
            
            # Alignment and padding
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        elements.append(bill_ship_table)
        elements.append(Spacer(1, 15))
        
        # ==================== LINE ITEMS TABLE ====================
        
        # HSN/SAC Code for IT Software Services
        hsn_sac_code = "998314"
        
        # Determine table structure based on GST type
        if gst_breakdown['gst_type'] == 'INTRASTATE':
            # INTRASTATE: Show CGST and SGST
            line_items_data = [
                ['Qty.', 'Item#', 'Description', 'Unit price', 'CGST\n@9%', 'SGST\n@9%', 'Line total'],
                [
                    '1',
                    hsn_sac_code,
                    f"{plan_data['Plan_Name']}\n({plan_data.get('Billing_Period', 'Monthly')} Subscription)",
                    f"{float(plan_data['base_price']):.2f}",
                    f"{gst_breakdown['cgst']:.2f}",
                    f"{gst_breakdown['sgst']:.2f}",
                    f"{float(plan_data['total_price']):.2f}"
                ]
            ]
            col_widths = [0.5*inch, 0.7*inch, 2.5*inch, 1*inch, 0.8*inch, 0.8*inch, 1*inch]
        else:
            # INTERSTATE: Show IGST only
            line_items_data = [
                ['Qty.', 'Item#', 'Description', 'Unit price', 'IGST\n@18%', 'Line total'],
                [
                    '1',
                    hsn_sac_code,
                    f"{plan_data['Plan_Name']}\n({plan_data.get('Billing_Period', 'Monthly')} Subscription)",
                    f"{float(plan_data['base_price']):.2f}",
                    f"{gst_breakdown['igst']:.2f}",
                    f"{float(plan_data['total_price']):.2f}"
                ]
            ]
            col_widths = [0.5*inch, 0.7*inch, 2.8*inch, 1*inch, 1*inch, 1*inch]
        
        # Add empty rows for spacing (matching the template)
        for _ in range(3):
            if gst_breakdown['gst_type'] == 'INTRASTATE':
                line_items_data.append(['', '', '', '', '', '', ''])
            else:
                line_items_data.append(['', '', '', '', '', ''])
        
        line_items_table = Table(line_items_data, colWidths=col_widths)
        line_items_table.setStyle(TableStyle([
            # Header row styling
            ('BACKGROUND', (0, 0), (-1, 0), LIGHT_BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), TEXT_DARK),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            
            # Data row styling
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (0, 1), (1, -1), 'CENTER'),  # Qty and Item# centered
            ('ALIGN', (2, 1), (2, -1), 'LEFT'),    # Description left
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),  # Prices right-aligned
            
            # Grid and borders
            ('GRID', (0, 0), (-1, -1), 0.5, TABLE_BORDER),
            ('BOX', (0, 0), (-1, -1), 1, TABLE_BORDER),
            ('LINEBELOW', (0, 0), (-1, 0), 1, TABLE_BORDER),
            
            # Padding
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        elements.append(line_items_table)
        elements.append(Spacer(1, 2))
        
        # ==================== TOTALS TABLE ====================
        
        total_amount = float(plan_data['total_price'])
        base_amount = float(plan_data['base_price'])
        
        # Create totals table
        if gst_breakdown['gst_type'] == 'INTRASTATE':
            totals_data = [
                ['', '', '', '', '', 'Total GST', f"{gst_breakdown['cgst'] + gst_breakdown['sgst']:.2f}"],
                ['', '', '', '', '', 'Subtotal', f"{base_amount:.2f}"],
                ['', '', '', '', '', 'Total', f"{total_amount:.2f}"],
            ]
            col_widths_totals = [0.5*inch, 0.7*inch, 2.5*inch, 1*inch, 0.8*inch, 0.8*inch, 1*inch]
        else:
            totals_data = [
                ['', '', '', '', 'Total GST', f"{gst_breakdown['igst']:.2f}"],
                ['', '', '', '', 'Subtotal', f"{base_amount:.2f}"],
                ['', '', '', '', 'Total', f"{total_amount:.2f}"],
            ]
            col_widths_totals = [0.5*inch, 0.7*inch, 2.8*inch, 1*inch, 1*inch, 1*inch]
        
        totals_table = Table(totals_data, colWidths=col_widths_totals)
        totals_table.setStyle(TableStyle([
            # Text styling
            ('FONTNAME', (0, 0), (-1, -2), 'Helvetica'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),  # Total row bold
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (-1, -1), TEXT_DARK),
            
            # Alignment
            ('ALIGN', (-2, 0), (-2, -1), 'RIGHT'),  # Labels right-aligned
            ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),  # Values right-aligned
            
            # Total row background
            ('BACKGROUND', (0, -1), (-1, -1), LIGHT_BLUE),
            
            # Borders - only for total row and right columns
            ('BOX', (-2, 0), (-1, -1), 1, TABLE_BORDER),
            ('LINEABOVE', (-2, -1), (-1, -1), 2, BRAND_BLUE),
            ('GRID', (-2, 0), (-1, -1), 0.5, TABLE_BORDER),
            
            # Padding
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        
        elements.append(totals_table)
        elements.append(Spacer(1, 20))
        
        # ==================== AMOUNT IN WORDS ====================
        
        amount_in_words = number_to_words_indian(int(total_amount))
        amount_words_para = Paragraph(f"<b>Amount in Words:</b> {amount_in_words}", section_value_style)
        elements.append(amount_words_para)
        elements.append(Spacer(1, 15))
        
        # ==================== GST & COMPANY DETAILS ====================
        
        gst_details = f"""
        <b>GST Details:</b> GSTIN: {company_data['GSTIN']} | 
        Company: {company_data['Company_Legal_Name']} | 
        Address: {company_data['Address_Line1']}, {company_data['City']}, {company_data['State']} - {company_data['Pincode']}
        """
        
        gst_para = Paragraph(gst_details, footer_small_style)
        elements.append(gst_para)
        elements.append(Spacer(1, 20))
        
        # ==================== FOOTER ====================
        
        footer_thank_you = Paragraph("<b>Thank you for your business!</b>", footer_style)
        elements.append(footer_thank_you)
        elements.append(Spacer(1, 8))
        
        footer_company = f"""
        <b>{company_data['Company_Trade_Name']}</b><br/>
        {company_data['Address_Line1']}, {company_data['City']} | {company_data.get('Website', 'www.example.com')}<br/>
        p. {company_data['Phone']} | f. {company_data['Email']} | {company_data.get('Website', '')}
        """
        
        footer_para = Paragraph(footer_company, footer_small_style)
        elements.append(footer_para)
        
        # ==================== LEGAL FOOTER ====================
        
        elements.append(Spacer(1, 10))
        legal_text = f"""
        <i>This is a computer-generated invoice. No signature required. | 
        For queries: {company_data['Email']}</i>
        """
        
        legal_para = Paragraph(legal_text, footer_small_style)
        elements.append(legal_para)
        
        # Build PDF
        doc.build(elements)
        
        logger.info(f"GST invoice generated successfully: {output_path}")
        return output_path
        
    except Exception as e:
        logger.error(f"Error generating GST invoice PDF: {e}", exc_info=True)
        raise


def number_to_words_indian(number):
    """
    Convert number to words in Indian format
    
    Args:
        number: Integer amount
    
    Returns:
        str: Amount in words (e.g., "Rupees One Thousand One Hundred Eighty Only")
    """
    try:
        if number == 0:
            return "Rupees Zero Only"
        
        # Arrays for number to word conversion
        ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
        teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
        
        def convert_below_thousand(num):
            if num == 0:
                return ""
            elif num < 10:
                return ones[num]
            elif num < 20:
                return teens[num - 10]
            elif num < 100:
                return tens[num // 10] + (" " + ones[num % 10] if num % 10 != 0 else "")
            else:
                return ones[num // 100] + " Hundred" + (" " + convert_below_thousand(num % 100) if num % 100 != 0 else "")
        
        if number < 1000:
            result = convert_below_thousand(number)
        elif number < 100000:
            thousands = number // 1000
            remainder = number % 1000
            result = convert_below_thousand(thousands) + " Thousand"
            if remainder > 0:
                result += " " + convert_below_thousand(remainder)
        elif number < 10000000:
            lakhs = number // 100000
            remainder = number % 100000
            result = convert_below_thousand(lakhs) + " Lakh"
            if remainder >= 1000:
                result += " " + convert_below_thousand(remainder // 1000) + " Thousand"
                remainder = remainder % 1000
            if remainder > 0:
                result += " " + convert_below_thousand(remainder)
        else:
            crores = number // 10000000
            remainder = number % 10000000
            result = convert_below_thousand(crores) + " Crore"
            if remainder >= 100000:
                result += " " + convert_below_thousand(remainder // 100000) + " Lakh"
                remainder = remainder % 100000
            if remainder >= 1000:
                result += " " + convert_below_thousand(remainder // 1000) + " Thousand"
                remainder = remainder % 1000
            if remainder > 0:
                result += " " + convert_below_thousand(remainder)
        
        return f"Rupees {result} Only"
        
    except Exception as e:
        logger.error(f"Error converting number to words: {e}")
        return f"Rupees {number} Only"