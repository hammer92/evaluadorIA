# Requirements Document: SDD-01 Remediation

## Intent Analysis

- **User Request**: Aplicar todos los faltantes del último informe de cumplimiento de SDD-01.
- **Request Type**: Remediación técnica y actualización de tooling.
- **Scope Estimate**: Múltiples archivos de configuración, dependencias, pruebas y artefactos AI-DLC.
- **Complexity Estimate**: Moderada.

## Alcance aprobado

Se remediarán los seis gaps identificados en `aidlc-docs/inception/reports/SDD-01-SDD-02-compliance-review.md:57-66`:

1. Activar reglas type-aware de `typescript-eslint` compatibles con ESLint 9.
2. Restaurar la configuración estricta de TypeScript en `apps/web`.
3. Sustituir thresholds de cobertura en cero por un mínimo de 70%.
4. Mantener el setup raíz de Vitest válido y verificarlo.
5. Mantener eliminado el archivo ESLint legacy de `apps/web` y verificarlo.
6. Verificar los hooks de Husky y Commitlint sobre el repositorio Git real sin crear commits.

## Requisitos funcionales

- `pnpm lint` debe ejecutar ESLint con reglas type-aware y terminar correctamente.
- `pnpm typecheck` debe pasar en los tres paquetes del workspace.
- `pnpm test` debe terminar correctamente.
- `pnpm test:coverage` debe cumplir los thresholds definidos para statements, branches, functions y lines.
- El setup raíz de Vitest debe continuar siendo compatible con todos los paquetes.
- No debe existir configuración ESLint legacy duplicada bajo `apps/web`.
- Los hooks deben ser sintácticamente válidos y Commitlint debe validar commits convencionales.

## Requisitos no funcionales

- Mantener la arquitectura y el comportamiento de producto sin cambios funcionales.
- Mantener el lockfile sincronizado con los manifests.
- Evitar exclusiones de cobertura que oculten código de producto; solo se excluirán artefactos generados, configuración, declaraciones y scripts de integración que requieran emuladores.
- Mantener compatibilidad con Node y pnpm declarados por el workspace.
- No introducir secretos, dependencias no verificadas ni cambios en los archivos ajenos ya presentes en `doc/` y `docs/`.

## Criterios de aceptación

- [ ] ESLint usa `recommendedTypeChecked` y `stylisticTypeChecked` con versiones compatibles.
- [ ] `apps/web/tsconfig.json` hereda los flags estrictos sin desactivarlos.
- [ ] `vitest.config.ts` define thresholds mínimos de 70% y la suite los cumple.
- [ ] `vitest.setup.ts` contiene únicamente setup válido.
- [ ] `apps/web/.eslintrc.json` no existe.
- [ ] `.husky/pre-commit` y `.husky/commit-msg` son ejecutables y sus comandos pasan las verificaciones disponibles sin crear commits.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm build` y `pnpm format:check` pasan.

## Decisiones

- Se utilizará ESLint 9 y `typescript-eslint` 8.x, alineados con la decisión arquitectónica de SDD-01.
- Se agregarán pruebas enfocadas en lógica y contratos; no se crearán pruebas frágiles para wrappers UI pasivos únicamente para inflar cobertura.
- Las pruebas que dependan de Firebase Emulator Suite quedarán como integración separada y se verificarán cuando los emuladores estén disponibles.
- No se realizará commit automáticamente.
