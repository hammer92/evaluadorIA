# **System Design Interviews: Aplicación de Validación de Conocimientos**

Basado en el plan de desarrollo proporcionado, este documento analiza el diseño del sistema siguiendo los 6 pasos estándar de una entrevista de diseño.

## **1\. Requisitos y Alcance (Requirements)**

El objetivo es construir una plataforma de evaluación segura que utiliza IA para generar, supervisar y calificar pruebas técnicas.

### **Requisitos Funcionales (RF)**

- **Administradores (RRHH):**
- (RF-1) Invitar candidatos por correo electrónico (HU-005).
- (RF-2) Crear y configurar "Plantillas de Evaluación" (tiempo, reintentos, competencias) (HU-007).
- (RF-3) Ver un dashboard con el estado de todos los candidatos (Pendiente, En Proceso, etc.) (HU-004).
- (RF-4) Revisar informes finales, nivelación de competencias (Ej. Junior/Senior) y grabaciones de proctoring (HU-006).
- **Candidatos:**
- (RF-5) Iniciar sesión de forma segura mediante OTP (One-Time Password) (HU-001).
- (RF-6) Realizar una prueba que consiste en preguntas de opción múltiple, abiertas y de código (HU-009, 010, 011).
- **Sistema (IA):**
- (RF-7) Generar dinámicamente preguntas basadas en la "receta" de la plantilla (HU-016).
- (RF-8) Proporcionar feedback inmediato y calificación _sincrónica_ después de cada respuesta (HU-017, HU-012b).
- (RF-9) Generar un informe final _asincrónico_ con análisis cualitativo y nivelación de competencias (HU-018).

### **Requisitos No Funcionales (RNF)**

- **Seguridad (Crítico):**
- (RNF-1) **Anti-Trampas:** Bloqueo de copiar/pegar y detección de pérdida de foco en la app de escritorio (HU-002, 003).
- (RNF-2) **Proctoring:** Grabación continua de la cámara web y la pantalla del candidato durante la prueba (HU-013, 014).
- **Fiabilidad (Crítico):**
- (RNF-3) **Manejo de Interrupciones:** El sistema debe sobrevivir a cierres de la app o pérdidas de internet, usando un contador de "reintentos de sesión" (HU-008b).
- **Baja Latencia (Crítico):**
- (RNF-4) El feedback inmediato del Agente Verificador (RF-8) debe ser rápido, ya que el candidato está esperando activamente.
- **Integración:**
- (RNF-5) El sistema debe enviar los informes finales a una API externa (ATS del cliente) (HU-019).

## **2\. Planificación de Capacidad (Scale Estimates)**

_Estas estimaciones no están en el plan; se asumen para guiar el diseño._

**Supuestos:**

- Plataforma para empresas medianas/grandes.
- Pico de **1,000** candidatos por día (en temporada de contratación).
- **100** administradores (reclutadores) activos.
- Duración media de la prueba: **90 minutos** (1.5 horas).
- Media de preguntas por prueba: **20**.

**Estimaciones de Almacenamiento (El mayor costo):**

- **Almacenamiento de Video (Proctoring):**
- Grabación (pantalla \+ cámara) comprimida: \~200 MB/hora.
- 1.5 horas/prueba \* 200 MB/hr \= 300 MB por candidato.
- 1,000 candidatos/día \* 300 MB/prueba \= **300 GB de subida de datos por día**.
- **Retención de Datos:** (Según Riesgo 5, asumamos 90 días).
- 300 GB/día \* 90 días \= **27 TB de almacenamiento en S3**.
- **Metadatos (DynamoDB):**
- Respuestas: 1,000 candidatos \* 20 respuestas/candidato \= 20,000 respuestas/día.
- Asumiendo 5 KB por respuesta \+ feedback de IA \= \~100 MB/día.
- **Conclusión:** El almacenamiento de metadatos es trivial. El costo principal y el desafío de ingeniería es el **almacenamiento y subida de video**.

**Estimaciones de Cómputo (El mayor cuello de botella):**

- **Agente Verificador (Sincrónico):** Es el servicio más crítico.
- 20,000 llamadas/día.
- Distribuidas en 8 horas de trabajo: 2,500 llamadas/hora.
- Pico: \~40-50 llamadas/minuto, o **\~1-2 llamadas/segundo**. El servicio debe manejar esto con baja latencia.
- **Agentes (Asincrónicos):** (Generador y Reporte Final).
- 1,000 llamadas/día cada uno. El tráfico es bajo y no es sensible a la latencia.

## **3\. Arquitectura de Alto Nivel (System Components)**

El plan propone una arquitectura serverless desacoplada, lo cual es ideal para esta carga de trabajo variable.

- **Cliente (Candidato):** Aplicación de escritorio **Electron.js**. Necesaria para los RNF de seguridad (bloqueo de comandos y grabación de pantalla/cámara).
- **Cliente (Admin):** Aplicación Web (React/Vue/Angular) alojada en **Amplify o S3/CloudFront**.
- **Punto de Entrada (API):** **Amazon API Gateway**. Gestiona el tráfico REST y la autenticación.
- **Lógica de Negocio:** **AWS Lambda**. Funciones serverless para manejar la lógica de negocio (login, plantillas, estado de la prueba).
- **Base de Datos (Metadatos):** **Amazon DynamoDB**. Base de datos NoSQL ideal para almacenar estado de usuarios, plantillas y respuestas, particionadas por CandidateID o TestID.
- **Almacenamiento de Blobs:** **Amazon S3**. Almacena las grabaciones de video de proctoring (HU-015) y el manual de instalación (HU-005b).
- **Servicios de IA:** **Amazon Bedrock Agents**. Orquesta los 3 agentes (Generador, Verificador, Informe) usando modelos fundacionales (ej. Claude, Llama).
- **Servicio de Email:** **Amazon SES**. Para enviar OTPs (HU-001) e invitaciones (HU-005).
- **Bus de Eventos:** **Amazon EventBridge**. Se usa para desacoplar las tareas asincrónicas pesadas (generar informe final y enviarlo a la API externa).

## **4\. Diseño de API (Core Endpoints)**

Se definen dos conjuntos de APIs, una para el administrador (Web) y otra para el candidato (Escritorio).

### **API de Administrador (Autenticada por Admin)**

- POST /admin/invite: (HU-005) Invita a un candidato.
- Body: { "email": "...", "name": "...", "templateId": "..." }
- GET /admin/candidates: (HU-004) Obtiene el dashboard de candidatos.
- GET /admin/candidates/{candidateId}: (HU-006) Obtiene el informe final y la URL del video.
- POST /admin/templates: (HU-007) Crea una nueva plantilla de evaluación.
- Body: { "name": "...", "timeLimit": 90, "maxRetries": 3, "competencies": \[...\] }

### **API de Candidato (Autenticada por OTP/JWT)**

- POST /auth/otp: (HU-001) Solicita un código OTP.
- Body: { "email": "..." }
- POST /auth/verify: (HU-001) Valida el OTP y retorna un JWT.
- Body: { "email": "...", "otp": "123456" }
- POST /test/start: (Autorizado) Inicia la prueba. Dispara la grabación (HU-014) y la generación de preguntas (HU-016). Retorna la primera pregunta.
- POST /test/answer: (Autorizado) Envía una respuesta y obtiene feedback.
- Body: { "questionId": "...", "answer": "..." }
- Respuesta (Sincrónica): { "feedback": "...", "score": 8.5 } (HU-017)
- GET /test/next-question: (Autorizado) Obtiene la siguiente pregunta (activa la pausa del timer, HU-012).
- POST /test/finish: (Autorizado) Finaliza la prueba. Dispara el informe final (HU-018) y la subida del video (HU-015).
- Respuesta: { "improvementPath": "...", "recommendations": "..." } (HU-020)
- POST /storage/upload-url: (Autorizado) Obtiene una URL pre-firmada de S3 para subir el video.
- Body: { "testId": "..." }
- Respuesta: { "uploadUrl": "https://s3.signed-url..." }

## **5\. Diseño de Base de Datos (Data Model)**

Se selecciona **DynamoDB** (NoSQL), alineado con la arquitectura serverless y los patrones de acceso (centrados en el candidato).

- **Tabla: Templates**
- PK: templateId
- Atributos: name, timeLimit, maxRetries, competencies (JSON con la "receta" HU-007).
- **Tabla: Candidates**
- PK: candidateId
- GSI (Índice Secundario Global): email (para login)
- Atributos: email, name, status (Pendiente, EnProceso, Finalizado, Bloqueado), templateId, attemptsUsed (HU-008b), reportId, videoUrl.
- **Tabla: Tests**
- PK: testId
- GSI: candidateId (para buscar la prueba de un candidato)
- Atributos: candidateId, status, startTime, endTime, questions (JSON con las preguntas generadas por HU-016).
- **Tabla: Answers**
- PK: testId
- SK (Clave de Ordenación): questionId
- Atributos: candidateAnswer, agentFeedback (HU-017), score.
- **Tabla: Reports**
- PK: reportId
- GSI: candidateId
- Atributos: summary, strengths, weaknesses, improvementPath (HU-020), competencyLevels (JSON { "React": "Junior", ... }) (HU-018).

## **6\. Escalabilidad y Fiabilidad (Performance & Reliability)**

Esta sección aborda los riesgos clave identificados en el plan de desarrollo.

### **Cuello de Botella 1: Latencia del Agente Verificador (RNF-4)**

- **Problema:** El candidato envía una respuesta (HU-017) y debe esperar el feedback _antes_ de continuar (HU-012b). Una IA lenta arruina la experiencia.
- **Solución (Mitigación del Riesgo 1):**

1. **Modelo Rápido:** Usar el modelo de IA más rápido disponible (ej. gemini-2.5-flash-preview-00-2025 o Claude 3 Haiku).
2. **Gestión de UX:** La UI del cliente debe mostrar un estado de carga claro ("Analizando tu respuesta...").
3. **Timeouts Agresivos:** Implementar un timeout corto (ej. 15 segundos). Si la IA falla, se registra la respuesta y se permite al candidato continuar, marcando el feedback como "pendiente de revisión manual".

### **Fiabilidad 1: Manejo de Interrupciones (RNF-3)**

- **Problema:** El candidato cierra la app, se corta el internet o la PC se bloquea.
- **Solución (HU-008b):**

1. **Estado en Backend:** El estado de la prueba (status: "EnProceso") y todas las respuestas enviadas se guardan en DynamoDB.
2. **Contador de Reintentos:** Al re-abrir la app e iniciar sesión (OTP), el backend verifica el contador attemptsUsed (HU-007).
3. **Lógica:**

- Si attemptsUsed \< maxRetries: Se incrementa el contador y se permite al usuario continuar desde la última pregunta no respondida.
- Si attemptsUsed \>= maxRetries: Se cambia el estado a status: "Bloqueado" y se finaliza la prueba (HU-008b).

### **Fiabilidad 2: Subida de Video (Proctoring) (RNF-2)**

- **Problema:** La subida de un archivo de 300 MB (HU-015) al final de la prueba es propensa a fallos. Si falla, se pierde la evidencia de proctoring.
- **Solución:**

1. **URL Pre-firmada de S3:** La app cliente _no_ sube el video a la API. Solicita una URL de subida segura (/storage/upload-url).
2. **Subida Directa a S3:** El cliente Electron usa la API de S3 (Multipart Upload) para subir el archivo directamente al bucket. Esto es más rápido, robusto y permite reanudar subidas fallidas.
3. **Confirmación:** Una vez S3 confirma la subida, el cliente hace una llamada final a la API (ej. POST /test/video-uploaded) para que el backend actualice videoUrl en la tabla Candidates.

### **Escalabilidad del Backend: Desacoplamiento (RNF-5)**

- **Problema:** Al finalizar la prueba, deben ocurrir dos cosas: generar el informe (lento) y enviar el reporte a la API del cliente (riesgoso, puede fallar).
- **Solución (Arquitectura del Diagrama):**

1. **Evento:** La función Lambda (POST /test/finish) no hace el trabajo pesado. Simplemente publica un evento TestFinished en **Amazon EventBridge**.
2. **Consumidor 1 (Informe):** Una Lambda (L) se suscribe a ese evento, invoca al Agente de Informe (HU-018) y guarda los resultados en DynamoDB.
3. **Consumidor 2 (API Externa):** Otra Lambda (F) se suscribe, toma el informe y lo envía a la API externa (HU-019).
4. **Ventaja:** Si la API externa está caída, EventBridge puede reintentar automáticamente o enviar el evento fallido a una "Dead-Letter Queue" (DLQ) para revisión manual, sin afectar al candidato.
