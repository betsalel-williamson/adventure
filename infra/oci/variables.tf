variable "tenancy_ocid" {
  type        = string
  description = "OCI tenancy OCID"
}

variable "user_ocid" {
  type        = string
  description = "OCI user OCID for API signing"
}

variable "api_key_fingerprint" {
  type        = string
  description = "API key fingerprint"
}

variable "private_key_path" {
  type        = string
  description = "Path to PEM private key for API signing"
  default     = "~/.oci/oci_api_key.pem"
}

variable "region" {
  type        = string
  description = "OCI region (home region recommended)"
}

variable "compartment_ocid" {
  type        = string
  description = "Compartment OCID for Adventure resources"
}

variable "project_name" {
  type        = string
  description = "Prefix for resource names"
  default     = "adventure-mvp"
}

variable "admin_cidr" {
  type        = string
  description = "CIDR allowed for SSH and C1 API ports (use your public IP/32)"
}

variable "ssh_public_key" {
  type        = string
  description = "OpenSSH public key for the ubuntu user"
}

variable "shape" {
  type        = string
  description = "Compute shape — VM.Standard.A1.Flex (ARM) or VM.Standard.E2.1.Micro (x86)"
  default     = "VM.Standard.A1.Flex"
}

variable "flex_ocpus" {
  type        = number
  description = "OCPUs when shape is VM.Standard.A1.Flex"
  default     = 2
}

variable "flex_memory_gbs" {
  type        = number
  description = "Memory (GB) when shape is VM.Standard.A1.Flex"
  default     = 12
}

variable "availability_domain_index" {
  type        = number
  description = "0-based AD index when auto_select_availability_domain is false"
  default     = 0
}

variable "auto_select_availability_domain" {
  type        = bool
  description = "Pick the first AD with Always Free capacity for the selected shape (recommended)"
  default     = true
}
