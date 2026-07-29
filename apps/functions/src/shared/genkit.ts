/**
 * genkit.ts — Singleton de Genkit (Google AI Studio + Gemini Flash).
 *
 * SDD-GENKIT-01 / SDD-11: integracion real del Generator Agent via Genkit.
 *
 * El singleton se inicializa lazily para que el bundle pueda importarse sin
 * falhar cuando ninguna API key este definida (ej. en tests sin API key
 * que mockean ai.generate). El primer `getAI()` desde un handler es el
 * punto de validacion; los tests pueden mockear el modulo entero.
 *
 * Setup del secret (Cloud Secret Manager para deploy):
 *   firebase functions:secrets:set GEMINI_API_KEY
 *
 * Setup para emulator local:
 *   Crear apps/functions/.secret.local con cualquiera de:
 *     - GEMINI_API_KEY=<key>            (preferido, alineado con docs)
 *     - GOOGLE_GENAI_API_KEY=<key>       (alias Google)
 *     - GOOGLE_API_KEY=<key>             (alias Google)
 *   O exportar la env var antes de `firebase emulators:start`. firebase-tools
 *   auto-loads .secret.local en el emulador.
 *
 * Orden de busqueda (mismo que el plugin @genkit-ai/google-genai nativo):
 *   GEMINI_API_KEY  →  GOOGLE_API_KEY  →  GOOGLE_GENAI_API_KEY
 *
 * Modelo: gemini-flash-latest (free tier, baja latencia). Ver:
 * https://ai.google.dev/available_regions
 */
import { googleAI } from '@genkit-ai/google-genai';
import { logger } from 'firebase-functions/v2';
import type { Genkit } from 'genkit';
import { genkit } from 'genkit';

let _ai: Genkit | null = null;

const API_KEY_NAMES = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY'] as const;

function resolveApiKey(): string | undefined {
  for (const name of API_KEY_NAMES) {
    const value = process.env[name];
    if (value && value.length > 0) return value;
  }
  return undefined;
}

export function getAI(): Genkit {
  if (_ai) return _ai;

  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      `${API_KEY_NAMES.join(' / ')} no configurada. ` +
        'Para deploy: `firebase functions:secrets:set ' +
        API_KEY_NAMES[0] +
        '` (o cualquiera de los aliases). ' +
        'Para emulator: setea la env var antes de iniciar el emulador ' +
        'o crea apps/functions/.secret.local con una de estas keys.',
    );
  }

  logger.info('Inicializando Genkit singleton (googleAI + gemini-flash-lite-latest)');
  _ai = genkit({
    plugins: [googleAI({ apiKey })],
    model: googleAI.model('gemini-flash-lite-latest'),
  });
  return _ai;
}

export const GEMINI_MODEL = 'gemini-flash-lite-latest';
