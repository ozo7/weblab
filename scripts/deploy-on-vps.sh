#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="/srv/docker/webviewer"
BACKUP_ROOT="/srv/docker/backups/webviewer"
PRESERVE_FILES=("docker-compose.yml" "Dockerfile")

usage() {
  echo "Usage: $0 /path/to/dist.tar.gz" >&2
}

if [[ $# -ne 1 ]]; then
  usage
  exit 2
fi

ARTIFACT_PATH="$1"

if [[ ! -f "${ARTIFACT_PATH}" ]]; then
  echo "Artifact not found: ${ARTIFACT_PATH}" >&2
  exit 1
fi

if [[ ! -r "${ARTIFACT_PATH}" ]]; then
  echo "Artifact not readable: ${ARTIFACT_PATH}" >&2
  exit 1
fi

if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "Target directory missing: ${TARGET_DIR}" >&2
  exit 1
fi

ts="$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_ROOT}"
backup_file="${BACKUP_ROOT}/webviewer_${ts}.tar.gz"
preserve_tmp_dir="$(mktemp -d /tmp/webviewer-preserve.XXXXXX)"
cleanup() {
  rm -rf "${preserve_tmp_dir}"
}
trap cleanup EXIT

echo "Creating backup: ${backup_file}"
tar -czf "${backup_file}" -C "$(dirname "${TARGET_DIR}")" "$(basename "${TARGET_DIR}")"

echo "Preserving server-side docker files"
for name in "${PRESERVE_FILES[@]}"; do
  if [[ -f "${TARGET_DIR}/${name}" ]]; then
    cp -a "${TARGET_DIR}/${name}" "${preserve_tmp_dir}/${name}"
  fi
done

echo "Removing current deployment files from ${TARGET_DIR}"
find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

echo "Extracting artifact into ${TARGET_DIR}"
tar -xzf "${ARTIFACT_PATH}" -C "${TARGET_DIR}"

echo "Restoring preserved docker files"
for name in "${PRESERVE_FILES[@]}"; do
  if [[ -f "${preserve_tmp_dir}/${name}" ]]; then
    cp -a "${preserve_tmp_dir}/${name}" "${TARGET_DIR}/${name}"
  fi
done

echo
echo "Deployment files updated."
echo "Backup created at: ${backup_file}"
echo
echo "Next commands (not executed):"
echo "1) cd ${TARGET_DIR}"
echo "2) docker compose config"
echo "3) docker compose up -d --build"
echo "4) docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}' | grep webviewer || true"
echo "5) curl -fsS -I http://127.0.0.1:8001/ | head -n 5"
echo "6) curl -fsS -I https://webviewer.isonthenet.de/ | head -n 5"
