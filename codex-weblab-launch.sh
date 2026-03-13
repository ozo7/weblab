#!/usr/bin/env bash
set -uo pipefail
cd "/home/ozo/ais/weblab"
export CODEX_PROJECT="Lab"
printf '\033]0;%s\007' "CODEX: Lab | weblab"
ACCENT_MODE="cursor,bg"
mode_has() {
  case ",$ACCENT_MODE," in
    *",$1,"*) return 0 ;;
    *) return 1 ;;
  esac
}
if mode_has "cursor"; then
  printf '\033]12;%s\007' "#FFFF00"
fi
if mode_has "bg"; then
  printf '\033]11;%s\007' "#4C511D"
fi
printf '\n'
start_ts=$(date +%s)
bash --rcfile "/home/ozo/ais/weblab/codex-weblab-prompt.rc" -ic "codex -olaf"
status=$?
elapsed=$(( $(date +%s) - start_ts ))
if [[ $status -ne 0 || $elapsed -lt 3 ]]; then
  echo
  if [[ $status -ne 0 ]]; then
    echo "Launcher command failed with exit code $status: codex -olaf"
  else
    echo "Launcher command exited quickly (${elapsed}s): codex -olaf"
  fi
  echo "Opening interactive shell for troubleshooting..."
  exec bash --rcfile "/home/ozo/ais/weblab/codex-weblab-prompt.rc" -i
fi
echo
echo "Command finished. Opening interactive shell..."
exec bash --rcfile "/home/ozo/ais/weblab/codex-weblab-prompt.rc" -i
