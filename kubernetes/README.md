# iMeetPro Kubernetes Deployment Guide

## 📁 Directory Structure

```
kubernetes/
├── apps/
│   ├── backend/
│   │   ├── configmap.yaml      # Environment configuration
│   │   └── deployment.yaml     # Backend deployment + service
│   ├── frontend/
│   │   └── deployment.yaml     # Frontend deployment + service
│   ├── celery/
│   │   └── deployment.yaml     # Celery worker + beat deployments
│   └── gpu-workers/
│       └── deployment.yaml     # GPU worker deployment
├── databases/
│   ├── mongodb/
│   │   └── deployment.yaml     # MongoDB deployment + service
│   └── redis/
│       └── deployment.yaml     # Redis deployment + service
├── ingress/
│   └── ingress.yaml            # Ingress + ClusterIssuer for SSL
├── namespaces/
│   └── namespaces.yaml         # Namespace definitions
├── secrets/
│   └── secrets.yaml            # Secret templates (update before applying!)
├── Dockerfile.gpu              # GPU worker Dockerfile (copy to BackEnd/)
├── Jenkinsfile                 # CI/CD pipeline (copy to repo root)
└── README.md
```

## 🚀 Deployment Order

```bash
# 1. Create Namespaces
kubectl apply -f kubernetes/namespaces/namespaces.yaml

# 2. Deploy Databases
kubectl apply -f kubernetes/databases/mongodb/deployment.yaml
kubectl apply -f kubernetes/databases/redis/deployment.yaml

# 3. Wait for databases to be ready
kubectl get pods -n databases -w

# 4. Create Secrets (⚠️ Update values first!)
kubectl apply -f kubernetes/secrets/secrets.yaml

# 5. Create ConfigMap
kubectl apply -f kubernetes/apps/backend/configmap.yaml

# 6. Deploy Backend
kubectl apply -f kubernetes/apps/backend/deployment.yaml

# 7. Deploy Frontend
kubectl apply -f kubernetes/apps/frontend/deployment.yaml

# 8. Deploy Celery Workers
kubectl apply -f kubernetes/apps/celery/deployment.yaml

# 9. Create Ingress (SSL will be auto-provisioned)
kubectl apply -f kubernetes/ingress/ingress.yaml

# 10. (Optional) Deploy GPU Workers
# First install NVIDIA device plugin:
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.14.1/nvidia-device-plugin.yml
# Then deploy GPU workers:
kubectl apply -f kubernetes/apps/gpu-workers/deployment.yaml

# 11. Verify Deployment
kubectl get pods -n imeetpro
kubectl get pods -n databases
kubectl get ingress -n imeetpro
kubectl get certificate -n imeetpro
```

## ⚙️ Configuration

### ConfigMap (apps/backend/configmap.yaml)

Update these values for your environment:
- `DB_HOST` - Your RDS endpoint
- `MONGODB_HOST` - MongoDB service (default: mongodb.databases.svc.cluster.local)
- `REDIS_HOST` - Redis service (default: redis.databases.svc.cluster.local)
- `LIVEKIT_URL` - Your LiveKit server URL
- `AWS_STORAGE_BUCKET_NAME` - Your S3 bucket name

### Secrets (secrets/secrets.yaml)

⚠️ **Encode all values in base64 before applying!**

```bash
# Encode a value
echo -n 'your-password' | base64

# Decode a value
echo 'YmFzZTY0LXZhbHVl' | base64 -d
```

Update these secrets:
- `DB_USER` / `DB_PASSWORD` - RDS credentials
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` - LiveKit credentials
- `DJANGO_SECRET_KEY` - Generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`

### Ingress (ingress/ingress.yaml)

Update:
- Hostnames (`www.lancieretech.com`, `api.lancieretech.com`)
- Email for Let's Encrypt certificates

## 🔍 Troubleshooting

### Check Pod Logs
```bash
kubectl logs -l app=backend -n imeetpro --tail=50
kubectl logs -l app=frontend -n imeetpro --tail=50
kubectl logs -l app=celery-worker -n imeetpro --tail=50
```

### Check Pod Status
```bash
kubectl describe pod <pod-name> -n imeetpro
```

### Check Ingress
```bash
kubectl describe ingress imeetpro-ingress -n imeetpro
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=50
```

### Check Certificate
```bash
kubectl get certificate -n imeetpro
kubectl describe certificate imeetpro-tls -n imeetpro
```

### Database Connectivity
```bash
# Test from backend pod
kubectl exec -it deploy/backend -n imeetpro -- python -c "
import pymysql
conn = pymysql.connect(host='your-rds-endpoint', user='user', password='pass', database='db')
print('MySQL Connected!')
conn.close()
"
```

## 📝 Important Notes

1. **Frontend Port**: Container listens on **8080**, service maps 80 → 8080

2. **Backend Health Check**: Uses `/api/videos/lists` endpoint

3. **Celery Module**: Uses `-A SampleDB` (your Django project name)

4. **GPU Workers**: Require NVIDIA device plugin and GPU nodes with `nvidia.com/gpu=true` label

5. **MongoDB/Redis**: Using emptyDir volumes (data lost on restart). For production, configure PersistentVolumeClaims.

6. **RDS Security Group**: Ensure EKS nodes can access RDS (add VPC CIDR `10.0.0.0/16` to RDS security group)

## 🏗️ Architecture

```
                         ┌─────────────────────┐
                         │     GoDaddy DNS     │
                         │  lancieretech.com   │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   NGINX Ingress     │
                         │   (LoadBalancer)    │
                         │   + Let's Encrypt   │
                         └──────────┬──────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
┌────────▼────────┐      ┌──────────▼──────────┐    ┌──────────▼──────────┐
│    Frontend     │      │      Backend        │    │    Celery Workers   │
│  (React/Nginx)  │      │     (Django)        │    │    + GPU Workers    │
│    Port 8080    │      │    Port 8000        │    │                     │
│   3 replicas    │      │    3 replicas       │    │    2-4 replicas     │
└─────────────────┘      └──────────┬──────────┘    └──────────┬──────────┘
                                    │                          │
         ┌──────────────────────────┼──────────────────────────┤
         │                          │                          │
┌────────▼────────┐      ┌──────────▼──────────┐    ┌──────────▼──────────┐
│    MongoDB      │      │    MySQL RDS        │    │       Redis         │
│   Port 27017    │      │    Port 3306        │    │     Port 6379       │
│   (EKS Pod)     │      │   (AWS Managed)     │    │     (EKS Pod)       │
└─────────────────┘      └─────────────────────┘    └─────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   LiveKit Cloud     │
                         │  (Video/Audio)      │
                         └─────────────────────┘
```

## 🔄 CI/CD Pipeline

The Jenkinsfile includes:
- Automatic builds on code changes
- Docker image building for Frontend, Backend, GPU Worker
- Security scanning with Trivy
- Push to ECR
- Deploy to EKS with rolling updates

### Trigger Builds
- **Automatic**: Push to `frontend/` or `BackEnd/` directories
- **Manual**: Use Jenkins parameters `BUILD_ALL`, `BUILD_FRONTEND`, `BUILD_BACKEND`, `BUILD_GPU`

## 💰 Cost Optimization

- Use **Spot Instances** for Celery workers
- Scale down GPU workers when not needed
- Consider **Reserved Instances** for stable workloads
- Use **gp3** EBS volumes instead of gp2
