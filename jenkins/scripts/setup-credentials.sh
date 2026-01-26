#!/bin/bash
# =============================================================================
# Jenkins Credentials Setup Script
# Run this after Jenkins installation to configure credentials via CLI
# =============================================================================

# Variables - UPDATE THESE VALUES
JENKINS_URL="http://localhost:8080"
JENKINS_USER="admin"
JENKINS_PASSWORD="your-jenkins-admin-password"
AWS_ACCESS_KEY="your-aws-access-key"
AWS_SECRET_KEY="your-aws-secret-key"
AWS_ACCOUNT_ID="your-aws-account-id"
GITHUB_TOKEN="your-github-personal-access-token"
SONAR_TOKEN="your-sonarqube-token"
SONAR_URL="http://sonarqube.imeetpro.com:9000"
SLACK_TOKEN="your-slack-webhook-token"

# Download Jenkins CLI
echo "Downloading Jenkins CLI..."
wget ${JENKINS_URL}/jnlpJars/jenkins-cli.jar -O jenkins-cli.jar

# Function to create credential
create_credential() {
    local id=$1
    local description=$2
    local type=$3
    local value=$4
    
    echo "Creating credential: ${id}"
    
    case $type in
        "secret")
            echo "<org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl>
              <scope>GLOBAL</scope>
              <id>${id}</id>
              <description>${description}</description>
              <secret>${value}</secret>
            </org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl>" | \
            java -jar jenkins-cli.jar -s ${JENKINS_URL} -auth ${JENKINS_USER}:${JENKINS_PASSWORD} \
            create-credentials-by-xml system::system::jenkins _
            ;;
        "username-password")
            IFS=':' read -r username password <<< "${value}"
            echo "<com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl>
              <scope>GLOBAL</scope>
              <id>${id}</id>
              <description>${description}</description>
              <username>${username}</username>
              <password>${password}</password>
            </com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl>" | \
            java -jar jenkins-cli.jar -s ${JENKINS_URL} -auth ${JENKINS_USER}:${JENKINS_PASSWORD} \
            create-credentials-by-xml system::system::jenkins _
            ;;
    esac
}

echo "=============================================="
echo "  Setting up Jenkins Credentials"
echo "=============================================="

# AWS Credentials
create_credential "aws-credentials" "AWS Access Credentials" "username-password" "${AWS_ACCESS_KEY}:${AWS_SECRET_KEY}"
create_credential "aws-account-id" "AWS Account ID" "secret" "${AWS_ACCOUNT_ID}"

# GitHub Credentials
create_credential "github-credentials" "GitHub Personal Access Token" "username-password" "git:${GITHUB_TOKEN}"
create_credential "github-token" "GitHub Token" "secret" "${GITHUB_TOKEN}"

# SonarQube Credentials
create_credential "sonar-token" "SonarQube Token" "secret" "${SONAR_TOKEN}"
create_credential "sonar-host-url" "SonarQube URL" "secret" "${SONAR_URL}"

# Slack Credentials
create_credential "slack-token" "Slack Webhook Token" "secret" "${SLACK_TOKEN}"

# Docker Hub (if needed)
# create_credential "dockerhub-credentials" "Docker Hub Credentials" "username-password" "username:password"

echo ""
echo "=============================================="
echo "  Credentials setup complete!"
echo "=============================================="
echo ""
echo "Credentials created:"
echo "  - aws-credentials"
echo "  - aws-account-id"
echo "  - github-credentials"
echo "  - github-token"
echo "  - sonar-token"
echo "  - sonar-host-url"
echo "  - slack-token"
echo ""

# Cleanup
rm -f jenkins-cli.jar
