#!/bin/bash
# =============================================================================
# iMeetPro Jenkins Server Setup Script
# Run this on EC2 instance (t3.large recommended)
# =============================================================================

set -e

echo "=============================================="
echo "  iMeetPro Jenkins Server Installation"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
JENKINS_HOME="/var/lib/jenkins"
AWS_REGION="ap-south-1"

# Update system
echo -e "${YELLOW}[1/10] Updating system...${NC}"
sudo apt-get update -y
sudo apt-get upgrade -y

# Install Java 17 (Required for Jenkins)
echo -e "${YELLOW}[2/10] Installing Java 17...${NC}"
sudo apt-get install -y openjdk-17-jdk
java -version

# Add Jenkins repository and install
echo -e "${YELLOW}[3/10] Installing Jenkins...${NC}"
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
    /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
    https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
    /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y jenkins

# Install Docker
echo -e "${YELLOW}[4/10] Installing Docker...${NC}"
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add Jenkins user to Docker group
sudo usermod -aG docker jenkins

# Install AWS CLI v2
echo -e "${YELLOW}[5/10] Installing AWS CLI...${NC}"
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
sudo apt-get install -y unzip
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip
aws --version

# Install kubectl
echo -e "${YELLOW}[6/10] Installing kubectl...${NC}"
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl
kubectl version --client

# Install Helm
echo -e "${YELLOW}[7/10] Installing Helm...${NC}"
curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | sudo tee /usr/share/keyrings/helm.gpg > /dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list
sudo apt-get update -y
sudo apt-get install -y helm
helm version

# Install Trivy (Security Scanner)
echo -e "${YELLOW}[8/10] Installing Trivy...${NC}"
sudo apt-get install -y wget apt-transport-https gnupg
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor | sudo tee /usr/share/keyrings/trivy.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update -y
sudo apt-get install -y trivy
trivy --version

# Install SonarQube Scanner
echo -e "${YELLOW}[9/10] Installing SonarQube Scanner...${NC}"
SONAR_SCANNER_VERSION="5.0.1.3006"
wget https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux.zip
unzip sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux.zip
sudo mv sonar-scanner-${SONAR_SCANNER_VERSION}-linux /opt/sonar-scanner
sudo ln -sf /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner
rm sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux.zip

# Install Node.js (for frontend builds)
echo -e "${YELLOW}[10/10] Installing Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version

# Configure Jenkins
echo -e "${YELLOW}Configuring Jenkins...${NC}"

# Create Jenkins configuration directory
sudo mkdir -p ${JENKINS_HOME}/init.groovy.d

# Create initial admin setup script
sudo tee ${JENKINS_HOME}/init.groovy.d/basic-security.groovy > /dev/null << 'EOF'
#!groovy
import jenkins.model.*
import hudson.security.*
import jenkins.security.s2m.AdminWhitelistRule

def instance = Jenkins.getInstance()

// Create admin user
def hudsonRealm = new HudsonPrivateSecurityRealm(false)
hudsonRealm.createAccount("admin", "admin123")  // Change this password!
instance.setSecurityRealm(hudsonRealm)

def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
strategy.setAllowAnonymousRead(false)
instance.setAuthorizationStrategy(strategy)

instance.save()
EOF

# Set proper permissions
sudo chown -R jenkins:jenkins ${JENKINS_HOME}

# Start Jenkins
sudo systemctl enable jenkins
sudo systemctl restart jenkins

# Wait for Jenkins to start
echo -e "${YELLOW}Waiting for Jenkins to start...${NC}"
sleep 60

# Get initial admin password
echo -e "${GREEN}=============================================="
echo "  Jenkins Installation Complete!"
echo "=============================================="
echo ""
echo "Access Jenkins at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080"
echo ""
echo "Initial Admin Password:"
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
echo ""
echo "=============================================="
echo ""
echo "Next Steps:"
echo "1. Access Jenkins UI"
echo "2. Install suggested plugins"
echo "3. Install additional plugins:"
echo "   - Docker Pipeline"
echo "   - Kubernetes"
echo "   - AWS Steps"
echo "   - SonarQube Scanner"
echo "   - Slack Notification"
echo "   - Blue Ocean"
echo "   - Pipeline: AWS Steps"
echo "4. Configure credentials"
echo "5. Create pipeline jobs"
echo "=============================================="
echo -e "${NC}"
