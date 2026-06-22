output "availability_domain" {
  value       = local.ad_name
  description = "AD used for subnet + instance (Always Free shapes are AD-specific)"
}

output "availability_domain_index" {
  value       = local.selected_ad_index
  description = "0-based AD index selected for this apply"
}

output "ubuntu_image" {
  value       = data.oci_core_images.ubuntu.images[0].display_name
  description = "Boot image display name (debug)"
}

output "vcn_id" {
  value       = oci_core_vcn.adventure.id
  description = "VCN OCID"
}

output "instance_id" {
  value       = oci_core_instance.adventure.id
  description = "Compute instance OCID"
}

output "instance_public_ip" {
  value       = oci_core_instance.adventure.public_ip
  description = "Public IPv4 for SSH and C1 health checks"
}

output "ssh_command" {
  value       = "ssh ubuntu@${oci_core_instance.adventure.public_ip}"
  description = "SSH to the instance"
}

output "health_check_v2" {
  value       = "curl -sf http://${oci_core_instance.adventure.public_ip}:8787/health"
  description = "v2 health after container deploy"
}

output "health_check_assist" {
  value       = "curl -sf http://${oci_core_instance.adventure.public_ip}:8790/assist/health"
  description = "assist health after container deploy"
}
