# =============================================================================
# CloudFront Distribution - Simple Version
# =============================================================================

resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "${var.name_prefix}-oai"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.name_prefix} CDN"
  default_root_object = "index.html"
  price_class         = "PriceClass_200"

  # Use CloudFront default certificate (no custom domain)
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  origin {
    domain_name = var.s3_assets_bucket_regional_domain_name
    origin_id   = "S3-${var.name_prefix}-assets"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.name_prefix}-assets"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = var.tags
}

output "distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "distribution_domain_name" {
  value = aws_cloudfront_distribution.main.domain_name
}

output "oai_iam_arn" {
  value = aws_cloudfront_origin_access_identity.main.iam_arn
}

variable "name_prefix" {
  type = string
}

variable "domain_name" {
  type = string
}

variable "certificate_arn" {
  type    = string
  default = ""
}

variable "s3_assets_bucket_regional_domain_name" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
