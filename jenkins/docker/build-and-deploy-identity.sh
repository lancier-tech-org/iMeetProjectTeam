#!/bin/bash
# =============================================================================
# BUILD & DEPLOY: Identity Service GPU Pod
# =============================================================================
# Run from: iMeetProjectTeam/ (project root)
# =============================================================================

set -e

AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID="664418964913"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "============================================="
echo "  Step 1: Login to ECR"
echo "============================================="
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${ECR_REGISTRY}


echo "============================================="
echo "  Step 2: Create ECR repository for identity-service"
echo "============================================="
aws ecr create-repository \
    --repository-name imeetpro-prod/identity-service \
    --region ${AWS_REGION} 2>/dev/null || echo "Repository already exists"


echo "============================================="
echo "  Step 3: Rebuild GPU Base Image (ONLY if you modified Dockerfile.gpu-base)"
echo "============================================="
echo "  Skip this if you already rebuilt it."
echo "  To rebuild: cd jenkins/docker && bash build-gpu-base.sh"
echo ""
read -p "  Rebuild GPU base image? (y/N): " rebuild_base
if [ "$rebuild_base" = "y" ]; then
    cd jenkins/docker
    bash build-gpu-base.sh
    cd ../..
fi


echo "============================================="
echo "  Step 4: Build Identity Service Image"
echo "============================================="
docker build \
    -t ${ECR_REGISTRY}/imeetpro-prod/identity-service:latest \
    -f jenkins/docker/Dockerfile.identity-service \
    BackEnd/


echo "============================================="
echo "  Step 5: Build Backend Image (updated Attendance.py)"
echo "============================================="
docker build \
    -t ${ECR_REGISTRY}/imeetpro-prod/backend:latest \
    -f jenkins/docker/Dockerfile.backend \
    BackEnd/


echo "============================================="
echo "  Step 6: Push Images to ECR"
echo "============================================="
docker push ${ECR_REGISTRY}/imeetpro-prod/identity-service:latest
docker push ${ECR_REGISTRY}/imeetpro-prod/backend:latest


echo "============================================="
echo "  Step 7: Deploy Identity Service to Kubernetes"
echo "============================================="
kubectl apply -f kubernetes/apps/identity-service/deployment.yaml


echo "============================================="
echo "  Step 8: Restart Backend to pick up code changes"
echo "============================================="
kubectl rollout restart deployment/backend -n imeetpro


echo "============================================="
echo "  Step 9: Wait for rollouts"
echo "============================================="
echo "Waiting for identity-service..."
kubectl rollout status deployment/identity-service -n imeetpro --timeout=300s

echo "Waiting for backend..."
kubectl rollout status deployment/backend -n imeetpro --timeout=300s


echo "============================================="
echo "  Step 10: Verify GPU is working"
echo "============================================="
echo ""
echo "Run these commands to verify:"
echo ""
echo "  # Check identity-service pod is running with GPU:"
echo "  kubectl get pods -n imeetpro | grep identity"
echo ""
echo "  # Check GPU inside the pod:"
echo "  kubectl exec deployment/identity-service -n imeetpro -- python3 -c \"import torch; print(f'CUDA: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0)}')\""
echo ""
echo "  # Watch identity verification logs:"
echo "  kubectl logs -f deployment/identity-service -n imeetpro | grep -i 'identity\\|gpu\\|cuda'"
echo ""
echo "  # Check backend is sending tasks to identity-service:"
echo "  kubectl logs -f deployment/backend -n imeetpro | grep 'gpu_used'"
echo ""
echo "============================================="
echo "  DONE!"
echo "============================================="