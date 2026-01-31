from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(request):
    """
    Kubernetes / Docker health check.
    MUST be fast and dumb.
    """
    return JsonResponse({"status": "ok"})
