#!/bin/bash
# =============================================================================
# Jenkins Server Auto-Installation Script
# This script runs when EC2 instance launches (via user_data)
# =============================================================================

set -e
exec > >(tee /var/log/jenkins-install.log) 2>&1

echo "=============================================="
echo "  iMeetPro Jenkins Server Installation"
echo "  Started at: $(date)"
echo "=============================================="

# Variables from Terraform
AWS_REGION="${aws_region}"
EKS_CLUSTER_NAME="${eks_cluster_name}"

# Update system
echo "[1/12] Updating system..."
apt-get update -y
apt-get upgrade -y

# Install Java 17
echo "[2/12] Installing Java 17..."
apt-get install -y openjdk-17-jdk
java -version

# Add Jenkins repository and install
echo "[3/12] Installing Jenkins..."
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | tee \
    /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
    https://pkg.jenkins.io/debian-stable binary/ | tee \
    /etc/apt/sources.list.d/jenkins.list > /dev/null
apt-get update -y
apt-get install -y jenkins

# Install Docker
echo "[4/12] Installing Docker..."
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add Jenkins user to Docker group
usermod -aG docker jenkins
usermod -aG docker ubuntu

# Install AWS CLI v2
echo "[5/12] Installing AWS CLI..."
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
apt-get install -y unzip
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip
aws --version

# Install kubectl
echo "[6/12] Installing kubectl..."
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl
kubectl version --client

# Install Helm
echo "[7/12] Installing Helm..."
curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | tee /usr/share/keyrings/helm.gpg > /dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | tee /etc/apt/sources.list.d/helm-stable-debian.list
apt-get update -y
apt-get install -y helm
helm version

# Install Trivy (Security Scanner)
echo "[8/12] Installing Trivy..."
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor | tee /usr/share/keyrings/trivy.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" | tee -a /etc/apt/sources.list.d/trivy.list
apt-get update -y
apt-get install -y trivy
trivy --version

# Install Node.js
echo "[9/12] Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version

# Install Python and pip
echo "[10/12] Installing Python..."
apt-get install -y python3 python3-pip python3-venv
python3 --version

# Install Git
echo "[11/12] Installing Git..."
apt-get install -y git
git --version

# Configure kubectl for EKS
echo "[12/12] Configuring kubectl for EKS..."
mkdir -p /var/lib/jenkins/.kube
mkdir -p /home/ubuntu/.kube

# Create kubeconfig update script
cat > /usr/local/bin/update-kubeconfig.sh << 'SCRIPT'
#!/bin/bash
aws eks update-kubeconfig --region $${AWS_REGION} --name $${EKS_CLUSTER_NAME}
SCRIPT
chmod +x /usr/local/bin/update-kubeconfig.sh

# Set permissions
chown -R jenkins:jenkins /var/lib/jenkins

# Start Jenkins
systemctl enable jenkins
systemctl start jenkins

# Wait for Jenkins to start
echo "Waiting for Jenkins to start..."
sleep 60

# Get initial admin password
JENKINS_PASSWORD=$(cat /var/lib/jenkins/secrets/initialAdminPassword 2>/dev/null || echo "Check /var/lib/jenkins/secrets/initialAdminPassword")

# Create info file
cat > /home/ubuntu/jenkins-info.txt << EOF
============================================
  iMeetPro Jenkins Server Information
============================================

Jenkins URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080

Initial Admin Password: $JENKINS_PASSWORD

SSH Access: ssh -i your-key.pem ubuntu@$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

EKS Cluster: ${eks_cluster_name}
AWS Region: ${aws_region}

============================================
  Installed Tools
============================================
- Java 17
- Jenkins
- Docker
- AWS CLI v2
- kubectl
- Helm
- Trivy
- Node.js 20
- Python 3
- Git

============================================
  Next Steps
============================================
1. Access Jenkins UI at the URL above
2. Enter the initial admin password
3. Install suggested plugins
4. Install additional plugins:
   - Docker Pipeline
   - Kubernetes
   - AWS Steps
   - Pipeline: AWS Steps
   - SonarQube Scanner
   - Slack Notification
   - Blue Ocean
5. Configure credentials
6. Create pipeline job

============================================
  Useful Commands
============================================
# Update kubeconfig
aws eks update-kubeconfig --region ${aws_region} --name ${eks_cluster_name}

# Test kubectl
kubectl get nodes

# Login to ECR
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin <account-id>.dkr.ecr.${aws_region}.amazonaws.com

============================================
EOF

chown ubuntu:ubuntu /home/ubuntu/jenkins-info.txt

echo ""
echo "=============================================="
echo "  Installation Complete!"
echo "  Check /home/ubuntu/jenkins-info.txt for details"
echo "  Completed at: $(date)"
echo "=============================================="
