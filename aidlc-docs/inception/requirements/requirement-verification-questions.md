# Clarifying Questions for SDD-03 (Firebase Setup)

Basado en el análisis del documento `SDD-03-firebase-setup.md`, la especificación es muy clara, pero hay un par de preguntas abiertas ("Open Questions") en el documento original y detalles de implementación que necesitan ser aclarados.

Por favor, proporciona tus respuestas a continuación de la etiqueta `[Answer]:`.

### Q1: Firebase App Check

El documento SDD-03 plantea si se debe activar Firebase App Check en esta etapa o esperar a SDD-08. El documento sugiere postergarlo. ¿Estás de acuerdo?
A) Sí, postergar la implementación de App Check a SDD-08 (Recomendado).
B) No, implementar App Check ahora en SDD-03.
C) Otro (por favor especifica).

[Answer]: a

### Q2: Restricciones estrictas en Firestore (createdAt)

Se sugiere en el SDD-03 considerar si las reglas de Firestore deberían rechazar operaciones donde `request.resource.data.createdAt` sea distinto de `request.time`. Esto aumenta la seguridad evitando que clientes envíen fechas de creación falsificadas. ¿Deseas aplicar esta restricción estricta?
A) Sí, aplicar la validación de `createdAt == request.time` para todos los documentos creados (Recomendado).
B) No, mantener las reglas exactamente como están descritas en la especificación base del SDD-03.
C) Otro (por favor especifica).

[Answer]: a

### Q3: Inicialización del Admin SDK con Emuladores

El código propuesto en la sección 4.8 para inicializar el `firebase-admin` asume la existencia de credenciales reales (`FIREBASE_ADMIN_PRIVATE_KEY`). Para trabajar cómodamente en local con los emuladores, generalmente se recomienda inicializar la app sin estas credenciales (usando un project ID genérico como `demo-admin-platform-dev`) si detectamos que estamos en entorno emulado. ¿Estás de acuerdo con añadir una validación para inicializar el Admin SDK sin credenciales cuando estemos conectados a los emuladores locales?
A) Sí, inicializar sin credenciales (fake project ID) si la variable de emulador está presente para simplificar el setup local (Recomendado).
B) No, forzar el uso de `.env.local` con credenciales reales aunque usemos emuladores.
C) Otro (por favor especifica).

[Answer]: a
