# =============================================================================
# Jenkins Module - Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "public_subnet_id" {
  description = "Public subnet ID for Jenkins"
  type        = string
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "eks_cluster_name" {
  description = "EKS cluster name for kubectl configuration"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for Jenkins"
  type        = string
  default     = "t3.large"
}

variable "root_volume_size" {
  description = "Root volume size in GB"
  type        = number
  default     = 50
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Restrict in production!
}

variable "allowed_jenkins_cidrs" {
  description = "CIDR blocks allowed for Jenkins UI access"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Restrict in production!
}

variable "create_ssh_key" {
  description = "Create new SSH key pair"
  type        = bool
  default     = true
}

variable "existing_key_name" {
  description = "Existing SSH key pair name (if create_ssh_key is false)"
  type        = string
  default     = ""
}

variable "create_elastic_ip" {
  description = "Create Elastic IP for Jenkins"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
