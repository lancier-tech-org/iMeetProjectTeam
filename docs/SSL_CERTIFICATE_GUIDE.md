# SSL Certificate Creation Guide for lancieretech.com

## 🎯 Overview

This guide walks you through creating an SSL certificate using AWS Certificate Manager (ACM).

**Time Required:** 10-30 minutes (depends on DNS propagation)

---

## Step 1: Open AWS Certificate Manager

```
1. Login to AWS Console
   → https://console.aws.amazon.com

2. Search bar lo type: "Certificate Manager" or "ACM"

3. Click on "Certificate Manager"

4. ⚠️ IMPORTANT: Check Region!
   → Top-right corner lo region check cheyyandi
   → "Mumbai (ap-south-1)" select cheyyandi
   
   Why? Certificate same region lo undali where you use it
```

**Screenshot Reference:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AWS Console                                              [Mumbai ▼] [User] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔍 [Certificate Manager                                    ]               │
│                                                                             │
│     Services                                                                │
│     ├── Certificate Manager (ACM)  ← Click this                            │
│     └── ...                                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 2: Request a Certificate

```
1. ACM Dashboard lo "Request a certificate" button click cheyyandi

2. Certificate type select cheyyandi:
   ◉ Request a public certificate  ← Select this
   ○ Request a private certificate
   
3. Click "Next"
```

**Screenshot Reference:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AWS Certificate Manager                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Certificates (0)                                                           │
│                                                                             │
│  ┌─────────────────────────────────────────┐                               │
│  │  [Request a certificate]                 │  ← Click this                │
│  └─────────────────────────────────────────┘                               │
│                                                                             │
│  You don't have any certificates in this region.                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 3: Add Domain Names

```
1. Fully qualified domain name:
   
   Domain name 1: lancieretech.com
   
2. Click "Add another name to this certificate"

   Domain name 2: *.lancieretech.com
   
   ⚠️ Wildcard (*.) adds:
   - api.lancieretech.com
   - www.lancieretech.com
   - app.lancieretech.com
   - Any subdomain automatically covered!
```

**What to Enter:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Add domain names                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Fully qualified domain name                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ lancieretech.com                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [+ Add another name to this certificate]                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ *.lancieretech.com                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 4: Select Validation Method

```
Validation method:
◉ DNS validation - recommended  ← Select this
○ Email validation

Why DNS validation?
- Faster (usually 5-15 minutes)
- No email required
- Auto-renews certificate
```

**Screenshot Reference:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Select validation method                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ◉ DNS validation - recommended                                             │
│     Recommended for domains managed with Route 53.                         │
│     Certificate automatically renews.                                       │
│                                                                             │
│  ○ Email validation                                                         │
│     Requires access to email for the domain.                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 5: Add Tags (Optional)

```
Key: Name
Value: lancieretech-ssl-cert

Key: Project  
Value: iMeetPro

(Tags optional but helpful for organization)
```

---

## Step 6: Review and Request

```
1. Review all details
2. Click "Request" button
3. Certificate status: "Pending validation"
```

---

## Step 7: Get DNS Validation Records ⚠️ IMPORTANT

```
1. Certificate list lo click cheyyandi on your new certificate

2. "Domains" section lo choodandi:
   - lancieretech.com → Pending validation
   - *.lancieretech.com → Pending validation

3. Each domain ki CNAME record chupistundi:
   
   ┌────────────────────────────────────────────────────────────────────────┐
   │  CNAME name:                                                           │
   │  _abc123def456.lancieretech.com                                        │
   │                                                                        │
   │  CNAME value:                                                          │
   │  _xyz789ghi012.acm-validations.aws                                     │
   └────────────────────────────────────────────────────────────────────────┘

4. COPY these values - you need to add to DNS
```

**Screenshot Reference:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Certificate: arn:aws:acm:ap-south-1:123456789:certificate/abc-123         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Status: Pending validation ⏳                                              │
│                                                                             │
│  Domains                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Domain name          │ Status              │ CNAME name    │ CNAME │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ lancieretech.com     │ Pending validation  │ _abc123...    │ Copy  │   │
│  │ *.lancieretech.com   │ Pending validation  │ _abc123...    │ Copy  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Create records in Route 53]  ← If domain is in Route 53                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 8: Add DNS Records

### Option A: If domain is in AWS Route 53

```
1. Click "Create records in Route 53" button
2. Select both domains
3. Click "Create records"
4. Done! AWS automatically adds CNAME records
```

### Option B: If domain is in GoDaddy

```
1. Login to GoDaddy → https://godaddy.com

2. My Products → Domains → lancieretech.com → DNS

3. Add CNAME Record:
   
   Type: CNAME
   Name: _abc123def456  (without .lancieretech.com)
   Value: _xyz789ghi012.acm-validations.aws
   TTL: 600 (or default)

4. Save
```

### Option B: If domain is in Namecheap

```
1. Login to Namecheap → Domain List → lancieretech.com → Manage

2. Advanced DNS tab

3. Add New Record:
   Type: CNAME Record
   Host: _abc123def456
   Value: _xyz789ghi012.acm-validations.aws
   TTL: Automatic

4. Save
```

### Option C: If domain is in Hostinger/Others

```
Same process:
1. Login to DNS management
2. Add CNAME record
3. Name = CNAME name from ACM (without your domain)
4. Value = CNAME value from ACM
5. Save
```

---

## Step 9: Wait for Validation

```
After adding DNS records:

1. Wait 5-30 minutes for DNS propagation

2. Check certificate status in ACM:
   - Pending validation → ⏳ Wait
   - Issued → ✅ Success!

3. You can check DNS propagation:
   https://www.whatsmydns.net/#CNAME/_abc123def456.lancieretech.com
```

**Status Changes:**
```
Pending validation (yellow) → Waiting for DNS records
        ↓
    Issued (green) → ✅ Ready to use!
```

---

## Step 10: Copy Certificate ARN

```
Once status is "Issued":

1. Click on certificate

2. Copy the ARN:
   arn:aws:acm:ap-south-1:123456789012:certificate/abc-def-123-456

3. Paste in terraform.tfvars:
   certificate_arn = "arn:aws:acm:ap-south-1:123456789012:certificate/abc-def-123-456"
```

---

## ✅ Verification Checklist

- [ ] Region is ap-south-1 (Mumbai)
- [ ] Added lancieretech.com
- [ ] Added *.lancieretech.com (wildcard)
- [ ] Selected DNS validation
- [ ] Added CNAME record to DNS provider
- [ ] Status changed to "Issued"
- [ ] Copied ARN to terraform.tfvars

---

## 🚨 Troubleshooting

### Certificate stuck in "Pending validation"?

```
1. Verify CNAME record is correct
   - Check for typos
   - Make sure full value is copied

2. Check DNS propagation
   https://www.whatsmydns.net

3. Wait up to 72 hours (rare cases)

4. If still pending after 72 hours:
   - Delete certificate
   - Create new one
   - Add DNS records again
```

### "Certificate not found" error in Terraform?

```
1. Check region matches (ap-south-1)
2. Verify ARN is complete
3. Ensure certificate status is "Issued"
```

---

## 📞 Next Steps

After certificate is issued:

1. Update terraform.tfvars with certificate_arn
2. Continue with terraform apply
3. Your site will have HTTPS! 🔒
