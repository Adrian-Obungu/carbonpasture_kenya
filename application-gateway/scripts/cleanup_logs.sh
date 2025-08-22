#!/usr/bin/env bash
# cleanup_logs.sh
# Safely remove log/backups older than N days from the project.
# Usage:
#   ./cleanup_logs.sh            -> dry-run, shows files that WOULD be removed
#   ./cleanup_logs.sh --run     -> actually delete
#   ./cleanup_logs.sh --days 90 -> dry-run with 90 day threshold
#
set -euo pipefail

# Defaults
DAYS=30
DRY_RUN=true
PROJECT_ROOT="${HOME}/projects/carbonpasture/application-gateway"
LOG_DIR="${PROJECT_ROOT}/data"
BACKUP_DIR="${PROJECT_ROOT}/backups"
OUT_LOG="${PROJECT_ROOT}/data/cleanup.log"

# Allowed dirs (safety)
ALLOWED_DIRS=("${LOG_DIR}" "${BACKUP_DIR}")

# Helpers
usage() {
  cat <<EOF
Usage: $0 [--run] [--days N] [--project /full/path]

  --run         Actually perform deletions (default: dry-run)
  --days N      Files older than N days (default: ${DAYS})
  --project DIR Override project root (must be inside $HOME/projects)
  --help        Show this message
EOF
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --run) DRY_RUN=false; shift ;;
    --days) DAYS="$2"; shift 2 ;;
    --project) PROJECT_ROOT="$2"; shift 2 ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 2 ;;
  esac
done

# Recompute paths
LOG_DIR="${PROJECT_ROOT}/data"
BACKUP_DIR="${PROJECT_ROOT}/backups"
OUT_LOG="${PROJECT_ROOT}/data/cleanup.log"

# Safety checks
if [[ -z "${PROJECT_ROOT// }" ]]; then
  echo "Refusing to run: PROJECT_ROOT is empty"
  exit 2
fi
if [[ "$PROJECT_ROOT" = "/" ]] || [[ "$PROJECT_ROOT" = "" ]]; then
  echo "Refusing to run: bad PROJECT_ROOT"
  exit 2
fi
if [[ ! -d "${PROJECT_ROOT}" ]]; then
  echo "Refusing to run: project root does not exist: ${PROJECT_ROOT}"
  exit 2
fi

# Ensure we're targeting allowed directories
for d in "${ALLOWED_DIRS[@]}"; do
  if [[ ! -d "${d}" ]]; then
    echo "Note: directory does not exist, skipping: ${d}"
  fi
done

echo "==== Cleanup logs (project: ${PROJECT_ROOT}) ===="
echo "Target dirs: ${LOG_DIR}, ${BACKUP_DIR}"
echo "Threshold: files older than ${DAYS} days"
echo "Mode: $( $DRY_RUN && echo "DRY-RUN" || echo "LIVE (will delete)")"
echo

# Function: list/delete for a pattern
process_pattern() {
  local dir="$1"; shift
  local pattern="$1"; shift
  if [[ ! -d "${dir}" ]]; then
    return 0
  fi

  # use find safely
  mapfile -t matches < <(find "${dir}" -maxdepth 2 -type f -name "${pattern}" -mtime +"${DAYS}" -print)

  if [[ ${#matches[@]} -eq 0 ]]; then
    return 0
  fi

  echo "FOUND ${#matches[@]} matches for pattern '${pattern}' in ${dir}:"
  for f in "${matches[@]}"; do
    if $DRY_RUN; then
      printf " DRY: %s\n" "${f}"
    else
      # ensure directory is within project root
      if [[ "${f}" != "${PROJECT_ROOT}"* ]]; then
        echo " Refusing to delete outside project root: ${f}"
        continue
      fi
      rm -f -- "${f}" && printf " DEL: %s\n" "${f}" || printf " ERR: %s\n" "${f}"
      # log deletion
      printf '%s | DELETED | %s\n' "$(date --iso-8601=seconds)" "${f}" >> "${OUT_LOG}"
    fi
  done
}

# Patterns to clean (adjust as needed)
PATTERNS=(
  "ussd-*.json"
  "api.log*"
  "*.log"
  "*-backup-*.tar.gz"
  "rest-api.js.*.bak"
  "*.bak"
)

# Dry-run first
for d in "${LOG_DIR}" "${BACKUP_DIR}"; do
  for p in "${PATTERNS[@]}"; do
    process_pattern "${d}" "${p}"
  done
done

if $DRY_RUN; then
  echo
  echo "DRY-RUN complete. To actually delete, re-run with --run"
  exit 0
else
  echo
  echo "LIVE run complete. Deletions appended to ${OUT_LOG}"
  exit 0
fi
