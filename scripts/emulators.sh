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

  # SESSION_COOKIE_SECRET: requerido por la Cloud Function v1AuthCreateSession
  # (firma HS256 del JWT de sesión). DEBE coincidir con el secret que usa
  # apps/web/lib/env-dev-defaults.ts — si difieren, el middleware/RSC no
  # puede verificar la cookie firmada por la CF y el login redirige de
  # vuelta a /login?next=/admin.
  #
  # Resolución (en orden de prioridad):
  #   1) SESSION_COOKIE_SECRET ya exportado en el shell padre.
  #   2) apps/functions/.secret.local (Firebase Functions emulator lo lee
  #      nativamente como fallback de process.env para `defineSecret()`).
  #   3) Default de dev hardcodeado abajo (último recurso).
  local secret="${SESSION_COOKIE_SECRET:-}"
  local secret_local="apps/functions/.secret.local"
  if [ -z "$secret" ] && [ -f "$secret_local" ]; then
    # Parsear KEY=VALUE del .secret.local (formato Firebase Functions).
    secret="$(grep -E '^SESSION_COOKIE_SECRET=' "$secret_local" | head -1 | cut -d= -f2-)"
    if [ -n "$secret" ]; then
      echo "Usando SESSION_COOKIE_SECRET desde $secret_local"
    fi
  fi
  if [ -z "$secret" ]; then
    secret="dev-secret-shared-by-cf-and-middleware-must-be-at-least-32-chars-long"
    echo "AVISO: usando SESSION_COOKIE_SECRET default de dev (no se encontró .secret.local)"
  fi
  export SESSION_COOKIE_SECRET="$secret"

  setsid bash -c "SESSION_COOKIE_SECRET='$secret' firebase emulators:start --project $PROJECT --import ./emulator-data --export-on-exit ./emulator-data > '$LOG_FILE' 2>&1" &
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
  # functions runtime (Cloud Functions emulator worker)
  pkill -9 -f "functionsEmulatorRuntime" 2>/dev/null || true
  # auth emulator worker
  pkill -9 -f "firebase-tools/lib/emulator/auth" 2>/dev/null || true
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