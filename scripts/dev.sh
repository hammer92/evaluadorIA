#!/usr/bin/env bash
# scripts/dev.sh — orquestador de desarrollo.
# Arranca los emuladores de Firebase en background, espera a que estén
# listening en sus puertos, y luego levanta `next dev` en foreground.
# Al recibir Ctrl+C (SIGINT/SIGTERM/EXIT) detiene los emuladores + Next.js
# de forma limpia para no dejar procesos huérfanos.
#
# Uso:
#   pnpm dev              # este script (emuladores + Next.js)
#   pnpm dev:web          # solo Next.js (asume emuladores ya corriendo)
#   pnpm dev:emulators    # solo emuladores (sin Next.js)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EMULATOR_PORTS=(4000 8080 9099 9199 5001 4400)
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-90}"

NEXT_PID=""

port_is_listening() {
  local port="$1"
  ss -tln 2>/dev/null | grep -qE ":${port}[[:space:]]"
}

wait_for_emulators() {
  local waited=0
  while [ "$waited" -lt "$MAX_WAIT_SECONDS" ]; do
    local all_up=true
    local missing=()
    for port in "${EMULATOR_PORTS[@]}"; do
      if port_is_listening "$port"; then
        :
      else
        all_up=false
        missing+=("$port")
      fi
    done
    if $all_up; then
      echo "✅ Emuladores listos (puertos: ${EMULATOR_PORTS[*]})"
      return 0
    fi
    echo "⏳ Esperando emuladores… faltan puertos: ${missing[*]} (${waited}s/${MAX_WAIT_SECONDS}s)"
    sleep 2
    waited=$((waited + 2))
  done
  echo "❌ Timeout esperando emuladores después de ${MAX_WAIT_SECONDS}s" >&2
  return 1
}

cleanup() {
  echo ""
  echo "🛑 Deteniendo Next.js (si quedó corriendo)…"
  if [ -n "$NEXT_PID" ] && kill -0 "$NEXT_PID" 2>/dev/null; then
    kill -TERM "$NEXT_PID" 2>/dev/null || true
    sleep 1
    kill -KILL "$NEXT_PID" 2>/dev/null || true
  fi
  # Belt-and-suspenders: por si Next.js se detachment del bash script.
  pkill -9 -f "next dev --port 3000" 2>/dev/null || true

  echo "🛑 Deteniendo emuladores…"
  bash "$ROOT_DIR/scripts/emulators.sh" stop >/dev/null 2>&1 || true
}

run_dev_web() {
  echo ""
  echo "🌐 Iniciando Next.js dev server en http://localhost:3000"
  echo "   (Ctrl+C para detener; los emuladores también se detendrán)"
  echo ""
  cd "$ROOT_DIR/apps/web"
  # Lanzar Next.js en el mismo process group que el script para que las
  # señales (Ctrl+C / SIGTERM / EXIT trap) se propaguen al árbol entero.
  pnpm exec next dev --port 3000 &
  NEXT_PID=$!
  # Esperar a que Next.js termine (Ctrl+C / error).
  wait "$NEXT_PID" || true
}

cmd_dev() {
  trap cleanup EXIT INT TERM

  echo "🚀 Iniciando emuladores de Firebase (background)…"
  bash "$ROOT_DIR/scripts/emulators.sh" start-detached

  echo ""
  wait_for_emulators

  run_dev_web
}

cmd_dev_web_only() {
  trap cleanup EXIT INT TERM

  local any_up=false
  for port in "${EMULATOR_PORTS[@]}"; do
    if port_is_listening "$port"; then
      any_up=true
      break
    fi
  done

  if ! $any_up; then
    echo "⚠️  Ningún emulador detectado en puertos: ${EMULATOR_PORTS[*]}"
    echo "   Rutas que llaman a Cloud Functions fallarán."
    echo "   Sugerencia: abrir otra terminal y correr 'pnpm emulators:detach'"
    echo "   Continuando solo con Next.js…"
  fi

  run_dev_web
}

cmd_dev_emulators_only() {
  bash "$ROOT_DIR/scripts/emulators.sh" start-detached
  wait_for_emulators
  echo ""
  echo "Emuladores corriendo. Para detenerlos: pnpm emulators:stop"
}

case "${1:-}" in
  web)         cmd_dev_web_only ;;
  emulators)   cmd_dev_emulators_only ;;
  "")          cmd_dev ;;
  *)
    echo "Uso: $0 [web|emulators]" >&2
    echo "  (sin args)        Levanta emuladores + Next.js" >&2
    echo "  web               Solo Next.js (asume emuladores ya corriendo)" >&2
    echo "  emulators         Solo emuladores (sin Next.js)" >&2
    exit 1
    ;;
esac