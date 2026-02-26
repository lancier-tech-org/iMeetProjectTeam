from django.contrib import admin

# Register your models here.
# ============================================================
# 📌 STEP 2: ADD THIS AT THE BOTTOM OF YOUR EXISTING FILE
# 📁 FILE: /lanciere/devstorage/jyothi/SampleDB_W/core/admin.py
#
# ⚠️ DO NOT REPLACE THE FILE — just paste at the bottom
# Also add this import at the top with your other imports:
#   from .models import AppConfig
# ============================================================

from .models import AppConfig


@admin.register(AppConfig)
class AppConfigAdmin(admin.ModelAdmin):
    list_display = ('name', 'updated_at')
    readonly_fields = ('name', 'updated_at')

    fieldsets = (
        (None, {
            'fields': ('name',),
        }),
        ('JSON Configuration (edit below)', {
            'fields': ('config_json',),
            'description': 'Paste your full JSON here. Flutter reads this directly.'
        }),
        ('Info', {
            'fields': ('updated_at',),
        }),
    )

    def has_add_permission(self, request):
        # Only allow 1 row — if one exists, block adding more
        if AppConfig.objects.exists():
            return False
        return True

    def has_delete_permission(self, request, obj=None):
        # Prevent accidental deletion
        return False

    class Media:
        css = {
            'all': []
        }
        # Make the textarea bigger for JSON editing
        js = []

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        """Make the JSON textarea large enough to edit comfortably."""
        field = super().formfield_for_dbfield(db_field, request, **kwargs)
        if db_field.name == 'config_json':
            field.widget.attrs['rows'] = 40
            field.widget.attrs['cols'] = 100
            field.widget.attrs['style'] = (
                'font-family: monospace; font-size: 14px; '
                'width: 95%; background-color: #1e1e1e; color: #d4d4d4; '
                'padding: 15px; border-radius: 5px; line-height: 1.5;'
            )
        return field
