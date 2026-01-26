#!/bin/bash
# =============================================================================
# iMeetPro Complete Infrastructure Deployment Script
# =============================================================================
# This script deploys the entire iMeetPro infrastructure
# 
# Prerequisites:
# - AWS CLI configured with appropriate credentials
# - Terraform installed (>= 1.5.0)
# - kubectl installed
# - Helm installed
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
export AWS_REGION="${AWS_REGION:-ap-south-1}"
export ENVIRONMENT="${ENVIRONMENT:-prod}"
export PROJECT_NAME="imeetpro"

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"
K8S_DIR="${SCRIPT_DIR}/../kubernetes"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_banner() {
    echo ""
    echo -e "${GREEN}=============================================="
    echo "  iMeetPro Infrastructure Deployment"
    echo "=============================================="
    echo -e "  Environment: ${ENVIRONMENT}"
    echo -e "  Region: ${AWS_REGION}"
    echo -e "==============================================${NC}"
    echo ""
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed"
        exit 1
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check Helm
    if ! command -v helm &> /dev/null; then
        log_error "Helm is not installed"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    log_success "All prerequisites met!"
}

create_terraform_backend() {
    log_info "Creating Terraform backend (S3 + DynamoDB)..."
    
    # Create S3 bucket for state
    aws s3api create-bucket \
        --bucket ${PROJECT_NAME}-terraform-state-${AWS_REGION} \
        --region ${AWS_REGION} \
        --create-bucket-configuration LocationConstraint=${AWS_REGION} \
        2>/dev/null || true
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket ${PROJECT_NAME}-terraform-state-${AWS_REGION} \
        --versioning-configuration Status=Enabled
    
    # Enable encryption
    aws s3api put-bucket-encryption \
        --bucket ${PROJECT_NAME}-terraform-state-${AWS_REGION} \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }'
    
    # Create DynamoDB table for locking
    aws dynamodb create-table \
        --table-name ${PROJECT_NAME}-terraform-locks \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region ${AWS_REGION} \
        2>/dev/null || true
    
    log_success "Terraform backend created!"
}

deploy_terraform() {
    log_info "Deploying infrastructure with Terraform..."
    
    cd ${TERRAFORM_DIR}
    
    # Initialize Terraform
    log_info "Initializing Terraform..."
    terraform init \
        -backend-config="bucket=${PROJECT_NAME}-terraform-state-${AWS_REGION}" \
        -backend-config="key=${ENVIRONMENT}/terraform.tfstate" \
        -backend-config="region=${AWS_REGION}" \
        -backend-config="dynamodb_table=${PROJECT_NAME}-terraform-locks" \
        -backend-config="encrypt=true"
    
    # Validate configuration
    log_info "Validating Terraform configuration..."
    terraform validate
    
    # Plan
    log_info "Creating Terraform plan..."
    terraform plan \
        -var-file="environments/${ENVIRONMENT}/terraform.tfvars" \
        -out=tfplan
    
    # Apply
    log_info "Applying Terraform configuration..."
    read -p "Do you want to apply this plan? (yes/no): " confirm
    if [[ $confirm == "yes" ]]; then
        terraform apply tfplan
        log_success "Terraform deployment complete!"
    else
        log_warning "Terraform apply cancelled"
        exit 0
    fi
    
    # Get outputs
    log_info "Getting Terraform outputs..."
    terraform output -json > terraform-outputs.json
    
    cd ${SCRIPT_DIR}
}

configure_kubectl() {
    log_info "Configuring kubectl..."
    
    EKS_CLUSTER_NAME="${PROJECT_NAME}-${ENVIRONMENT}-eks"
    
    aws eks update-kubeconfig \
        --region ${AWS_REGION} \
        --name ${EKS_CLUSTER_NAME}
    
    # Verify connection
    kubectl cluster-info
    
    log_success "kubectl configured!"
}

deploy_kubernetes_resources() {
    log_info "Deploying Kubernetes resources..."
    
    # Create namespaces
    log_info "Creating namespaces..."
    kubectl apply -f ${K8S_DIR}/namespaces/namespaces.yaml
    
    # Wait for namespaces
    sleep 5
    
    # Create secrets (use external secrets in production)
    log_info "Creating secrets..."
    kubectl apply -f ${K8S_DIR}/secrets/secrets.yaml
    
    # Deploy databases
    log_info "Deploying MongoDB..."
    kubectl apply -f ${K8S_DIR}/databases/mongodb/deployment.yaml
    
    log_info "Deploying Redis..."
    kubectl apply -f ${K8S_DIR}/databases/redis/deployment.yaml
    
    # Wait for databases to be ready
    log_info "Waiting for databases to be ready..."
    kubectl wait --for=condition=ready pod -l app=mongodb -n databases --timeout=300s || true
    kubectl wait --for=condition=ready pod -l app=redis -n databases --timeout=300s || true
    
    # Deploy applications
    log_info "Deploying Backend..."
    kubectl apply -f ${K8S_DIR}/apps/backend/deployment.yaml
    
    log_info "Deploying Frontend..."
    kubectl apply -f ${K8S_DIR}/apps/frontend/deployment.yaml
    
    log_info "Deploying Celery Workers..."
    kubectl apply -f ${K8S_DIR}/apps/celery/deployment.yaml
    
    log_info "Deploying GPU Workers..."
    kubectl apply -f ${K8S_DIR}/apps/gpu-workers/deployment.yaml
    
    # Deploy Ingress
    log_info "Deploying Ingress..."
    kubectl apply -f ${K8S_DIR}/ingress/ingress.yaml
    
    log_success "Kubernetes resources deployed!"
}

deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    # Add Helm repos
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Install Prometheus + Grafana stack
    log_info "Installing Prometheus + Grafana..."
    helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set grafana.adminPassword="$(openssl rand -base64 12)" \
        --set prometheus.prometheusSpec.retention=30d \
        --wait
    
    # Install Loki for logs
    log_info "Installing Loki..."
    helm upgrade --install loki grafana/loki-stack \
        --namespace monitoring \
        --set loki.persistence.enabled=true \
        --set promtail.enabled=true \
        --wait
    
    log_success "Monitoring stack deployed!"
    
    # Get Grafana password
    GRAFANA_PASSWORD=$(kubectl get secret -n monitoring monitoring-grafana -o jsonpath="{.data.admin-password}" | base64 --decode)
    echo ""
    echo -e "${GREEN}Grafana Credentials:${NC}"
    echo "  Username: admin"
    echo "  Password: ${GRAFANA_PASSWORD}"
    echo ""
}

print_summary() {
    echo ""
    echo -e "${GREEN}=============================================="
    echo "  Deployment Complete!"
    echo "=============================================="
    echo ""
    echo "  Resources Created:"
    echo "  ✅ VPC with public/private subnets"
    echo "  ✅ EKS Cluster"
    echo "  ✅ ECR Repositories"
    echo "  ✅ RDS MySQL"
    echo "  ✅ S3 Buckets"
    echo "  ✅ CloudFront Distribution"
    echo "  ✅ MongoDB (EKS)"
    echo "  ✅ Redis (EKS)"
    echo "  ✅ Prometheus + Grafana"
    echo ""
    echo "  Useful Commands:"
    echo "  - kubectl get pods -n imeetpro"
    echo "  - kubectl get pods -n databases"
    echo "  - kubectl get pods -n monitoring"
    echo "  - kubectl logs -f deployment/backend -n imeetpro"
    echo ""
    echo "  Access URLs:"
    echo "  - Application: https://imeetpro.com"
    echo "  - API: https://api.imeetpro.com"
    echo "  - Grafana: kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring"
    echo ""
    echo -e "==============================================${NC}"
}

# Main execution
main() {
    print_banner
    
    case "${1:-all}" in
        "prereq")
            check_prerequisites
            ;;
        "backend")
            check_prerequisites
            create_terraform_backend
            ;;
        "terraform")
            check_prerequisites
            deploy_terraform
            ;;
        "k8s")
            check_prerequisites
            configure_kubectl
            deploy_kubernetes_resources
            ;;
        "monitoring")
            check_prerequisites
            configure_kubectl
            deploy_monitoring
            ;;
        "all")
            check_prerequisites
            create_terraform_backend
            deploy_terraform
            configure_kubectl
            deploy_kubernetes_resources
            deploy_monitoring
            print_summary
            ;;
        *)
            echo "Usage: $0 {prereq|backend|terraform|k8s|monitoring|all}"
            exit 1
            ;;
    esac
}

main "$@"
