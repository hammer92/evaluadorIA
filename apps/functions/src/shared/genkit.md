# Genkit (SDD-GENKIT-01) — Setup local para emulador

Esta carpeta ahora tiene un flujo real de Genkit (Google AI Studio + Gemini
Flash) en `src/shared/generator-client.ts`. El flujo reemplaza al stub
determinístico anterior y se invoca desde los 3 Cloud Functions de preview
(`v1TemplatePreviewGenerate`, `v1TemplatePreviewGet` indirectamente,
`v1TemplatePreviewAnswered` indirectamente).

## Setup del API key (Google AI Studio)

1.  Generá una API key en https://aistudio.google.com/app/apikey.
2.  Para deploy (Cloud Functions runtime):
    ```bash
    firebase functions:secrets:set GEMINI_API_KEY
    ```
    Esto guarda la key en Cloud Secret Manager y la expone al runtime
    como la env var `GEMINI_API_KEY`.
3.  Para el emulador local: la key puede estar en cualquiera de estas 3
    env vars (orden de búsqueda, mismo que el plugin nativo):
    ```bash
    GEMINI_API_KEY=<tu-key>          # preferido (alineado con docs)
    GOOGLE_GENAI_API_KEY=<tu-key>    # alias Google
    GOOGLE_API_KEY=<tu-key>          # alias Google
    ```
    El emulador de firebase-tools auto-loads `apps/functions/.secret.local`
    (un archivo `KEY=value` por línea). Ejemplo de `.secret.local` ya
    presente en el repo:
    ```
    SESSION_COOKIE_SECRET=...
    GOOGLE_GENAI_API_KEY=AIzaSy...
    ```

> Si la key no está configurada (en ninguna de las 3 vars),
> `v1TemplatePreviewGenerate` responde `internal — GEMINI_API_KEY /
> GOOGLE_API_KEY / GOOGLE_GENAI_API_KEY no configurada...`. Tests de
> integración no se ven afectados porque mockean `generator-client.ts`.

> Si la key no está configurada, `v1TemplatePreviewGenerate` responde
> `internal — GEMINI_API_KEY no configurada...` (mensaje explícito desde
> `genkit.ts`). Tests de integración no se ven afectados porque mockean
> `generator-client.ts` directamente.

## Dev UI (genkit:start)

Para correr el Dev UI de Genkit sobre los flows:

```bash
cd apps/functions
pnpm genkit:start
# o con API key inline (cualquiera de los 3 nombres):
GEMINI_API_KEY=<key> pnpm genkit:start
# o: GOOGLE_GENAI_API_KEY=<key> pnpm genkit:start
```

El Dev UI abre en el puerto que imprima el comando (usualmente 4000).
Permite testear el flow `generatePreviewQuestions` interactivamente con
inputs arbitrarios.

El `index.ts` exporta el flow (definido en `src/shared/generator-client.ts`)
sólo en modo `genkit:start`; en deploy normal se importa como helper de
`v1TemplatePreviewGenerate`.

## Estructura

- `src/shared/genkit.ts` — singleton `getAI()`. Lazy initialization,
  valida que exista una API key (busca en `GEMINI_API_KEY`,
  `GOOGLE_API_KEY`, `GOOGLE_GENAI_API_KEY` en ese orden) antes de
  construir el `ai` instance de Genkit con el plugin `googleAI` +
  modelo `gemini-flash-latest`.
- `src/shared/generator-client.ts` — wrapper `generateQuestionsForPreview`
  que arma el prompt (system + user), llama a `ai.generate({output: {schema: ...}})`,
  valida con `previewQuestionSchema`, retorna `GeneratorOutput`.
- Tests de integración mockean `generator-client.ts` para evitar gastar
  tokens y para ser deterministicos.

## Modelo seleccionado

`gemini-flash-latest` (alias de la última `gemini-2.5-flash`):

- Free tier en Google AI Studio.
- Baja latencia (ideal para preview inline).
- Soporta structured outputs (necesario para `output.schema = ZodSchema`).
- Disponible en todas las regiones compatibles con AI Studio
  (https://ai.google.dev/available_regions).

Si en el futuro se requiere un modelo más capaz (e.g. para preguntas con
razonamiento complejo), cambiar `gemini-flash-latest` en `genkit.ts` por
`gemini-2.5-pro` o `gemini-pro-latest`. El resto de la API no cambia.

## Cost / observability

- Cada preview regenerada = N (recipes) llamadas a Gemini = ~costo de
  1 pregunta simple. Para un template de 4 recipes × 6 preguntas
  ≈ 24 prompts × ~2000 tokens output ≈ ~5 cents USD por regeneration.
- Cada usuario tiene rate limit de 5 regeneraciones/h/template, acotando
  el costo máximo.
- Dev UI trace + Gemini usage se pueden monitorear via
  https://aistudio.google.com/app/api-keys/usage y los logs de Firebase
  Functions (cada call loguea `modelVersion`, `promptVersion`,
  `totalQuestions`, `totalFlagged`, `wasRefusal` en audit).
