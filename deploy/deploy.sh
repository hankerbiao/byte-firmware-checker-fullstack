#!/usr/bin/env bash
set -Eeuo pipefail

SERVER_HOST="10.17.158.114"
SERVER_USER="root"
REMOTE_DIR="/root/firmware-checker"
LOCAL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_IMAGE="firmware-checker-backend:deploy"

SSH_BASE_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
SSH_CMD=(ssh "${SSH_BASE_OPTS[@]}")
RSYNC_SSH="ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required on this machine." >&2
  exit 1
fi

if [[ ! -f "${LOCAL_ROOT}/backend/.env" ]]; then
  echo "Missing backend/.env. Create it from backend/.env.example and set the MongoDB credentials first." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to build the deployment image." >&2
  exit 1
fi

echo "Building frontend assets..."
(
  cd "${LOCAL_ROOT}/frontend"
  if [[ ! -x ./node_modules/.bin/vite ]]; then
    corepack pnpm install --frozen-lockfile
  fi
  VITE_BASE_PATH=/firmware-checker/ \
    VITE_API_BASE_PATH=/firmware-checker \
    ./node_modules/.bin/vite build
)

echo "Building ${BACKEND_IMAGE} for linux/amd64..."
docker buildx build \
  --platform linux/amd64 \
  --load \
  --tag "${BACKEND_IMAGE}" \
  "${LOCAL_ROOT}/backend"

if ! ssh "${SSH_BASE_OPTS[@]}" -o BatchMode=yes "${SERVER_USER}@${SERVER_HOST}" true >/dev/null 2>&1; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "SSH key authentication is unavailable and sshpass is not installed." >&2
    echo "Install sshpass or configure an SSH key, then retry." >&2
    exit 1
  fi

  read -r -s -p "SSH password for ${SERVER_USER}@${SERVER_HOST}: " SSHPASS
  printf '\n'
  export SSHPASS
  SSH_CMD=(sshpass -e ssh "${SSH_BASE_OPTS[@]}")
  RSYNC_SSH="sshpass -e ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
fi

echo "Preparing ${REMOTE_DIR} on ${SERVER_HOST}..."
"${SSH_CMD[@]}" "${SERVER_USER}@${SERVER_HOST}" "mkdir -p '${REMOTE_DIR}'"

echo "Transferring backend image..."
docker save "${BACKEND_IMAGE}" | gzip | "${SSH_CMD[@]}" "${SERVER_USER}@${SERVER_HOST}" "gunzip | docker load"

echo "Uploading project files..."
SSHPASS="${SSHPASS-}" rsync -az \
  --exclude='.git/' \
  --exclude='data/' \
  --exclude='node_modules/' \
  --exclude='frontend/build/' \
  --exclude='frontend/.vite/' \
  --exclude='backend/.venv/' \
  --exclude='backend/__pycache__/' \
  --exclude='**/__pycache__/' \
  --exclude='.mypy_cache/' \
  --exclude='.ruff_cache/' \
  -e "${RSYNC_SSH}" \
  "${LOCAL_ROOT}/" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"

echo "Building and starting Docker Compose services..."
"${SSH_CMD[@]}" "${SERVER_USER}@${SERVER_HOST}" \
  "cd '${REMOTE_DIR}' && docker compose up -d --build --remove-orphans"

echo "Checking deployment health..."
"${SSH_CMD[@]}" "${SERVER_USER}@${SERVER_HOST}" \
  "cd '${REMOTE_DIR}' && docker compose ps"

echo "Deployment finished. Open http://${SERVER_HOST}:9000/firmware-checker"
