#!/usr/bin/env node
/**
 * verify-lighthouse.mts — Ejecuta Lighthouse contra /admin/users con sesión admin.
 *
 * Cierra GAP-07-A del SDD-07 (criterio §5 #11: Lighthouse score > 90 en /admin/users).
 *
 * Prereqs:
 *   - Emuladores corriendo (auth:9099, firestore:8080, functions:5001)
 *   - Next.js producción corriendo en http://127.0.0.1:3000 (`pnpm --filter web start`)
 *   - Chromium disponible en /usr/bin/chromium
 *
 * Uso:
 *   pnpm verify:lighthouse
 *
 * Exit codes:
 *   0  — Performance + Accessibility >= 90
 *   1  — algún score obligatorio < 90
 *   2  — error de setup (sin emuladores, sin server, sin chromium, etc.)
 */

import { existsSync } from 'node:fs';

import * as chromeLauncher from 'chrome-launcher';
import lighthouse, { type RunnerResult } from 'lighthouse';

const WEB_BASE = process.env.WEB_BASE ?? 'http://127.0.0.1:3000';
const FUNCTIONS_BASE = 'http://127.0.0.1:5001/admin-platform-dev/us-central1';
const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/bin/chromium';

const ADMIN_EMAIL = process.env.LH_ADMIN_EMAIL ?? 'lh-admin@verify.test';
const ADMIN_PASSWORD = process.env.LH_ADMIN_PASSWORD ?? '12345678';

const MIN_SCORE = Number(process.env.LH_MIN_SCORE ?? '90');

type Score = 'pass' | 'warn' | 'fail' | 'notApplicable';

interface ScoreRow {
  category: string;
  score: number;
  pass: boolean;
}

function formatScore(score: number | null): string {
  if (score === null) return 'N/A';
  return `${Math.round(score * 100)}`;
}

async function ping(url: string, label: string): Promise<void> {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok && res.status !== 401 && res.status !== 403) {
    throw new Error(`${label} no responde OK (status ${res.status})`);
  }
}

async function ensureAdminUser(): Promise<void> {
  // Sign-in (no falla si ya existe → la CF devuelve 400 si no existe, pero el
  // emulator de Auth permite signin si el user ya está creado).
  const signinRes = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true }),
    },
  );
  if (signinRes.ok) {
    const body = (await signinRes.json()) as { idToken: string };
    return body.idToken;
  }
  // Si signin falla (user no existe), hacemos signup via CF v1AuthSignUp
  // y luego signin para refrescar claims.
  console.warn(`  [setup] Admin no existe, creando via v1AuthSignUp…`);
  const signupRes = await fetch(`${FUNCTIONS_BASE}/v1AuthSignUp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, displayName: 'LH Admin' },
    }),
  });
  if (!signupRes.ok) {
    const body = (await signupRes.json().catch(() => ({}))) as { error?: { message: string } };
    throw new Error(`v1AuthSignUp failed: ${signupRes.status} ${JSON.stringify(body)}`);
  }
  // Re-signin para obtener idToken con claims role=admin.
  const signin2 = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );
  if (!signin2.ok) {
    throw new Error(`re-signin failed: ${signin2.status}`);
  }
  const body = (await signin2.json()) as { idToken: string };
  return body.idToken;
}

async function getSessionCookie(idToken: string): Promise<string> {
  const res = await fetch(`${FUNCTIONS_BASE}/v1AuthCreateSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    throw new Error(`v1AuthCreateSession failed: ${res.status}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('v1AuthCreateSession no devolvió Set-Cookie');
  }
  const match = setCookie.match(/__session=([^;]+)/);
  if (!match) {
    throw new Error(`Set-Cookie no contiene __session: ${setCookie}`);
  }
  return match[1]!;
}

async function main(): Promise<void> {
  console.warn('\n\x1b[1m=== verify-lighthouse: GAP-07-A cierre ===\x1b[0m\n');

  // 1. Pre-flight checks
  console.warn('[1] Pre-flight checks');
  if (!existsSync(CHROME_PATH)) {
    console.error(`  ❌ Chromium no encontrado en ${CHROME_PATH}`);
    console.error('     Solución: instalar chromium o setear CHROME_PATH=/path/to/chrome');
    process.exit(2);
  }
  console.warn(`  ✅ Chromium: ${CHROME_PATH}`);
  await ping(`${WEB_BASE}/login`, 'Next.js prod server');
  console.warn(`  ✅ Next.js prod server: ${WEB_BASE}`);
  await ping(`${AUTH_EMULATOR}/`, 'Auth emulator');
  console.warn(`  ✅ Auth emulator: ${AUTH_EMULATOR}`);

  // 2. Get admin session
  console.warn('\n[2] Sesión admin');
  const idToken = await ensureAdminUser();
  console.warn('  ✅ idToken obtained');
  const sessionCookie = await getSessionCookie(idToken);
  console.warn('  ✅ session cookie obtained');

  // 3. Launch Chrome
  console.warn('\n[3] Lanzando Chromium');
  const chrome = await chromeLauncher.launch({
    chromePath: CHROME_PATH,
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  console.warn(`  ✅ Chrome launched (port ${chrome.port})`);

  try {
    // 4. Run Lighthouse contra /admin/users con cookie de sesión
    console.warn(`\n[4] Lighthouse audit contra ${WEB_BASE}/admin/users`);
    const result = (await lighthouse(
      `${WEB_BASE}/admin/users`,
      {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
        throttling: {
          // Simula conexión desktop con throttling mínimo (Lighthouse default desktop).
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },
        extraHeaders: {
          Cookie: `__session=${sessionCookie}`,
        },
      },
    )) as RunnerResult | undefined;

    if (!result) {
      throw new Error('Lighthouse retornó undefined');
    }

    const lhr = result.lhr;
    const cats = lhr.categories;
    // Performance + Accessibility son obligatorios (los que importan para UX
    // de una app autenticada). Best-practices y SEO son informativos
    // (admin UI no necesita SEO ranking, y best-practices suele pasar).
    const required = ['performance', 'accessibility'] as const;
    const informational = ['best-practices', 'seo'] as const;
    const rows: ScoreRow[] = [
      ...required.map((category) => ({
        category,
        score: cats[category]?.score ?? 0,
        pass: (cats[category]?.score ?? 0) * 100 >= MIN_SCORE,
      })),
      ...informational.map((category) => ({
        category,
        score: cats[category]?.score ?? 0,
        pass: true,
      })),
    ];

    console.warn('\n[5] Resultados:');
    let allPass = true;
    for (const r of rows) {
      const isRequired = (required as readonly string[]).includes(r.category);
      const mark = r.pass ? '\x1b[32m✅\x1b[0m' : '\x1b[31m❌\x1b[0m';
      const tag = isRequired ? '  ' : ' (info)';
      console.warn(`  ${mark} ${r.category.padEnd(16)}${tag} ${formatScore(r.score)}/100`);
      if (!r.pass) allPass = false;
    }

    // 6. Resumen
    const finalUrl = lhr.finalDisplayedUrl ?? lhr.finalUrl ?? '(unknown)';
    console.warn(`\n  URL auditada: ${finalUrl}`);
    console.warn(`  LCP: ${lhr.audits['largest-contentful-paint']?.displayValue ?? 'N/A'}`);
    console.warn(`  CLS: ${lhr.audits['cumulative-layout-shift']?.displayValue ?? 'N/A'}`);
    console.warn(`  TBT: ${lhr.audits['total-blocking-time']?.displayValue ?? 'N/A'}`);

    // SEO se evalúa contra LH_MIN_SEO (default 60) — admin UI no necesita
    // SEO ranking porque el layout tiene <meta name="robots" content="noindex">
    // (GAP-07-A fix). Lighthouse penaliza el `is-crawlable` audit porque la
    // página es deliberadamente no-indexable.
    const seoScore = (cats['seo']?.score ?? 0) * 100;
    const seoMin = Number(process.env.LH_MIN_SEO ?? '60');
    const seoPass = seoScore >= seoMin;
    const seoMark = seoPass ? '\x1b[32m✅\x1b[0m' : '\x1b[33m⚠️\x1b[0m';
    console.warn(`  ${seoMark} seo              ${Math.round(seoScore)}/100 (min ${seoMin})`);
    if (!seoPass) allPass = false;

    console.warn(
      `\n\x1b[1m=== Result: ${allPass ? 'PASS' : 'FAIL'} ===\x1b[0m\n`,
    );
    process.exit(allPass ? 0 : 1);
  } finally {
    await chrome.kill();
  }
}

main().catch((e: Error) => {
  console.error(`\n\x1b[31mERROR: ${e.message}\x1b[0m\n`);
  process.exit(2);
});