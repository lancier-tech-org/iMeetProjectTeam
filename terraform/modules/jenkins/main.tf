# =============================================================================
# Jenkins Module - Main Configuration
# =============================================================================
# Jenkins Server in Public Subnet of Project VPC
# Direct access to EKS cluster (private endpoint)
# =============================================================================

# -----------------------------------------------------------------------------
# Security Group for Jenkins
# -----------------------------------------------------------------------------
resource "aws_security_group" "jenkins" {
  name        = "${var.name_prefix}-jenkins-sg"
  description = "Security group for Jenkins server"
  vpc_id      = var.vpc_id

  # SSH Access (restrict to your IP in production)
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidrs
  }

  # Jenkins Web UI
  ingress {
    description = "Jenkins Web UI"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = var.allowed_jenkins_cidrs
  }

  # Jenkins Agent Port
  ingress {
    description = "Jenkins Agent"
    from_port   = 50000
    to_port     = 50000
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # HTTPS (if using reverse proxy)
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_jenkins_cidrs
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-jenkins-sg"
  })
}

# -----------------------------------------------------------------------------
# IAM Role for Jenkins EC2
# -----------------------------------------------------------------------------
resource "aws_iam_role" "jenkins" {
  name = "${var.name_prefix}-jenkins-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for Jenkins - ECR, EKS, S3 access
resource "aws_iam_role_policy" "jenkins" {
  name = "${var.name_prefix}-jenkins-policy"
  role = aws_iam_role.jenkins.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAccess"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = "*"
      },
      {
        Sid    = "EKSAccess"
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:ListClusters",
          "eks:AccessKubernetesApi"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.name_prefix}-*",
          "arn:aws:s3:::${var.name_prefix}-*/*"
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "jenkins" {
  name = "${var.name_prefix}-jenkins-profile"
  role = aws_iam_role.jenkins.name

  tags = var.tags
}

# -----------------------------------------------------------------------------
# SSH Key Pair (optional - use existing or create new)
# -----------------------------------------------------------------------------
resource "tls_private_key" "jenkins" {
  count     = var.create_ssh_key ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "jenkins" {
  count      = var.create_ssh_key ? 1 : 0
  key_name   = "${var.name_prefix}-jenkins-key"
  public_key = tls_private_key.jenkins[0].public_key_openssh

  tags = var.tags
}

# Save private key to local file
resource "local_file" "jenkins_private_key" {
  count           = var.create_ssh_key ? 1 : 0
  content         = tls_private_key.jenkins[0].private_key_pem
  filename        = "${path.module}/jenkins-key.pem"
  file_permission = "0400"
}

# -----------------------------------------------------------------------------
# Jenkins EC2 Instance
# -----------------------------------------------------------------------------
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "jenkins" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  key_name                    = var.create_ssh_key ? aws_key_pair.jenkins[0].key_name : var.existing_key_name
  vpc_security_group_ids      = [aws_security_group.jenkins.id]
  subnet_id                   = var.public_subnet_id
  iam_instance_profile        = aws_iam_instance_profile.jenkins.name
  associate_public_ip_address = true

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    delete_on_termination = true
    encrypted             = true

    tags = merge(var.tags, {
      Name = "${var.name_prefix}-jenkins-root"
    })
  }

  user_data = base64encode(templatefile("${path.module}/jenkins-userdata.sh", {
    aws_region       = var.aws_region
    eks_cluster_name = var.eks_cluster_name
  }))

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-jenkins"
    Role = "CI/CD"
  })

  lifecycle {
    ignore_changes = [ami]
  }
}

# -----------------------------------------------------------------------------
# Elastic IP for Jenkins (optional but recommended)
# -----------------------------------------------------------------------------
resource "aws_eip" "jenkins" {
  count    = var.create_elastic_ip ? 1 : 0
  instance = aws_instance.jenkins.id
  domain   = "vpc"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-jenkins-eip"
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms for Jenkins
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "jenkins_cpu" {
  alarm_name          = "${var.name_prefix}-jenkins-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Jenkins server CPU utilization is high"

  dimensions = {
    InstanceId = aws_instance.jenkins.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "jenkins_status" {
  alarm_name          = "${var.name_prefix}-jenkins-status-check"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Jenkins server status check failed"

  dimensions = {
    InstanceId = aws_instance.jenkins.id
  }

  tags = var.tags
}
