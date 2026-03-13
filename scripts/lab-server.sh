#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8090}"
PID_FILE="${ROOT_DIR}/.lab-server-${PORT}.pid"
LOG_FILE="${ROOT_DIR}/.lab-server-${PORT}.log"
URL="http://${HOST}:${PORT}/lab/lab.html"

usage() {
  echo "Usage: $0 {start|stop|status|restart}" >&2
}

pid_from_file() {
  if [[ -f "$PID_FILE" ]]; then
    cat "$PID_FILE"
  fi
}

is_pid_running() {
  local pid="$1"
  [[ -n "$pid" ]] && ps -p "$pid" > /dev/null 2>&1
}

is_server_process() {
  local pid="$1"
  local cmd
  cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  [[ "$cmd" == *"node"* && "$cmd" == *"server.js"* ]]
}

port_in_use() {
  ss -ltn "sport = :${PORT}" | rg -q ":${PORT}"
}

listener_pid() {
  ss -ltnp "sport = :${PORT}" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -n 1
}

http_ready() {
  curl -fsS -m 2 "$URL" > /dev/null 2>&1
}

cleanup_stale_pid() {
  local pid
  pid="$(pid_from_file || true)"
  if [[ -n "$pid" ]] && ! is_pid_running "$pid"; then
    rm -f "$PID_FILE"
  fi
}

start_server() {
  cleanup_stale_pid

  local pid
  pid="$(pid_from_file || true)"
  if [[ -n "$pid" ]] && is_pid_running "$pid" && is_server_process "$pid"; then
    if http_ready; then
      echo "already running (pid=$pid, url=$URL)"
      return 0
    fi
    echo "server process exists but not ready (pid=$pid); refusing duplicate start" >&2
    exit 1
  fi

  if port_in_use; then
    local existing_pid
    existing_pid="$(listener_pid || true)"
    if [[ -n "$existing_pid" ]] && is_pid_running "$existing_pid" && is_server_process "$existing_pid"; then
      echo "$existing_pid" > "$PID_FILE"
      if http_ready; then
        echo "already running (adopted pid=$existing_pid, url=$URL)"
        return 0
      fi
      echo "adopted existing server pid=$existing_pid but readiness failed" >&2
      exit 1
    fi
    echo "port ${PORT} is already in use; refusing start" >&2
    ss -ltnp "sport = :${PORT}" || true
    exit 1
  fi

  : > "$LOG_FILE"
  (
    cd "$ROOT_DIR"
    setsid env WEBLAB_HOST="$HOST" WEBLAB_PORT="$PORT" node ./server.js >> "$LOG_FILE" 2>&1 < /dev/null &
    echo $! > "$PID_FILE"
  )

  pid="$(pid_from_file || true)"
  if [[ -z "$pid" ]]; then
    echo "failed to create pid file" >&2
    exit 1
  fi

  local attempts=40
  local i
  for (( i=1; i<=attempts; i++ )); do
    if ! is_pid_running "$pid"; then
      echo "server exited early during startup" >&2
      tail -n 40 "$LOG_FILE" || true
      rm -f "$PID_FILE"
      exit 1
    fi

    if http_ready; then
      echo "started (pid=$pid, url=$URL, log=$LOG_FILE)"
      return 0
    fi

    sleep 0.25
  done

  echo "server did not become ready after ${attempts} checks" >&2
  tail -n 40 "$LOG_FILE" || true
  exit 1
}

stop_server() {
  cleanup_stale_pid

  local pid
  pid="$(pid_from_file || true)"
  if [[ -z "$pid" ]]; then
    if port_in_use; then
      local existing_pid
      existing_pid="$(listener_pid || true)"
      if [[ -n "$existing_pid" ]] && is_pid_running "$existing_pid" && is_server_process "$existing_pid"; then
        pid="$existing_pid"
      else
        echo "no pid file, but port ${PORT} is in use" >&2
        ss -ltnp "sport = :${PORT}" || true
        exit 1
      fi
    else
      echo "already stopped"
      return 0
    fi
  fi

  if ! is_pid_running "$pid"; then
    rm -f "$PID_FILE"
    echo "already stopped (removed stale pid file)"
    return 0
  fi

  kill "$pid" || true
  local i
  for (( i=1; i<=20; i++ )); do
    if ! is_pid_running "$pid"; then
      rm -f "$PID_FILE"
      echo "stopped"
      return 0
    fi
    sleep 0.25
  done

  kill -9 "$pid" || true
  sleep 0.25
  if is_pid_running "$pid"; then
    echo "failed to stop pid=$pid" >&2
    exit 1
  fi

  rm -f "$PID_FILE"
  echo "stopped (forced)"
}

status_server() {
  cleanup_stale_pid
  local pid
  pid="$(pid_from_file || true)"

  if [[ -n "$pid" ]] && is_pid_running "$pid" && is_server_process "$pid"; then
    if http_ready; then
      echo "running (pid=$pid, ready=yes, url=$URL, log=$LOG_FILE)"
    else
      echo "running (pid=$pid, ready=no, url=$URL, log=$LOG_FILE)"
      exit 1
    fi
    return 0
  fi

  if port_in_use; then
    local existing_pid
    existing_pid="$(listener_pid || true)"
    if [[ -n "$existing_pid" ]] && is_pid_running "$existing_pid" && is_server_process "$existing_pid"; then
      echo "$existing_pid" > "$PID_FILE"
      if http_ready; then
        echo "running (adopted pid=$existing_pid, ready=yes, url=$URL, log=$LOG_FILE)"
      else
        echo "running (adopted pid=$existing_pid, ready=no, url=$URL, log=$LOG_FILE)"
        exit 1
      fi
      return 0
    fi
    echo "not managed by pid file, and port ${PORT} is in use by another process" >&2
    ss -ltnp "sport = :${PORT}" || true
    exit 1
  fi

  echo "stopped"
}

cmd="${1:-}"
case "$cmd" in
  start)
    start_server
    ;;
  stop)
    stop_server
    ;;
  status)
    status_server
    ;;
  restart)
    stop_server
    start_server
    ;;
  *)
    usage
    exit 2
    ;;
esac
