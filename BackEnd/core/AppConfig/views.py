# ============================================================
# 📌 STEP 4: CREATE THIS NEW FILE
# 📁 FILE: /lanciere/devstorage/jyothi/SampleDB_W/core/AppConfig/views.py
# ============================================================

import json
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from core.models import AppConfig


@csrf_exempt
@require_GET
def get_app_config(request):
    """
    GET https://192.168.48.201:8111/api/app-config/

    Reads the JSON from database and returns it directly.
    Flutter fetches this on app startup.
    """
    try:
        config = AppConfig.objects.get(name='app_config')
        config_data = json.loads(config.config_json)

        return JsonResponse({
            'status': 'success',
            'config': config_data
        })

    except AppConfig.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'App configuration not found. Please seed it via Django Admin.'
        }, status=404)

    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON in app configuration. Please fix it in Django Admin.'
        }, status=500)

    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)