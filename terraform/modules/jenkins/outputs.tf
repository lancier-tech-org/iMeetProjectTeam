# =============================================================================
# Jenkins Module - Outputs
# =============================================================================

output "instance_id" {
  description = "Jenkins EC2 instance ID"
  value       = aws_instance.jenkins.id
}

output "private_ip" {
  description = "Jenkins private IP"
  value       = aws_instance.jenkins.private_ip
}

output "public_ip" {
  description = "Jenkins public IP"
  value       = var.create_elastic_ip ? aws_eip.jenkins[0].public_ip : aws_instance.jenkins.public_ip
}

output "jenkins_url" {
  description = "Jenkins URL"
  value       = "http://${var.create_elastic_ip ? aws_eip.jenkins[0].public_ip : aws_instance.jenkins.public_ip}:8080"
}

output "security_group_id" {
  description = "Jenkins security group ID"
  value       = aws_security_group.jenkins.id
}

output "iam_role_arn" {
  description = "Jenkins IAM role ARN"
  value       = aws_iam_role.jenkins.arn
}

output "ssh_private_key" {
  description = "SSH private key for Jenkins (if created)"
  value       = var.create_ssh_key ? tls_private_key.jenkins[0].private_key_pem : null
  sensitive   = true
}

output "ssh_command" {
  description = "SSH command to connect to Jenkins"
  value       = "ssh -i jenkins-key.pem ubuntu@${var.create_elastic_ip ? aws_eip.jenkins[0].public_ip : aws_instance.jenkins.public_ip}"
}
