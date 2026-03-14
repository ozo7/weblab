#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -x "${ROOT_DIR}/scripts/lab-server.sh" && -f "${ROOT_DIR}/lab/lab.html" ]]; then
  exec "${ROOT_DIR}/scripts/lab-server.sh" start
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8090}"
URL="http://127.0.0.1:${PORT}/api/settings"
PID_FILE="${ROOT_DIR}/.weblab-http-${PORT}.pid"
LOG_FILE="${ROOT_DIR}/.weblab-http-${PORT}.log"

is_ready() {
  curl -fsS --max-time 2 "${URL}" >/dev/null 2>&1
}

if [[ -f "${PID_FILE}" ]]; then
  old_pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${old_pid}" ]] && ! ps -p "${old_pid}" >/dev/null 2>&1; then
    rm -f "${PID_FILE}"
  fi
fi

if ss -ltn "( sport = :${PORT} )" | tail -n +2 | grep -q .; then
  if is_ready; then
    echo "server already running at http://127.0.0.1:${PORT}/"
    exit 0
  fi
  echo "port ${PORT} is in use; refusing start" >&2
  exit 1
fi

cd "${ROOT_DIR}"
setsid env WEBVIEWER_HOST="${HOST}" WEBVIEWER_PORT="${PORT}" node ./server.js >"${LOG_FILE}" 2>&1 < /dev/null &
pid=$!
echo "${pid}" > "${PID_FILE}"

for _ in $(seq 1 40); do
  if is_ready; then
    echo "server ready at http://127.0.0.1:${PORT}/ (pid ${pid})"
    exit 0
  fi
  sleep 0.25
done

echo "server failed to become ready. check ${LOG_FILE}" >&2
exit 1
