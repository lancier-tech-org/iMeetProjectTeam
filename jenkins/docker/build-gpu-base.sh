#!/bin/bash
# =============================================================================
# ONE-TIME SETUP: Build GPU Worker Base Image
# =============================================================================
# Run this script ONCE to create the base image with all heavy dependencies
# This will save 40+ minutes on every subsequent GPU Worker build!
# =============================================================================

set -e

# Configuration
AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID="664418964913"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
GPU_BASE_REPO="${ECR_REGISTRY}/imeetpro-prod/gpu-worker-base"
VERSION="v1"

echo "============================================="
echo "  Building GPU Worker Base Image"
echo "  This will take 30-45 minutes (ONE TIME ONLY)"
echo "============================================="

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Create ECR repository if not exists
echo "📦 Creating ECR repository..."
aws ecr create-repository \
    --repository-name imeetpro-prod/gpu-worker-base \
    --region ${AWS_REGION} 2>/dev/null || echo "Repository already exists"

# Build the base image
echo "🏗️ Building base image (this takes 30-45 minutes)..."
DOCKER_BUILDKIT=1 docker build \
    -t ${GPU_BASE_REPO}:${VERSION} \
    -t ${GPU_BASE_REPO}:latest \
    -f Dockerfile.gpu-base \
    .

# Push to ECR
echo "📤 Pushing to ECR..."
docker push ${GPU_BASE_REPO}:${VERSION}
docker push ${GPU_BASE_REPO}:latest

echo "============================================="
echo "  ✅ GPU Base Image Created Successfully!"
echo "============================================="
echo ""
echo "  Image: ${GPU_BASE_REPO}:${VERSION}"
echo ""
echo "  Now your GPU Worker builds will take ~5 minutes"
echo "  instead of 50 minutes!"
echo ""
echo "============================================="
