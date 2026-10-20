#!/usr/bin/env bash
set -e

echo "[+] Validating Terraform Configuration..."
cd "$(dirname "$0")/../terraform"
terraform init -backend=false
terraform validate
echo "[✔] Terraform syntax and structure valid."
