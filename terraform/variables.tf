# =============================================================================
# iMeetPro Infrastructure - Variables
# =============================================================================

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "imeetpro"
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-south-1"
}

# VPC Variables
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]
}

# EKS Variables
variable "eks_cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.29"
}

variable "eks_node_instance_types" {
  description = "Instance types for EKS worker nodes"
  type        = list(string)
  default     = ["t3.large"]
}

variable "eks_node_desired_size" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 3
}

variable "eks_node_min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 2
}

variable "eks_node_max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 5
}

variable "eks_gpu_node_instance_types" {
  description = "Instance types for GPU worker nodes"
  type        = list(string)
  default     = ["g4dn.xlarge"]
}

variable "eks_gpu_node_desired_size" {
  description = "Desired number of GPU worker nodes"
  type        = number
  default     = 2
}

# RDS Variables
variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 50
}

variable "rds_engine_version" {
  description = "MySQL engine version"
  type        = string
  default     = "8.0"
}

variable "rds_database_name" {
  description = "Database name"
  type        = string
  default     = "imeetpro"
}

variable "rds_username" {
  description = "Database master username"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "rds_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

# S3 Variables
variable "s3_recordings_bucket_name" {
  description = "S3 bucket name for recordings"
  type        = string
}

variable "s3_assets_bucket_name" {
  description = "S3 bucket name for static assets"
  type        = string
}

# Domain Variables
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = ""
}

# Tags
variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "iMeetPro"
    ManagedBy   = "Terraform"
  }
}

# Jenkins Variables
variable "jenkins_instance_type" {
  description = "EC2 instance type for Jenkins"
  type        = string
  default     = "t3.large"
}

variable "jenkins_volume_size" {
  description = "Root volume size for Jenkins in GB"
  type        = number
  default     = 50
}

variable "jenkins_allowed_ssh_cidrs" {
  description = "CIDR blocks allowed for SSH access to Jenkins"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "jenkins_allowed_cidrs" {
  description = "CIDR blocks allowed for Jenkins UI access"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
