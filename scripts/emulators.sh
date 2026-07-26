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
PROJECT="${FIREBASE_PROJECT:-admin-platform-dev}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cmd_start_detached() {
  mkdir -p "$(dirname "$LOG_FILE")"

  # NOTA: NO borramos ./emulator-data acá. El flag --import/--export-on-exit
  # que pasamos a `firebase emulators:start` se encarga de la persistencia:
  # al arrancar, importa el estado que quedó de la corrida anterior (si existe);
  # al detener (Ctrl+C / SIGTERM), exporta el estado actual al mismo dir.
  # Para resetear TODO: `pnpm emulators:reset`.

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
  # Enviar SIGTERM primero para que Firebase ejecute --export-on-exit y
  # persista el estado en ./emulator-data. Después de un timeout corto,
  # forzar con SIGKILL a los subprocesos que no respondan.
  pkill -TERM -f "firebase emulators:start" 2>/dev/null || true
  local waited=0
  while [ "$waited" -lt 12 ]; do
    if ! ss -tln 2>/dev/null | grep -q ":4400 "; then
      break
    fi
    sleep 1
    waited=$((waited + 1))
  done

  # Cleanup forzado por si quedó algo colgado.
  pkill -9 -f "firebase emulators:start" 2>/dev/null || true
  pkill -9 -f "cloud-firestore-emulator" 2>/dev/null || true
  pkill -9 -f "cloud-storage-rules-runtime" 2>/dev/null || true
  pkill -9 -f "functionsEmulatorRuntime" 2>/dev/null || true
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

# cmd_wait_and_seed_if_empty: espera a que Auth/Firestore estén responding,
# y si Auth no tiene ningún usuario, ejecuta el seed por única vez. Pensado
# para llamarse desde `dev.sh` después de `wait_for_emulators`. Re-ejecutar el
# seed manualmente con `pnpm seed:emulators` siempre es seguro (es idempotente).
#
# Detección de "ya hay data": usamos el endpoint público del emulador de Auth
# `accounts:signUp` con un email aleatorio — si el emulador responde con
# `EMAIL_EXISTS` sabemos que ya hay al menos un usuario; si responde con
# éxito o `auth/email-already-exists`风格的 error es ruido. Si responde con
# success, ese email nuevo se queda y lo limpiamos en el próximo seed.
# Para evitar ruido, en su lugar usamos `accounts:lookup` con un email
# arbitrario que NO esté registrado: si Auth responde, está vivo. La forma
# definitiva es leer el export file del disco — si ./emulator-data/auth_export/
# accounts.json tiene users, no re-seedeamos.
cmd_wait_and_seed_if_empty() {
  local export_accounts="$ROOT_DIR/emulator-data/auth_export/accounts.json"

  for _ in $(seq 1 30); do
    # Probe Auth con un signUp dummy: si responde JSON con error 400/email
    # existente, está vivo. 000 = ECONNREFUSED (todavía arrancando).
    local http_code
    http_code="$(curl -s -o /dev/null -w '%{http_code}' \
      -H 'Content-Type: application/json' \
      -d '{"email":"__healthcheck__@invalid.local","password":"x","returnSecureToken":true}' \
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key" \
      || echo '000')"

    if [ "$http_code" != "000" ]; then
      # Auth responde. ¿Hay data persistida en disco?
      if [ -f "$export_accounts" ]; then
        local user_count
        user_count="$(grep -o '"localId"' "$export_accounts" | wc -l | tr -d ' \n' || echo 0)"
        if [ "${user_count:-0}" -gt 0 ] 2>/dev/null; then
          echo "✅ Emuladores con data persistida en ./emulator-data (${user_count} usuario(s)). No se re-seedea."
          return 0
        fi
      fi

      echo "🌱 Emuladores vacíos → ejecutando seed inicial…"
      if (cd "$ROOT_DIR" && pnpm seed:emulators); then
        return 0
      fi
      echo "⚠️  El seed falló. Reintentá manualmente con 'pnpm seed:emulators'." >&2
      return 1
    fi

    sleep 1
  done

  echo "⚠️  No se pudo contactar Auth (9099) para decidir auto-seed. " \
    "Si los emuladores están vacíos, corré 'pnpm seed:emulators' manualmente." >&2
  return 1
}

case "${1:-}" in
  start-detached)            cmd_start_detached ;;
  stop)                      cmd_stop ;;
  status)                    cmd_status ;;
  logs)                      cmd_logs ;;
  wait-and-seed-if-empty)    cmd_wait_and_seed_if_empty ;;
  *)
    echo "Uso: $0 {start-detached|stop|status|logs|wait-and-seed-if-empty}" >&2
    exit 1
    ;;
esac