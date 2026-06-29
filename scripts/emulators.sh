#!/usr/bin/env bash
# scripts/emulators.sh — start/stop/status/logs para los emuladores Firebase.
# Uso:
#   pnpm emulators:detach   # arranca en background (sobrevive al cierre del shell)
#   pnpm emulators:stop     # detiene todos los procesos (firebase node + firestore java + storage java)
#   pnpm emulators:status   # chequea puertos 4000/8080/9099/9199/5001/4400
#   pnpm emulators:logs     # tail del log en /tmp/opencode/firebase-emulators.log
#   pnpm emulators          # arranca en foreground (Ctrl+C para detener limpio)

set -euo pipefail

LOG_FILE="${FIREBASE_EMULATORS_LOG:-/tmp/opencode/firebase-emulators.log}"
PROJECT="${FIREBASE_PROJECT:-dev}"

cmd_start_detached() {
  mkdir -p "$(dirname "$LOG_FILE")"
  rm -rf emulator-data
  # SESSION_COOKIE_SECRET: requerido por la Cloud Function createSession
  # (firma HS256 del JWT de sesión). Mismo secret que el middleware Next.js.
  # En dev usamos un valor fijo; en staging/prod se setea via Secret Manager.
  export SESSION_COOKIE_SECRET="${SESSION_COOKIE_SECRET:-dev-secret-please-change-in-production-32+chars}"
  setsid bash -c "SESSION_COOKIE_SECRET='$SESSION_COOKIE_SECRET' firebase emulators:start --project $PROJECT --import ./emulator-data --export-on-exit ./emulator-data > '$LOG_FILE' 2>&1" &
  echo "Iniciado emuladores en background. Log: $LOG_FILE"
  echo "  UI: http://127.0.0.1:4000"
  echo "  Detener con: pnpm emulators:stop"
}

cmd_stop() {
  # firebase node main thread
  pkill -9 -f "firebase emulators:start" 2>/dev/null || true
  # firestore java emulator
  pkill -9 -f "cloud-firestore-emulator" 2>/dev/null || true
  # storage rules runtime java
  pkill -9 -f "cloud-storage-rules-runtime" 2>/dev/null || true
  echo "Emuladores detenidos."
}

cmd_status() {
  local all_down=true
  for port in 4000 8080 9099 9199 5001 4400; do
    if ss -tln 2>/dev/null | grep -q ":$port "; then
      echo "  ✅ :$port  listening"
    else
      echo "  ❌ :$port  down"
      all_down=false
    fi
  done
  if $all_down; then
    echo "Estado: TODOS los emuladores están corriendo."
  else
    echo "Estado: AL MENOS un emulador está caído."
  fi
}

cmd_logs() {
  if [ ! -f "$LOG_FILE" ]; then
    echo "No existe $LOG_FILE. ¿Arrancaste los emuladores?"
    exit 1
  fi
  exec tail -f "$LOG_FILE"
}

case "${1:-}" in
  start-detached)  cmd_start_detached ;;
  stop)            cmd_stop ;;
  status)          cmd_status ;;
  logs)            cmd_logs ;;
  *)
    echo "Uso: $0 {start-detached|stop|status|logs}" >&2
    exit 1
    ;;
esac