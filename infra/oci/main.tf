data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

data "oci_core_images" "ubuntu" {
  compartment_id           = var.tenancy_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = var.shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"

  filter {
    name   = "state"
    values = ["AVAILABLE"]
  }
}

locals {
  ad_name         = data.oci_identity_availability_domains.ads.availability_domains[local.selected_ad_index].name
  # Newest Ubuntu 24.04 for this shape (images sorted TIMECREATED DESC; state filter above)
  ubuntu_image_id = data.oci_core_images.ubuntu.images[0].id
  is_flex         = var.shape == "VM.Standard.A1.Flex"
  cloud_init      = file("${path.module}/cloud-init.yaml")
}

resource "oci_core_vcn" "adventure" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.0.0.0/16"]
  display_name   = "${var.project_name}-vcn"
  dns_label      = "adventure"
}

resource "oci_core_internet_gateway" "adventure" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.adventure.id
  display_name   = "${var.project_name}-igw"
  enabled        = true
}

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.adventure.id
  display_name   = "${var.project_name}-public-rt"

  route_rules {
    network_entity_id = oci_core_internet_gateway.adventure.id
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
  }
}

resource "oci_core_security_list" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.adventure.id
  display_name   = "${var.project_name}-public-sl"

  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }

  ingress_security_rules {
    protocol = "6"
    source   = var.admin_cidr
    tcp_options {
      min = 22
      max = 22
    }
  }

  # C1 smoke — restrict to admin_cidr; open 443 when C2 proxy lands
  ingress_security_rules {
    protocol = "6"
    source   = var.admin_cidr
    tcp_options {
      min = 8787
      max = 8787
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = var.admin_cidr
    tcp_options {
      min = 8790
      max = 8790
    }
  }
}

resource "oci_core_subnet" "public" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.adventure.id
  cidr_block                 = "10.0.1.0/24"
  display_name               = "${var.project_name}-public"
  dns_label                  = "public"
  prohibit_public_ip_on_vnic = false
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_security_list.public.id]
  availability_domain        = local.ad_name
}

resource "oci_core_instance" "adventure" {
  compartment_id      = var.compartment_ocid
  availability_domain = local.ad_name
  display_name        = "${var.project_name}-1"
  shape               = var.shape

  dynamic "shape_config" {
    for_each = local.is_flex ? [1] : []
    content {
      ocpus         = var.flex_ocpus
      memory_in_gbs = var.flex_memory_gbs
    }
  }

  source_details {
    source_type = "image"
    source_id   = local.ubuntu_image_id
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    assign_public_ip = true
    display_name     = "${var.project_name}-vnic"
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(local.cloud_init)
  }

  freeform_tags = {
    project = "adventure"
    stack   = "cloud-deploy-mvp"
  }
}
