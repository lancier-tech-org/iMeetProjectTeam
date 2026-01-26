# =============================================================================
# iMeetPro Infrastructure - Outputs
# =============================================================================

# VPC Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "database_subnet_ids" {
  description = "Database subnet IDs"
  value       = module.vpc.database_subnet_ids
}

# EKS Outputs
output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_certificate_authority_data" {
  description = "EKS cluster CA certificate"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_node_security_group_id" {
  description = "EKS node security group ID"
  value       = module.eks.node_security_group_id
}

# ECR Outputs
output "ecr_repository_urls" {
  description = "ECR repository URLs"
  value       = module.ecr.repository_urls
}

# RDS Outputs
output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
}

output "rds_port" {
  description = "RDS port"
  value       = module.rds.port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.rds.database_name
}

# S3 Outputs
output "s3_recordings_bucket_name" {
  description = "S3 recordings bucket name"
  value       = module.s3.recordings_bucket_name
}

output "s3_recordings_bucket_arn" {
  description = "S3 recordings bucket ARN"
  value       = module.s3.recordings_bucket_arn
}

output "s3_assets_bucket_name" {
  description = "S3 assets bucket name"
  value       = module.s3.assets_bucket_name
}

output "s3_assets_bucket_arn" {
  description = "S3 assets bucket ARN"
  value       = module.s3.assets_bucket_arn
}

# CloudFront Outputs
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = module.cloudfront.distribution_domain_name
}

# Monitoring Outputs
# output "grafana_password" {
#  description = "Grafana admin password"
 # value       = random_password.grafana_password.result
#  sensitive   = true
#}

# Kubeconfig Command
output "configure_kubectl" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

# Jenkins Integration Outputs
output "jenkins_integration_info" {
  description = "Information needed for Jenkins integration"
  value = {
    aws_region          = var.aws_region
    aws_account_id      = data.aws_caller_identity.current.account_id
    eks_cluster_name    = module.eks.cluster_name
    ecr_registry        = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    ecr_frontend_repo   = module.ecr.repository_urls["frontend"]
    ecr_backend_repo    = module.ecr.repository_urls["backend"]
    ecr_celery_repo     = module.ecr.repository_urls["celery-worker"]
    ecr_gpu_worker_repo = module.ecr.repository_urls["gpu-worker"]
  }
}

# =============================================================================
# Jenkins Outputs
# =============================================================================

output "jenkins_public_ip" {
  description = "Jenkins server public IP"
  value       = module.jenkins.public_ip
}

output "jenkins_url" {
  description = "Jenkins URL"
  value       = module.jenkins.jenkins_url
}

output "jenkins_ssh_command" {
  description = "SSH command to connect to Jenkins"
  value       = module.jenkins.ssh_command
}

output "jenkins_ssh_private_key" {
  description = "SSH private key for Jenkins"
  value       = module.jenkins.ssh_private_key
  sensitive   = true
}

output "jenkins_initial_password_command" {
  description = "Command to get Jenkins initial admin password"
  value       = "ssh -i jenkins-key.pem ubuntu@${module.jenkins.public_ip} 'sudo cat /var/lib/jenkins/secrets/initialAdminPassword'"
}
