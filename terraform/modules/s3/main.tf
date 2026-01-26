# =============================================================================
# S3 Module - Main Configuration
# =============================================================================

# S3 Bucket for Recordings
resource "aws_s3_bucket" "recordings" {
  bucket = var.recordings_bucket_name

  tags = merge(var.tags, {
    Name = var.recordings_bucket_name
    Purpose = "Meeting Recordings"
  })
}

resource "aws_s3_bucket_versioning" "recordings" {
  bucket = aws_s3_bucket.recordings.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    id     = "move-to-glacier"
    status = "Enabled"

    filter {
      prefix = ""
    }

    

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 Bucket for Static Assets
resource "aws_s3_bucket" "assets" {
  bucket = var.assets_bucket_name

  tags = merge(var.tags, {
    Name = var.assets_bucket_name
    Purpose = "Static Assets"
  })
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "assets" {
  comment = "OAI for ${var.assets_bucket_name}"
}

# Bucket Policy for CloudFront
resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.assets.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.assets.arn}/*"
      }
    ]
  })
}

# =============================================================================
# S3 Module - Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "recordings_bucket_name" {
  description = "Name for recordings bucket"
  type        = string
}

variable "assets_bucket_name" {
  description = "Name for assets bucket"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# =============================================================================
# S3 Module - Outputs
# =============================================================================

output "recordings_bucket_name" {
  description = "Recordings bucket name"
  value       = aws_s3_bucket.recordings.id
}

output "recordings_bucket_arn" {
  description = "Recordings bucket ARN"
  value       = aws_s3_bucket.recordings.arn
}

output "assets_bucket_name" {
  description = "Assets bucket name"
  value       = aws_s3_bucket.assets.id
}

output "assets_bucket_arn" {
  description = "Assets bucket ARN"
  value       = aws_s3_bucket.assets.arn
}

output "assets_bucket_regional_domain_name" {
  description = "Assets bucket regional domain name"
  value       = aws_s3_bucket.assets.bucket_regional_domain_name
}

output "assets_bucket_id" {
  description = "Assets bucket ID"
  value       = aws_s3_bucket.assets.id
}

output "cloudfront_oai_iam_arn" {
  description = "CloudFront OAI IAM ARN"
  value       = aws_cloudfront_origin_access_identity.assets.iam_arn
}

output "cloudfront_oai_path" {
  description = "CloudFront OAI path"
  value       = aws_cloudfront_origin_access_identity.assets.cloudfront_access_identity_path
}
