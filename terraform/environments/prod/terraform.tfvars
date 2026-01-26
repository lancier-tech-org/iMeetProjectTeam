# =============================================================================
# iMeetPro Infrastructure - Production Environment
# =============================================================================
# ⚠️ UPDATE THESE VALUES BEFORE RUNNING TERRAFORM ⚠️
# =============================================================================

# General
project_name = "imeetpro"
environment  = "prod"
aws_region   = "ap-south-1"

# VPC Configuration
vpc_cidr              = "10.0.0.0/16"
availability_zones    = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
private_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnet_cidrs   = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
database_subnet_cidrs = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]

# EKS Configuration
eks_cluster_version         = "1.29"
eks_node_instance_types     = ["t3.large"]
eks_node_desired_size       = 3
eks_node_min_size           = 2
eks_node_max_size           = 6
eks_gpu_node_instance_types = ["g4dn.xlarge"]
eks_gpu_node_desired_size   = 2

# RDS Configuration
rds_instance_class    = "db.t3.medium"
rds_allocated_storage = 100
rds_engine_version    = "8.0"
rds_database_name     = "imeetpro"
rds_username          = "imeetpro_admin"

# =============================================================================
# ⚠️ STEP 2A: SET STRONG PASSWORD (32+ characters recommended)
# =============================================================================
rds_password = "LanciereTech2024SecurePass123"
# Generate strong password: openssl rand -base64 32

# =============================================================================
# ⚠️ STEP 2B: YOUR DOMAIN NAME
# =============================================================================
domain_name = "lancieretech.com"

# =============================================================================
# ⚠️ STEP 2C: S3 BUCKET NAMES (must be globally unique)
# =============================================================================
s3_recordings_bucket_name = "imeetpro-lancieretech-recordings"
s3_assets_bucket_name     = "imeetpro-lancieretech-assets"

# =============================================================================
# ⚠️ STEP 3: ACM CERTIFICATE ARN (create in Step 3, then paste here)
# Leave empty first, create cert, then update and run terraform again
# =============================================================================
certificate_arn = "arn:aws:acm:ap-south-1:664418964913:certificate/5caa78f0-9588-461c-bd64-4163cdf7c3b7"
# cloudfront_certificate_arn = "arn:aws:acm:us-east-1:664418964913:certificate/8d3d9d2d-33f3-4563-bd07-453e0dbf68b8"
# Example: "arn:aws:acm:ap-south-1:123456789012:certificate/abc-123-xyz"

# Tags
tags = {
  Project     = "iMeetPro"
  Environment = "Production"
  ManagedBy   = "Terraform"
  Team        = "Lanciere Tech"
  Owner       = "Akhil"
}

# =============================================================================
# ⚠️ JENKINS CONFIGURATION
# =============================================================================
jenkins_instance_type = "t3.large"
jenkins_volume_size   = 50

# ⚠️ SECURITY: Restrict these to your IP in production!
# Example: ["203.0.113.0/32"] for single IP
jenkins_allowed_ssh_cidrs = ["0.0.0.0/0"]
jenkins_allowed_cidrs     = ["0.0.0.0/0"]
