/**
 * genkit.ts — Singleton de Genkit (Google AI Studio + Gemini Flash).
 *
 * SDD-GENKIT-01 / SDD-11: integracion real del Generator Agent via Genkit.
 *
 * El singleton se inicializa lazily para que el bundle pueda importarse sin
 * falhar cuando GEMINI_API_KEY no esta definida (ej. en tests sin API key
 * que mockean ai.generate). El primer `getAI()` desde un handler es el
 * punto de validacion; los tests pueden mockear el modulo entero.
 *
 * Setup del secret (Cloud Secret Manager para deploy):
 *   firebase functions:secrets:set GEMINI_API_KEY
 *
 * Setup para emulator local:
 *   Crear apps/functions/.secret.local con `GEMINI_API_KEY=<tu-key>`
 *   O exportar la env var antes de `firebase emulators:start`.
 *
 * Modelo: gemini-flash-latest (free tier, baixa latencia). Ver:
 * https://ai.google.dev/available_regions
 */
import { googleAI } from '@genkit-ai/google-genai';
import { logger } from 'firebase-functions/v2';
import type { Genkit } from 'genkit';
import { genkit } from 'genkit';

let _ai: Genkit | null = null;

export function getAI(): Genkit {
  if (_ai) return _ai;

  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY no configurada. ' +
        'Para deploy: `firebase functions:secrets:set GEMINI_API_KEY`. ' +
        'Para emulator: setea la env var antes de iniciar el emulador ' +
        'o crea apps/functions/.secret.local.',
    );
  }

  logger.info('Inicializando Genkit singleton (googleAI + gemini-flash-latest)');
  _ai = genkit({
    plugins: [googleAI({ apiKey })],
    model: googleAI.model('gemini-flash-latest'),
  });
  return _ai;
}

export const GEMINI_MODEL = 'gemini-flash-latest';
