#!/usr/bin/env bash
# =============================================================================
# deploy-manual.sh — Deploy manual a Firebase (solo firebase CLI, sin gcloud).
# =============================================================================
# Reemplaza el workflow de GitHub Actions (desactivado por costo).
#
# Prerequisitos:
#   1. Firebase CLI >= 15: npm install -g firebase-tools
#   2. Login: firebase login
#   3. Set project: firebase use agente-entrevistador-ia
#   4. APIs habilitadas en GCP:
#      - cloudfunctions.googleapis.com
#      - cloudbuild.googleapis.com
#      - artifactregistry.googleapis.com
#      - cloudresourcemanager.googleapis.com
#      - run.googleapis.com
#      - eventarc.googleapis.com
#      - secretmanager.googleapis.com
#   5. Rol adicional al SA: roles/secretmanager.admin (o secretmanager.secretAccessor)
#
# Uso:
#   ./scripts/deploy-manual.sh                # deploy completo
#   ./scripts/deploy-manual.sh --skip-tests   # skip tests/lint
#   ./scripts/deploy-manual.sh --only hosting # solo hosting
#   ./scripts/deploy-manual.sh --only functions
#
# Secrets se leen desde .env.local (NO commitear):
#   SESSION_COOKIE_SECRET=...
#   ALLOWED_ORIGINS=https://agente-entrevistador-ia.web.app
#   NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
#   ...
# =============================================================================

set -euo pipefail

PROJECT="agente-entrevistador-ia"
REGION="us-central1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SKIP_TESTS=0
ONLY=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests) SKIP_TESTS=1; shift ;;
    --only) ONLY="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

step() { printf "\n\033[1;34m▶ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[1;32m✔\033[0m %s\n" "$1"; }
fail() { printf "  \033[1;31m✘\033[0m %s\n" "$1"; exit 1; }

require() { command -v "$1" >/dev/null 2>&1 || fail "$1 no instalado"; }
require firebase
require pnpm
require node

load_secret() {
  local key="$1"
  local val="${!key:-}"
  if [[ -z "$val" && -f "$ROOT_DIR/.env.local" ]]; then
    val=$(grep "^$key=" "$ROOT_DIR/.env.local" 2>/dev/null | cut -d= -f2- | sed 's/^["'\'']//' | sed 's/["'\'']$//')
  fi
  echo "$val"
}

cd "$ROOT_DIR"

# =============================================================================
# Pre-checks
# =============================================================================
step "Pre-checks"

FIREBASE_USE=$(firebase use 2>&1 || true)
if ! echo "$FIREBASE_USE" | grep -q "$PROJECT"; then
  read -p "  ¿Cambiar a $PROJECT? [y/N] " -n 1 -r; echo
  [[ $REPLY =~ ^[Yy]$ ]] && firebase use "$PROJECT" || fail "Cambia primero: firebase use $PROJECT"
fi
ok "Proyecto: $PROJECT"

ACTIVE=$(firebase login:list 2>/dev/null | head -1)
[[ "$ACTIVE" == *"Logged in"* || "$ACTIVE" == *"active"* ]] || fail "firebase login requerido. Ejecuta: firebase login"
ok "Firebase CLI autenticado: $ACTIVE"

# =============================================================================
# Secrets
# =============================================================================
step "Cargando secrets desde .env.local / env vars"

SESSION_COOKIE_SECRET=$(load_secret SESSION_COOKIE_SECRET)
ALLOWED_ORIGINS=$(load_secret ALLOWED_ORIGINS)
FIREBASE_ADMIN_PROJECT_ID="${PROJECT}"
OPENAI_API_KEY=$(load_secret OPENAI_API_KEY)

NEXT_PUBLIC_FIREBASE_API_KEY=$(load_secret NEXT_PUBLIC_FIREBASE_API_KEY)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$(load_secret NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=$(load_secret NEXT_PUBLIC_FIREBASE_PROJECT_ID)
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$(load_secret NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$(load_secret NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)
NEXT_PUBLIC_FIREBASE_APP_ID=$(load_secret NEXT_PUBLIC_FIREBASE_APP_ID)
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$(load_secret NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID)

[[ -z "$SESSION_COOKIE_SECRET" ]] && fail "SESSION_COOKIE_SECRET no definido"
[[ -z "$ALLOWED_ORIGINS" ]] && fail "ALLOWED_ORIGINS no definido"
[[ -z "$NEXT_PUBLIC_FIREBASE_API_KEY" ]] && fail "NEXT_PUBLIC_FIREBASE_API_KEY no definido"
ok "Secrets cargados"

# =============================================================================
# Tests + Build
# =============================================================================
if [[ $SKIP_TESTS -eq 0 ]]; then
  step "Tests + Lint + Typecheck"
  pnpm lint 2>&1 | tail -5
  pnpm typecheck 2>&1 | tail -5
  pnpm test 2>&1 | tail -10
  ok "Tests OK"
fi

step "Build"
pnpm build 2>&1 | tail -10
ok "Build completo"

# =============================================================================
# Sync secrets a Firebase Secret Manager
# =============================================================================
# El runtime de CFv2 inyecta automaticamente los secrets (definidos con
# defineSecret() en env.ts) como env vars. Solo necesitamos crearlos via
# firebase functions:secrets:set.
# =============================================================================
if [[ -z "$ONLY" || "$ONLY" == "functions" || "$ONLY" == "secrets" ]]; then
  step "Sync secrets → Firebase Secret Manager"

  sync_secret() {
    local name="$1" value="$2"
    if [[ -z "$value" ]]; then
      printf "  ⏭  %s (no definido, skip)\n" "$name"
      return
    fi
    printf "  → %s... " "$name"
    if echo "$value" | firebase functions:secrets:set "$name" --project "$PROJECT" --force >/dev/null 2>&1; then
      printf "\033[1;32m✔\033[0m\n"
    else
      printf "\033[1;31m✘\033[0m\n"
      return 1
    fi
  }

  sync_secret SESSION_COOKIE_SECRET    "$SESSION_COOKIE_SECRET"
  sync_secret ALLOWED_ORIGINS          "$ALLOWED_ORIGINS"
  sync_secret ADMIN_PROJECT_ID "$FIREBASE_ADMIN_PROJECT_ID"
  sync_secret OPENAI_API_KEY           "$OPENAI_API_KEY"

  ok "Secrets sincronizados"
fi

# =============================================================================
# Deploy functions (codigo)
# =============================================================================
if [[ -z "$ONLY" || "$ONLY" == "functions" ]]; then
  step "Deploy functions"
  firebase deploy --only functions --non-interactive --force --project "$PROJECT"
  ok "Functions deployadas"
fi

# =============================================================================
# Deploy hosting
# =============================================================================
if [[ -z "$ONLY" || "$ONLY" == "hosting" ]]; then
  step "Deploy hosting (apps/web/out/)"
  firebase deploy --only hosting --non-interactive --project "$PROJECT"
  ok "Hosting deployado"
fi

# =============================================================================
# Deploy rules
# =============================================================================
if [[ -z "$ONLY" || "$ONLY" == "rules" ]]; then
  step "Deploy rules (Firestore + Storage)"
  firebase deploy --only firestore,storage --non-interactive --project "$PROJECT"
  ok "Rules deployadas"
fi

# =============================================================================
# Smoke test
# =============================================================================
step "Smoke test"
URL="https://$PROJECT.web.app"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 30 "$URL" || echo "000")
if [[ "$HTTP_STATUS" -ge 200 && "$HTTP_STATUS" -lt 400 ]]; then
  ok "Smoke OK ($URL → HTTP $HTTP_STATUS)"
else
  fail "Smoke failed ($URL → HTTP $HTTP_STATUS)"
fi

step "Deploy completo"
echo "  URL: https://$PROJECT.web.app"
echo "  Console: https://console.firebase.google.com/project/$PROJECT"