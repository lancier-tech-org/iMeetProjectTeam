# core/super_adminDashboard/subscription_service.py

from django.db import connection, transaction
from datetime import datetime, timedelta
import logging

# Configure logging
logging.basicConfig(
    filename='subscription_service_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(message)s'
)

# Table Names
TBL_USER_SUBSCRIPTIONS = 'tbl_user_subscriptions'
TBL_PAYMENT_TRANSACTIONS = 'tbl_payment_transactions'
TBL_PAYMENT_ORDERS = 'tbl_payment_orders'
TBL_INVOICES = 'tbl_invoices'
TBL_PLANS = 'tbl_Plans'


def create_user_subscription(transaction_id, invoice_id=None):
    """
    Automatically create user subscription after successful payment
    
    Args:
        transaction_id: Internal transaction ID from tbl_payment_transactions
        invoice_id: Invoice ID from tbl_invoices (optional)
    
    Returns:
        dict: Success/failure status with subscription_id
    """
    try:
        logging.info(f"Starting subscription creation for transaction_id: {transaction_id}")
        
        # Step 1: Fetch all required data from existing tables
        with connection.cursor() as cursor:
            # Fetch transaction data
            cursor.execute(f"""
                SELECT id, user_id, order_id, amount, currency, created_at
                FROM {TBL_PAYMENT_TRANSACTIONS}
                WHERE id = %s
            """, [transaction_id])
            
            txn_row = cursor.fetchone()
            if not txn_row:
                logging.error(f"Transaction not found: {transaction_id}")
                return {"success": False, "error": "Transaction not found"}
            
            transaction_data = dict(zip([
                'Transaction_ID', 'User_ID', 'Order_ID', 'Amount_Paise', 'Currency', 'Created_At'
            ], txn_row))
            
            # Fetch order data to get reference_id (contains plan info)
            cursor.execute(f"""
                SELECT id, reference_id
                FROM {TBL_PAYMENT_ORDERS}
                WHERE id = %s
            """, [transaction_data['Order_ID']])
            
            order_row = cursor.fetchone()
            if not order_row:
                logging.error(f"Order not found: {transaction_data['Order_ID']}")
                return {"success": False, "error": "Order not found"}
            
            order_data = dict(zip(['Order_ID', 'Reference_ID'], order_row))
            
            # Parse reference_id to get plan_type and billing_period
            # Format: "PRO_MONTHLY" or "BASIC_YEARLY" or "PRO_MAX_MONTHLY"
            reference_id = order_data['Reference_ID']
            parts = reference_id.split('_')
            
            # Handle PRO_MAX case (3 parts)
            if len(parts) == 3:
                plan_type = f"{parts[0]}_{parts[1]}".lower()  # "pro_max"
                billing_period = parts[2].lower()  # "monthly"
            else:
                plan_type = parts[0].lower()  # "pro" or "basic"
                billing_period = parts[1].lower()  # "monthly" or "yearly"
            
            # Fetch plan data
            cursor.execute(f"""
                SELECT id, plan_name, plan_type, billing_period,
                       base_price, gst_amount, total_price, currency
                FROM {TBL_PLANS}
                WHERE plan_type = %s AND billing_period = %s AND is_active = 1
            """, [plan_type, billing_period])
            
            plan_row = cursor.fetchone()
            if not plan_row:
                logging.error(f"Plan not found: {plan_type}, {billing_period}")
                return {"success": False, "error": "Plan not found"}
            
            plan_data = dict(zip([
                'Plan_ID', 'Plan_Name', 'Plan_Type', 'Billing_Period',
                'Base_Price', 'GST_Amount', 'Total_Price', 'Currency'
            ], plan_row))
        
        # Step 2: Calculate subscription dates
        subscription_start_date = transaction_data['Created_At'].date()
        
        # Calculate duration and end date based on billing period
        if plan_data['Billing_Period'] == 'monthly':
            duration_days = 30
            subscription_end_date = subscription_start_date + timedelta(days=30)
        elif plan_data['Billing_Period'] == 'yearly':
            duration_days = 365
            subscription_end_date = subscription_start_date + timedelta(days=365)
        else:
            logging.error(f"Unknown billing period: {plan_data['Billing_Period']}")
            return {"success": False, "error": "Unknown billing period"}
        
        logging.debug(f"Calculated dates - Start: {subscription_start_date}, End: {subscription_end_date}, Duration: {duration_days} days")
        
        # Step 3: Insert subscription record
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Check if subscription already exists for this transaction (prevent duplicates)
                cursor.execute(f"""
                    SELECT id FROM {TBL_USER_SUBSCRIPTIONS}
                    WHERE transaction_id = %s
                """, [transaction_id])
                
                existing_sub = cursor.fetchone()
                if existing_sub:
                    logging.warning(f"Subscription already exists for transaction {transaction_id}")
                    return {"success": True, "subscription_id": existing_sub[0], "message": "Subscription already exists"}
                
                # Insert new subscription
                insert_query = f"""
                INSERT INTO {TBL_USER_SUBSCRIPTIONS} (
                    user_id, transaction_id, order_id, invoice_id, plan_id,
                    plan_name, plan_type, billing_period,
                    subscription_start_date, subscription_end_date, duration_days,
                    subscription_status,
                    base_price, gst_amount, total_price, currency
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                values = [
                    transaction_data['User_ID'],
                    transaction_id,
                    transaction_data['Order_ID'],
                    invoice_id,
                    plan_data['Plan_ID'],
                    plan_data['Plan_Name'],
                    plan_data['Plan_Type'],
                    plan_data['Billing_Period'],
                    subscription_start_date,
                    subscription_end_date,
                    duration_days,
                    'ACTIVE',
                    float(plan_data['Base_Price']),
                    float(plan_data['GST_Amount']),
                    float(plan_data['Total_Price']),
                    plan_data['Currency']
                ]
                
                cursor.execute(insert_query, values)
                cursor.execute("SELECT LAST_INSERT_ID()")
                subscription_id = cursor.fetchone()[0]
        
        logging.info(f"Subscription created successfully: ID {subscription_id}, User: {transaction_data['User_ID']}, Plan: {plan_data['Plan_Name']}, Duration: {duration_days} days")
        
        return {
            "success": True,
            "subscription_id": subscription_id,
            "subscription_details": {
                "user_id": transaction_data['User_ID'],
                "plan_name": plan_data['Plan_Name'],
                "plan_type": plan_data['Plan_Type'],
                "billing_period": plan_data['Billing_Period'],
                "start_date": str(subscription_start_date),
                "end_date": str(subscription_end_date),
                "duration_days": duration_days,
                "status": "ACTIVE"
            }
        }
        
    except Exception as e:
        logging.error(f"Error creating subscription: {e}", exc_info=True)
        return {"success": False, "error": str(e)}