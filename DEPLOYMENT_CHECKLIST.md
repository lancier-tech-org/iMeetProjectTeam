# =============================================================================
# iMeetPro Deployment Checklist for lancieretech.com
# =============================================================================

## ═══════════════════════════════════════════════════════════════════════════
## PHASE 1: BEFORE TERRAFORM (Preparation) ⏱️ ~30 minutes
## ═══════════════════════════════════════════════════════════════════════════

### Step 1: AWS CLI Configure
- [ ] Install AWS CLI v2
- [ ] Run `aws configure`
- [ ] Verify with `aws sts get-caller-identity`
- [ ] Note down Account ID: _______________

### Step 2: Update terraform.tfvars
- [ ] Open: terraform/environments/prod/terraform.tfvars
- [ ] Set strong rds_password: _____________________________
- [ ] Verify domain_name: lancieretech.com ✓
- [ ] Verify S3 bucket names are unique

### Step 3: Create ACM Certificate
- [ ] Go to AWS Console → ACM → ap-south-1 region
- [ ] Request certificate for:
      - lancieretech.com
      - *.lancieretech.com
- [ ] Add DNS validation records to your domain registrar
- [ ] Wait for certificate to be "Issued" (5-30 minutes)
- [ ] Copy Certificate ARN: _________________________________
- [ ] Paste ARN in terraform.tfvars (certificate_arn)


## ═══════════════════════════════════════════════════════════════════════════
## PHASE 2: TERRAFORM APPLY ⏱️ ~20 minutes
## ═══════════════════════════════════════════════════════════════════════════

### Step 4-6: Run Terraform
- [ ] cd imeetpro-infra/terraform
- [ ] terraform init
- [ ] terraform plan -var-file="environments/prod/terraform.tfvars"
- [ ] Review plan carefully
- [ ] terraform apply -var-file="environments/prod/terraform.tfvars"
- [ ] Type "yes" to confirm
- [ ] Wait for completion (~15-20 minutes)

### Step 6B: Save Outputs
- [ ] terraform output > ../outputs.txt
- [ ] Note RDS Endpoint: _________________________________
- [ ] Note EKS Cluster Name: imeetpro-prod-eks
- [ ] Note ECR URLs from output


## ═══════════════════════════════════════════════════════════════════════════
## PHASE 3: AFTER TERRAFORM ⏱️ ~45 minutes
## ═══════════════════════════════════════════════════════════════════════════

### Step 7: Configure kubectl
- [ ] aws eks update-kubeconfig --region ap-south-1 --name imeetpro-prod-eks
- [ ] kubectl cluster-info
- [ ] kubectl get nodes (should show 5 nodes)

### Step 8: Update Kubernetes Secrets & ConfigMaps
- [ ] Generate Django SECRET_KEY
- [ ] Update kubernetes/secrets/secrets.yaml:
      - [ ] SECRET_KEY
      - [ ] DB_PASSWORD (same as terraform.tfvars)
      - [ ] MONGODB_PASSWORD
      - [ ] REDIS_PASSWORD
      - [ ] LIVEKIT_API_KEY
      - [ ] LIVEKIT_API_SECRET
- [ ] Update kubernetes/apps/backend/configmap.yaml:
      - [ ] DB_HOST (RDS endpoint from terraform output)

### Step 9: Deploy Kubernetes Resources
- [ ] kubectl apply -f kubernetes/namespaces/
- [ ] kubectl apply -f kubernetes/secrets/
- [ ] kubectl apply -f kubernetes/apps/backend/configmap.yaml
- [ ] kubectl apply -f kubernetes/databases/mongodb/
- [ ] kubectl apply -f kubernetes/databases/redis/
- [ ] Wait: kubectl get pods -n databases -w
- [ ] kubectl apply -f kubernetes/apps/backend/
- [ ] kubectl apply -f kubernetes/apps/frontend/
- [ ] kubectl apply -f kubernetes/apps/celery/
- [ ] kubectl apply -f kubernetes/ingress/

### Step 10: Setup Jenkins
- [ ] Launch EC2 instance (t3.large, Ubuntu 22.04)
- [ ] Security Group: ports 22, 8080, 50000
- [ ] Run install-jenkins.sh
- [ ] Access Jenkins UI
- [ ] Install plugins
- [ ] Configure credentials:
      - [ ] aws-account-id
      - [ ] aws-credentials
      - [ ] github-credentials
      - [ ] sonar-token (if using SonarQube)
      - [ ] slack-token (if using Slack)
- [ ] Create pipeline job pointing to Jenkinsfile

### Step 11: Configure DNS
- [ ] Get ALB DNS: kubectl get ingress -n imeetpro -o wide
- [ ] Get CloudFront Domain: terraform output cloudfront_domain_name
- [ ] Add DNS records:
      - [ ] lancieretech.com → CloudFront
      - [ ] www.lancieretech.com → CloudFront
      - [ ] api.lancieretech.com → ALB DNS
      - [ ] grafana.lancieretech.com → Internal ALB (optional)

### Step 12: Final Verification
- [ ] curl https://lancieretech.com
- [ ] curl https://api.lancieretech.com/api/health/
- [ ] kubectl get pods -n imeetpro (all Running)
- [ ] kubectl get pods -n databases (all Running)
- [ ] kubectl get pods -n monitoring (all Running)
- [ ] Test Jenkins pipeline with a test build


## ═══════════════════════════════════════════════════════════════════════════
## PASSWORDS TO SAVE (Store Securely!)
## ═══════════════════════════════════════════════════════════════════════════

RDS Password: ___________________________________
MongoDB Password: _______________________________
Redis Password: _________________________________
Django Secret Key: ______________________________
Grafana Password: _______________________________ (from terraform output)
Jenkins Admin Password: _________________________
LiveKit API Key: ________________________________
LiveKit API Secret: _____________________________


## ═══════════════════════════════════════════════════════════════════════════
## USEFUL COMMANDS
## ═══════════════════════════════════════════════════════════════════════════

# Check pod logs
kubectl logs -f deployment/backend -n imeetpro

# Check pod status
kubectl describe pod <pod-name> -n imeetpro

# Access Grafana
kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring

# Get Grafana password
kubectl get secret monitoring-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 --decode

# Restart deployment
kubectl rollout restart deployment/backend -n imeetpro

# Scale deployment
kubectl scale deployment/backend --replicas=5 -n imeetpro
