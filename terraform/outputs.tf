output "security_group_id" {
  description = "ID of the OpsGuard security group"
  value       = aws_security_group.opsguard_sg.id
}

output "security_group_arn" {
  description = "ARN of the OpsGuard security group"
  value       = aws_security_group.opsguard_sg.arn
}
