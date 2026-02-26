# ============================================================
# 📌 STEP 7: CREATE THIS NEW FILE
# 📁 FILE: /lanciere/devstorage/jyothi/SampleDB_W/core/management/commands/seed_app_config.py
#
# Create folders first:
#   mkdir -p core/management/commands
#   touch core/management/__init__.py
#   touch core/management/commands/__init__.py
#
# RUN WITH: python manage.py seed_app_config
# ============================================================

import json
from django.core.management.base import BaseCommand
from core.models import AppConfig


INITIAL_CONFIG = {
    "payment": {
        "enabled": True,
        "gateway": "razorpay",
        "razorpay_key_id": "rzp_test_XXXXXXXXXX",
        "currency": "INR",
        "company_name": "iMeetPro",
        "description": "iMeetPro Subscription",
        "theme_color": "#3399cc",
        "plans": [
            {
                "id": "basic",
                "name": "Basic Plan",
                "price": 499,
                "duration_days": 30
            },
            {
                "id": "premium",
                "name": "Premium Plan",
                "price": 999,
                "duration_days": 30
            },
            {
                "id": "yearly",
                "name": "Yearly Plan",
                "price": 4999,
                "duration_days": 365
            }
        ]
    },
    "version": {
        "min_app_version": "1.0.0",
        "latest_app_version": "1.0.0",
        "force_update": False,
        "update_url": "https://play.google.com/store/apps/details?id=com.imeetpro",
        "update_message": "A new version is available. Please update!"
    }
}


class Command(BaseCommand):
    help = 'Seed initial app configuration JSON'

    def handle(self, *args, **kwargs):
        config_json = json.dumps(INITIAL_CONFIG, indent=2)

        obj, created = AppConfig.objects.update_or_create(
            name='app_config',
            defaults={'config_json': config_json}
        )

        if created:
            self.stdout.write(self.style.SUCCESS('✅ App config created successfully!'))
        else:
            self.stdout.write(self.style.WARNING('🔄 App config updated!'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Test it:'))
        self.stdout.write(f'  API:   http://192.168.48.201:8111/api/app-config/')
        self.stdout.write(f'  Admin: http://192.168.48.201:8111/admin/core/appconfig/')