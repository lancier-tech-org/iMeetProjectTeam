# =============================================================================
# iMeetPro Infrastructure - Main Configuration
# =============================================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = merge(var.tags, {
    Environment = var.environment
    Project     = var.project_name
  })
}

# =============================================================================
# Data Sources
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# =============================================================================
# VPC Module
# =============================================================================

module "vpc" {
  source = "./modules/vpc"

  name_prefix           = local.name_prefix
  vpc_cidr              = var.vpc_cidr
  availability_zones    = var.availability_zones
  private_subnet_cidrs  = var.private_subnet_cidrs
  public_subnet_cidrs   = var.public_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs
  
  tags = local.common_tags
}

# =============================================================================
# Security Module
# =============================================================================

module "security" {
  source = "./modules/security"

  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id
  
  tags = local.common_tags
}

# =============================================================================
# ECR Module
# =============================================================================

module "ecr" {
  source = "./modules/ecr"

  name_prefix = local.name_prefix
  
  repositories = [
    "frontend",
    "backend",
    "celery-worker",
    "gpu-worker"
  ]
  
  tags = local.common_tags
}

# =============================================================================
# EKS Module
# =============================================================================

module "eks" {
  source = "./modules/eks"

  name_prefix        = local.name_prefix
  cluster_version    = var.eks_cluster_version
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  
  # Worker Nodes
  node_instance_types = var.eks_node_instance_types
  node_desired_size   = var.eks_node_desired_size
  node_min_size       = var.eks_node_min_size
  node_max_size       = var.eks_node_max_size
  
  # GPU Nodes
  gpu_node_instance_types = var.eks_gpu_node_instance_types
  gpu_node_desired_size   = var.eks_gpu_node_desired_size
  
  tags = local.common_tags

  depends_on = [module.vpc]
}

# =============================================================================
# RDS Module
# =============================================================================

module "rds" {
  source = "./modules/rds"

  name_prefix        = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  database_subnet_ids = module.vpc.database_subnet_ids
  
  instance_class     = var.rds_instance_class
  allocated_storage  = var.rds_allocated_storage
  engine_version     = var.rds_engine_version
  database_name      = var.rds_database_name
  username           = var.rds_username
  password           = var.rds_password
  
  allowed_security_groups = [module.eks.node_security_group_id]
  
  tags = local.common_tags

  depends_on = [module.vpc, module.security]
}

# =============================================================================
# S3 Module
# =============================================================================

module "s3" {
  source = "./modules/s3"

  name_prefix            = local.name_prefix
  recordings_bucket_name = var.s3_recordings_bucket_name
  assets_bucket_name     = var.s3_assets_bucket_name
  
  tags = local.common_tags
}

# =============================================================================
# CloudFront Module
# =============================================================================

module "cloudfront" {
  source = "./modules/cloudfront"

  name_prefix     = local.name_prefix
  domain_name     = var.domain_name
  s3_assets_bucket_regional_domain_name = module.s3.assets_bucket_regional_domain_name
  
  tags = local.common_tags

  depends_on = [module.s3]
}

# =============================================================================
# Jenkins Module (CI/CD Server)
# =============================================================================

module "jenkins" {
  source = "./modules/jenkins"

  name_prefix      = local.name_prefix
  vpc_id           = module.vpc.vpc_id
  vpc_cidr         = var.vpc_cidr
  public_subnet_id = module.vpc.public_subnet_ids[0]
  aws_region       = var.aws_region
  eks_cluster_name = module.eks.cluster_name

  instance_type         = var.jenkins_instance_type
  root_volume_size      = var.jenkins_volume_size
  allowed_ssh_cidrs     = var.jenkins_allowed_ssh_cidrs
  allowed_jenkins_cidrs = var.jenkins_allowed_cidrs
  create_ssh_key        = true
  create_elastic_ip     = true

  tags = local.common_tags

  depends_on = [module.eks]
}

# =============================================================================
# Kubernetes Namespaces
# =============================================================================

resource "kubernetes_namespace" "imeetpro" {
  metadata {
    name = "imeetpro"
    labels = {
      name        = "imeetpro"
      environment = var.environment
    }
  }

  depends_on = [module.eks]
}

resource "kubernetes_namespace" "databases" {
  metadata {
    name = "databases"
    labels = {
      name = "databases"
    }
  }

  depends_on = [module.eks]
}

# =============================================================================
# NOTE: Helm releases (Prometheus, Loki, Nginx Ingress, Cert Manager)
# removed from Terraform due to timeout issues.
# Install manually after infrastructure is ready:
#
# helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
# helm repo add grafana https://grafana.github.io/helm-charts
# helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
# helm repo add jetstack https://charts.jetstack.io
# helm repo update
#
# kubectl create namespace monitoring
# kubectl create namespace ingress-nginx
# kubectl create namespace cert-manager
#
# helm install nginx-ingress ingress-nginx/ingress-nginx -n ingress-nginx
# helm install cert-manager jetstack/cert-manager -n cert-manager --set installCRDs=true
# helm install loki grafana/loki-stack -n monitoring
# helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring
# =============================================================================
