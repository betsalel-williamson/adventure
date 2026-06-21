locals {
  shape_limit_name = startswith(var.shape, "VM.Standard.E2.1") ? "standard-e2-micro-core-count" : "standard-a1-core-count"
}

# Always Free shapes exist in one AD per region — not necessarily PHX-AD-1.
data "oci_limits_resource_availability" "shape" {
  count               = length(data.oci_identity_availability_domains.ads.availability_domains)
  compartment_id      = var.tenancy_ocid
  service_name        = "compute"
  limit_name          = local.shape_limit_name
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[count.index].name
}

locals {
  ads_with_shape_capacity = [
    for i, avail in data.oci_limits_resource_availability.shape : i
    if avail.available > 0
  ]
  selected_ad_index = var.auto_select_availability_domain && length(local.ads_with_shape_capacity) > 0 ? (
    local.ads_with_shape_capacity[0]
  ) : var.availability_domain_index
}
