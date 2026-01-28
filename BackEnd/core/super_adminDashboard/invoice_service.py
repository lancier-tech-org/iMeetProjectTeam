# core/super_adminDashboard/invoice_service.py

from django.db import connection, transaction
from django.conf import settings
from django.core.mail import EmailMessage
import boto3
from botocore.exceptions import ClientError
from pymongo import MongoClient
import os
import tempfile
import logging
from datetime import datetime
from core.super_adminDashboard.invoice_generator import generate_gst_invoice

# Configure logging
logging.basicConfig(
    filename='invoice_service_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(message)s'
)

# Global Variables
TBL_PAYMENT_TRANSACTIONS = 'tbl_payment_transactions'
TBL_PAYMENT_ORDERS = 'tbl_payment_orders'
TBL_PLANS = 'tbl_Plans'
TBL_COMPANY_DETAILS = 'tbl_company_details'
TBL_INVOICES = 'tbl_invoices'

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
AWS_S3_BUCKET = os.getenv('AWS_S3_BUCKET', 'connectly-storage')
S3_FOLDER_INVOICES = os.getenv('S3_FOLDER_INVOICES', 'invoices')

# MongoDB Configuration
MONGO_URI = os.getenv('MONGO_URI')
MONGO_DB = os.getenv('MONGO_DB', 'connectlydb')

# Initialize AWS S3 Client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

# Initialize MongoDB Client
mongo_client = MongoClient(MONGO_URI)
mongo_db = mongo_client[MONGO_DB]
invoice_collection = mongo_db['invoice_metadata']

def generate_invoice_number(company_data):
    """
    Generate invoice number in format: CompanyName-INV-YYYY-MM-NNNN
    Example: iMeetPro-INV-2026-01-0007
    
    Args:
        company_data: Dictionary containing company details
    
    Returns:
        str: Generated invoice number
    """
    try:
        # Extract company trade name and remove spaces/special chars
        company_name = company_data['Company_Trade_Name'].replace(' ', '').replace('-', '')
        
        # Get current year and month
        now = datetime.now()
        year = now.strftime('%Y')
        month = now.strftime('%m')
        
        # Query database to get next sequence number for this month
        with connection.cursor() as cursor:
            # Find the highest sequence number for current month
            cursor.execute(f"""
                SELECT invoice_number 
                FROM {TBL_INVOICES}
                WHERE invoice_number LIKE %s
                ORDER BY id DESC
                LIMIT 1
            """, [f"{company_name}-INV-{year}-{month}-%"])
            
            last_invoice = cursor.fetchone()
            
            if last_invoice:
                # Extract sequence from last invoice (e.g., "iMeetPro-INV-2026-01-0007" -> "0007")
                last_number = last_invoice[0].split('-')[-1]
                sequence = int(last_number) + 1
            else:
                # First invoice of the month
                sequence = 1
        
        # Format sequence with leading zeros (4 digits)
        sequence_str = str(sequence).zfill(4)
        
        # Generate final invoice number
        invoice_number = f"{company_name}-INV-{year}-{month}-{sequence_str}"
        
        logging.debug(f"Generated invoice number: {invoice_number}")
        return invoice_number
        
    except Exception as e:
        logging.error(f"Error generating invoice number: {e}", exc_info=True)
        # Fallback to timestamp-based number
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        return f"INV-{timestamp}"

def generate_and_send_invoice(transaction_id):
    """
    Main orchestrator function for invoice generation
    
    Args:
        transaction_id: Internal transaction ID from tbl_payment_transactions
    
    Returns:
        dict: Success/failure status with details
    """
    try:
        logging.info(f"Starting invoice generation for transaction_id: {transaction_id}")
        
        # Step 1: Fetch all required data from MySQL
        logging.debug("Step 1: Fetching data from MySQL")
        data = fetch_invoice_data(transaction_id)
        
        if not data:
            logging.error(f"Failed to fetch data for transaction_id: {transaction_id}")
            return {"success": False, "error": "Failed to fetch transaction data"}
        
        transaction_data = data['transaction']
        order_data = data['order']
        plan_data = data['plan']
        company_data = data['company']
        
        # Step 2: Calculate GST type (INTRASTATE vs INTERSTATE)
        logging.debug("Step 2: Calculating GST type")
        gst_breakdown = calculate_gst_breakdown(
            company_state=company_data['State'],
            customer_state=order_data['State'],
            gst_amount=float(plan_data['gst_amount'])
        )
        
        # Step 3: Generate invoice number with format: CompanyName-INV-YYYY-MM-NNNN
        invoice_number = generate_invoice_number(company_data)
        logging.debug(f"Step 3: Generated invoice number: {invoice_number}")
        
        # Step 4: Generate PDF in temporary location
        logging.debug("Step 4: Generating PDF")
        temp_pdf_path = generate_pdf_invoice(
            transaction_data,
            order_data,
            plan_data,
            company_data,
            gst_breakdown,
            invoice_number
        )
        
        if not temp_pdf_path:
            logging.error("Failed to generate PDF")
            return {"success": False, "error": "Failed to generate PDF"}
        
        # Step 5: Upload PDF to S3
        logging.debug("Step 5: Uploading PDF to S3")
        s3_url = upload_pdf_to_s3(temp_pdf_path, transaction_id)
        
        if not s3_url:
            logging.error("Failed to upload PDF to S3")
            return {"success": False, "error": "Failed to upload PDF to S3"}
        
        # Step 6: Store invoice metadata in MongoDB
        logging.debug("Step 6: Storing metadata in MongoDB")
        mongodb_id = store_invoice_in_mongodb(
            transaction_data,
            order_data,
            plan_data,
            company_data,
            gst_breakdown,
            invoice_number,
            s3_url
        )
        
        if not mongodb_id:
            logging.error("Failed to store invoice in MongoDB")
            return {"success": False, "error": "Failed to store in MongoDB"}
        
        # Step 7: Insert invoice record in MySQL (tbl_invoices)
        logging.debug("Step 7: Inserting into tbl_invoices")
        invoice_id = insert_invoice_record(
            invoice_number,
            transaction_data,
            order_data,
            plan_data,
            gst_breakdown,
            s3_url,
            mongodb_id
        )
        
        if not invoice_id:
            logging.error("Failed to insert invoice record in MySQL")
            return {"success": False, "error": "Failed to insert invoice record"}
        
        # Step 8: Update tbl_payment_transactions with references
        logging.debug("Step 8: Updating tbl_payment_transactions")
        update_transaction_with_invoice_refs(
            transaction_id,
            invoice_number,
            s3_url,
            mongodb_id
        )
        
        # Step 9: Send email with PDF attachment
        logging.debug("Step 9: Sending email")
        email_sent = send_invoice_email(
            order_data['Email'],
            order_data['Name'],
            invoice_number,
            transaction_data,
            s3_url,
            temp_pdf_path
        )
        
        # Step 10: Update MongoDB with email status
        if email_sent:
            logging.debug("Step 10: Updating MongoDB email status")
            update_mongodb_email_status(mongodb_id, order_data['Email'])
            
            # Update tbl_invoices with email status
            update_invoice_email_status(invoice_id)
        
        # Step 11: Cleanup temporary PDF file
        logging.debug("Step 11: Cleaning up temporary files")
        cleanup_temp_file(temp_pdf_path)
        
        logging.info(f"Invoice generation completed successfully: {invoice_number}")
        
        return {
            "success": True,
            "invoice_number": invoice_number,
            "invoice_id": invoice_id,
            "s3_url": s3_url,
            "mongodb_id": str(mongodb_id),
            "email_sent": email_sent
        }
        
    except Exception as e:
        logging.error(f"Error in invoice generation: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


def fetch_invoice_data(transaction_id):
    """Fetch all required data from MySQL tables"""
    try:
        with connection.cursor() as cursor:
            # Fetch transaction data
            cursor.execute(f"""
                SELECT id, razorpay_payment_id, order_id, razorpay_order_id, user_id,
                       amount, currency, payment_method, bank, vpa, payment_status,
                       created_at
                FROM {TBL_PAYMENT_TRANSACTIONS}
                WHERE id = %s
            """, [transaction_id])
            
            txn_row = cursor.fetchone()
            if not txn_row:
                logging.error(f"Transaction not found: {transaction_id}")
                return None
            
            transaction_data = dict(zip([
                'Transaction_ID', 'Razorpay_Payment_ID', 'Order_ID', 'Razorpay_Order_ID', 'User_ID',
                'Amount_Paise', 'Currency', 'Payment_Method', 'Bank', 'VPA', 'Payment_Status',
                'Created_At'
            ], txn_row))
            
            # Fetch order data (with customer address)
            cursor.execute(f"""
                SELECT id, razorpay_order_id, user_id, name, email, mobile_number,
                       purpose, reference_id, amount, currency,
                       address_line1, address_line2, city, state, pincode, country
                FROM {TBL_PAYMENT_ORDERS}
                WHERE id = %s
            """, [transaction_data['Order_ID']])
            
            order_row = cursor.fetchone()
            if not order_row:
                logging.error(f"Order not found: {transaction_data['Order_ID']}")
                return None
            
            order_data = dict(zip([
                'Order_ID', 'Razorpay_Order_ID', 'User_ID', 'Name', 'Email', 'Mobile_Number',
                'Purpose', 'Reference_ID', 'Amount_Paise', 'Currency',
                'Address_Line1', 'Address_Line2', 'City', 'State', 'Pincode', 'Country'
            ], order_row))
            
            # Parse reference_id to get plan_type and billing_period
            # Format: "PRO_MONTHLY" or "BASIC_YEARLY"
            reference_id = order_data['Reference_ID']
            parts = reference_id.split('_')
            plan_type = parts[0].lower()  # "pro" or "basic" or "pro_max"
            billing_period = parts[1].lower()  # "monthly" or "yearly"
            
            # Fetch plan data
            cursor.execute(f"""
                SELECT id, plan_name, plan_type, billing_period,
                       base_price, gst_rate, gst_amount, total_price, currency
                FROM {TBL_PLANS}
                WHERE plan_type = %s AND billing_period = %s AND is_active = 1
            """, [plan_type, billing_period])
            
            plan_row = cursor.fetchone()
            if not plan_row:
                logging.error(f"Plan not found: {plan_type}, {billing_period}")
                return None
            
            plan_data = dict(zip([
                'Plan_ID', 'Plan_Name', 'Plan_Type', 'Billing_Period',
                'base_price', 'gst_rate', 'gst_amount', 'total_price', 'Currency'
            ], plan_row))
            
            # Fetch company data
            cursor.execute(f"""
                SELECT id, company_legal_name, company_trade_name, gstin,
                       address_line1, address_line2, city, state, pincode, country,
                       email, phone, website,
                       bank_name, account_number, ifsc_code, account_holder_name
                FROM {TBL_COMPANY_DETAILS}
                WHERE is_active = 1
                LIMIT 1
            """)
            
            company_row = cursor.fetchone()
            if not company_row:
                logging.error("No active company details found")
                return None
            
            company_data = dict(zip([
                'Company_ID', 'Company_Legal_Name', 'Company_Trade_Name', 'GSTIN',
                'Address_Line1', 'Address_Line2', 'City', 'State', 'Pincode', 'Country',
                'Email', 'Phone', 'Website',
                'Bank_Name', 'Account_Number', 'IFSC_Code', 'Account_Holder_Name'
            ], company_row))
        
        logging.debug("Successfully fetched all invoice data from MySQL")
        
        return {
            'transaction': transaction_data,
            'order': order_data,
            'plan': plan_data,
            'company': company_data
        }
        
    except Exception as e:
        logging.error(f"Error fetching invoice data: {e}", exc_info=True)
        return None


def calculate_gst_breakdown(company_state, customer_state, gst_amount):
    """
    Calculate GST breakdown based on state comparison
    
    Returns:
        dict: {gst_type, cgst, sgst, igst}
    """
    try:
        if company_state == customer_state:
            # INTRASTATE - Split GST into CGST and SGST
            gst_type = "INTRASTATE"
            cgst = round(gst_amount / 2, 2)
            sgst = round(gst_amount / 2, 2)
            igst = 0.00
        else:
            # INTERSTATE - Full GST as IGST
            gst_type = "INTERSTATE"
            cgst = 0.00
            sgst = 0.00
            igst = round(gst_amount, 2)
        
        logging.debug(f"GST breakdown calculated: {gst_type}, CGST: {cgst}, SGST: {sgst}, IGST: {igst}")
        
        return {
            'gst_type': gst_type,
            'cgst': cgst,
            'sgst': sgst,
            'igst': igst
        }
        
    except Exception as e:
        logging.error(f"Error calculating GST breakdown: {e}", exc_info=True)
        return None


def generate_pdf_invoice(transaction_data, order_data, plan_data, company_data, gst_breakdown, invoice_number):
    """
    Generate PDF invoice in temporary location
    
    Returns:
        str: Path to temporary PDF file
    """
    try:
        # Create temporary file
        temp_dir = tempfile.gettempdir()
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        filename = f"invoice_{transaction_data['Transaction_ID']}_{timestamp}.pdf"
        temp_pdf_path = os.path.join(temp_dir, filename)
        
        logging.debug(f"Generating PDF at: {temp_pdf_path}")
        
        # Call invoice generator
        from .invoice_generator import generate_gst_invoice
        
        generate_gst_invoice(
            transaction_data=transaction_data,
            order_data=order_data,
            plan_data=plan_data,
            company_data=company_data,
            gst_breakdown=gst_breakdown,
            invoice_number=invoice_number,
            output_path=temp_pdf_path
        )
        
        logging.debug(f"PDF generated successfully at: {temp_pdf_path}")
        
        return temp_pdf_path
        
    except Exception as e:
        logging.error(f"Error generating PDF: {e}", exc_info=True)
        return None


def upload_pdf_to_s3(temp_pdf_path, transaction_id):
    """
    Upload PDF to S3 bucket
    
    Returns:
        str: S3 URL
    """
    try:
        # Generate S3 key with folder structure: invoices/YYYY/MM/invoice_xxx.pdf
        now = datetime.now()
        year = now.strftime('%Y')
        month = now.strftime('%m')
        timestamp = now.strftime('%Y%m%d%H%M%S')
        
        filename = f"invoice_{transaction_id}_{timestamp}.pdf"
        s3_key = f"{S3_FOLDER_INVOICES}/{year}/{month}/{filename}"
        
        logging.debug(f"Uploading to S3: Bucket={AWS_S3_BUCKET}, Key={s3_key}")
        
        # Upload file to S3
        s3_client.upload_file(
            Filename=temp_pdf_path,
            Bucket=AWS_S3_BUCKET,
            Key=s3_key,
            ExtraArgs={
                'ContentType': 'application/pdf',
                'ServerSideEncryption': 'AES256'
            }
        )
        
        # Generate S3 URL
        s3_url = f"s3://{AWS_S3_BUCKET}/{s3_key}"
        
        logging.debug(f"PDF uploaded successfully to: {s3_url}")
        
        return s3_url
        
    except ClientError as e:
        logging.error(f"S3 upload error: {e}", exc_info=True)
        return None
    except Exception as e:
        logging.error(f"Error uploading to S3: {e}", exc_info=True)
        return None


def store_invoice_in_mongodb(transaction_data, order_data, plan_data, company_data, gst_breakdown, invoice_number, s3_url):
    """
    Store complete invoice metadata in MongoDB
    
    Returns:
        ObjectId: MongoDB document ID
    """
    try:
        # Prepare invoice document
        invoice_document = {
            "invoice_number": invoice_number,
            "invoice_date": datetime.now().isoformat(),
            
            "transaction_id": transaction_data['Transaction_ID'],
            "razorpay_payment_id": transaction_data['Razorpay_Payment_ID'],
            "razorpay_order_id": transaction_data['Razorpay_Order_ID'],
            
            "user_id": transaction_data['User_ID'],
            
            "customer": {
                "name": order_data['Name'],
                "email": order_data['Email'],
                "mobile": order_data['Mobile_Number'],
                "address": {
                    "line1": order_data['Address_Line1'],
                    "line2": order_data['Address_Line2'],
                    "city": order_data['City'],
                    "state": order_data['State'],
                    "pincode": order_data['Pincode'],
                    "country": order_data['Country']
                }
            },
            
            "company": {
                "legal_name": company_data['Company_Legal_Name'],
                "trade_name": company_data['Company_Trade_Name'],
                "gstin": company_data['GSTIN'],
                "state": company_data['State'],
                "address": {
                    "line1": company_data['Address_Line1'],
                    "line2": company_data['Address_Line2'],
                    "city": company_data['City'],
                    "state": company_data['State'],
                    "pincode": company_data['Pincode'],
                    "country": company_data['Country']
                },
                "contact": {
                    "email": company_data['Email'],
                    "phone": company_data['Phone'],
                    "website": company_data['Website']
                },
                "bank_details": {
                    "bank_name": company_data['Bank_Name'],
                    "account_number": company_data['Account_Number'],
                    "ifsc_code": company_data['IFSC_Code'],
                    "account_holder_name": company_data['Account_Holder_Name']
                }
            },
            
            "plan": {
                "plan_id": plan_data['Plan_ID'],
                "plan_name": plan_data['Plan_Name'],
                "plan_type": plan_data['Plan_Type'],
                "billing_period": plan_data['Billing_Period'],
                "base_price": float(plan_data['base_price']),
                "gst_rate": float(plan_data['gst_rate']),
                "gst_amount": float(plan_data['gst_amount']),
                "total_price": float(plan_data['total_price']),
                "currency": plan_data['Currency']
            },
            
            "gst_details": {
                "gst_type": gst_breakdown['gst_type'],
                "company_state": company_data['State'],
                "customer_state": order_data['State'],
                "hsn_sac_code": "998314",  # IT Software Services
                "cgst": gst_breakdown['cgst'],
                "sgst": gst_breakdown['sgst'],
                "igst": gst_breakdown['igst']
            },
            
            "payment": {
                "payment_method": transaction_data['Payment_Method'],
                "payment_status": transaction_data['Payment_Status'],
                "amount_paise": transaction_data['Amount_Paise'],
                "amount_rupees": transaction_data['Amount_Paise'] / 100,
                "currency": transaction_data['Currency'],
                "payment_date": transaction_data['Created_At'].isoformat() if transaction_data['Created_At'] else None,
                "bank": transaction_data['Bank'],
                "vpa": transaction_data['VPA']
            },
            
            "s3_storage": {
                "bucket": AWS_S3_BUCKET,
                "s3_url": s3_url,
                "content_type": "application/pdf",
                "uploaded_at": datetime.now().isoformat()
            },
            
            "email": {
                "sent": False,
                "sent_to": order_data['Email'],
                "sent_at": None,
                "subject": None
            },
            
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Insert into MongoDB
        result = invoice_collection.insert_one(invoice_document)
        mongodb_id = result.inserted_id
        
        logging.debug(f"Invoice stored in MongoDB with ID: {mongodb_id}")
        
        return mongodb_id
        
    except Exception as e:
        logging.error(f"Error storing invoice in MongoDB: {e}", exc_info=True)
        return None


def insert_invoice_record(invoice_number, transaction_data, order_data, plan_data, gst_breakdown, s3_url, mongodb_id):
    """
    Insert invoice record into tbl_invoices
    
    Returns:
        int: Invoice ID
    """
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                insert_query = f"""
                INSERT INTO {TBL_INVOICES} (
                    invoice_number, transaction_id, user_id,
                    customer_name, customer_email, customer_state,
                    plan_name, plan_type, billing_period,
                    base_price, gst_rate, gst_amount, total_price, currency,
                    gst_type, cgst, sgst, igst,
                    invoice_s3_url, invoice_mongodb_id,
                    invoice_status, email_sent
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                values = [
                    invoice_number,
                    transaction_data['Transaction_ID'],
                    transaction_data['User_ID'],
                    order_data['Name'],
                    order_data['Email'],
                    order_data['State'],
                    plan_data['Plan_Name'],
                    plan_data['Plan_Type'],
                    plan_data['Billing_Period'],
                    float(plan_data['base_price']),
                    float(plan_data['gst_rate']),
                    float(plan_data['gst_amount']),
                    float(plan_data['total_price']),
                    plan_data['Currency'],
                    gst_breakdown['gst_type'],
                    gst_breakdown['cgst'],
                    gst_breakdown['sgst'],
                    gst_breakdown['igst'],
                    s3_url,
                    str(mongodb_id),
                    'GENERATED',
                    0
                ]
                
                cursor.execute(insert_query, values)
                cursor.execute("SELECT LAST_INSERT_ID()")
                invoice_id = cursor.fetchone()[0]
        
        logging.debug(f"Invoice record inserted with ID: {invoice_id}")
        
        return invoice_id
        
    except Exception as e:
        logging.error(f"Error inserting invoice record: {e}", exc_info=True)
        return None


def update_transaction_with_invoice_refs(transaction_id, invoice_number, s3_url, mongodb_id):
    """Update tbl_payment_transactions with invoice references"""
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                update_query = f"""
                UPDATE {TBL_PAYMENT_TRANSACTIONS}
                SET 
                    invoice_number = %s,
                    invoice_s3_url = %s,
                    invoice_mongodb_id = %s,
                    invoice_generated_at = NOW()
                WHERE id = %s
                """
                
                cursor.execute(update_query, [invoice_number, s3_url, str(mongodb_id), transaction_id])
        
        logging.debug(f"Transaction {transaction_id} updated with invoice references")
        
        return True
        
    except Exception as e:
        logging.error(f"Error updating transaction with invoice refs: {e}", exc_info=True)
        return False


def send_invoice_email(customer_email, customer_name, invoice_number, transaction_data, s3_url, temp_pdf_path):
    """
    Send invoice email with PDF attachment
    
    Returns:
        bool: True if email sent successfully
    """
    try:
        # Prepare email subject
        subject = f"Payment Successful - Invoice #{invoice_number}"
        
        # Prepare email body
        amount_rupees = transaction_data['Amount_Paise'] / 100
        payment_date = transaction_data['Created_At'].strftime('%d %B %Y %I:%M %p') if transaction_data['Created_At'] else 'N/A'
        
        email_body = f"""
Dear {customer_name},

Thank you for your payment! Your transaction has been successfully completed.

Invoice Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Invoice Number:      {invoice_number}
Transaction ID:      {transaction_data['Transaction_ID']}
Payment Date:        {payment_date}
Amount Paid:         {transaction_data['Currency']} {amount_rupees:.2f}
Payment Method:      {transaction_data['Payment_Method'].upper() if transaction_data['Payment_Method'] else 'N/A'}
Payment Status:      SUCCESS ✓

Your GST-compliant tax invoice is attached to this email.

If you have any questions or need assistance, please contact us:
- Email: support@lancieretech.com
- Phone: +91-80-12345678
- Website: www.lancieretech.com

Thank you for choosing Lanciere Technologies!

Best regards,
Lanciere Technologies Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated email. Please do not reply directly to this message.
For support, contact: support@lancieretech.com
        """
        
        # Create email message
        email = EmailMessage(
            subject=subject,
            body=email_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[customer_email],
        )
        
        # Attach PDF from temporary file
        with open(temp_pdf_path, 'rb') as f:
            email.attach(
                filename=f"invoice_{invoice_number}.pdf",
                content=f.read(),
                mimetype='application/pdf'
            )
        
        # Send email
        email.send(fail_silently=False)
        
        logging.debug(f"Invoice email sent to: {customer_email}")
        
        return True
        
    except Exception as e:
        logging.error(f"Error sending invoice email: {e}", exc_info=True)
        return False


def update_mongodb_email_status(mongodb_id, customer_email):
    """Update MongoDB document with email sent status"""
    try:
        invoice_collection.update_one(
            {"_id": mongodb_id},
            {
                "$set": {
                    "email.sent": True,
                    "email.sent_to": customer_email,
                    "email.sent_at": datetime.now().isoformat(),
                    "email.subject": f"Payment Successful - Invoice",
                    "updated_at": datetime.now().isoformat()
                }
            }
        )
        
        logging.debug(f"MongoDB document {mongodb_id} updated with email status")
        
        return True
        
    except Exception as e:
        logging.error(f"Error updating MongoDB email status: {e}", exc_info=True)
        return False


def update_invoice_email_status(invoice_id):
    """Update tbl_invoices with email sent status"""
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                update_query = f"""
                UPDATE {TBL_INVOICES}
                SET 
                    invoice_status = 'EMAILED',
                    email_sent = 1,
                    email_sent_at = NOW()
                WHERE id = %s
                """
                
                cursor.execute(update_query, [invoice_id])
        
        logging.debug(f"Invoice {invoice_id} marked as emailed")
        
        return True
        
    except Exception as e:
        logging.error(f"Error updating invoice email status: {e}", exc_info=True)
        return False


def cleanup_temp_file(temp_pdf_path):
    """Delete temporary PDF file"""
    try:
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)
            logging.debug(f"Temporary file deleted: {temp_pdf_path}")
            return True
        return False
        
    except Exception as e:
        logging.error(f"Error cleaning up temp file: {e}", exc_info=True)
        return False