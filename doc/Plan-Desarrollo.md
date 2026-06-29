# **Plan de Desarrollo: Aplicación de Validación de Conocimientos**

## **1\. Resumen Ejecutivo**

**Objetivo del Proyecto:** Desarrollar una aplicación de escritorio segura para la validación de conocimientos técnicos, que **genera dinámicamente**, supervisa y evalúa pruebas mediante el uso de agentes de IA basados en competencias, garantizando la integridad del proceso a través de funciones de proctoring y anti-trampas.

**Plataforma:** Aplicación de Escritorio (Windows, macOS, Linux).

**Metodología Recomendada:** Agile (Scrum), dividida en Fases/Sprints enfocados en la entrega de valor incremental.

## **2\. Componentes Clave de la Arquitectura**

Para construir esto, necesitaremos varios componentes que trabajen juntos:

1. **Aplicación de Escritorio (Cliente):** La interfaz que el candidato utiliza.

- _Tecnología Sugerida:_ **Electron.js**. Electron permite usar tecnologías web (HTML, CSS, JS) y da acceso de bajo nivel al SO para el bloqueo de comandos y la grabación de pantalla/cámara.

2. **Backend (Servidor API):** El cerebro que gestiona la lógica de negocio, los usuarios, las pruebas y la comunicación con los agentes.
3. **Base de Datos:** Almacena usuarios, candidatos, **configuración de competencias**, pruebas **generadas**, respuestas e informes.
4. **Servicios de Agentes IA:** Pueden ser microservicios o funciones serverless que se encargan de las tareas de IA (Generar, Verificar, Informar).
5. **Servicio de Email:** Para el envío de OTP (Ej. SendGrid, Mailgun).
6. **Servicio de Almacenamiento (Cloud):** Para guardar de forma segura las grabaciones de video (Ej. AWS S3, Google Cloud Storage).

## **3\. Epics del Proyecto y Historias de Usuario (HU)**

Aquí desglosamos los requisitos en grandes bloques (Epics) y las historias de usuario (HU) que el equipo de desarrollo implementará.

### **Epic 1: Gestión de Acceso y Seguridad (Core)**

_Objetivo: Asegurar que solo usuarios autorizados accedan y mantener la integridad de la prueba._

- **HU-001 (Login OTP):** "Como **candidato**, quiero **recibir un código de un solo uso (OTP) en mi correo electrónico** al ingresar mi email, para **poder acceder a la plataforma de forma segura**."
- **HU-002 (Bloqueo de Comandos):** "Como **administrador**, quiero que la **aplicación de escritorio bloquee los comandos de 'copiar' (Ctrl+C), 'pegar' (Ctrl+V) y 'cortar' (Ctrl+X)**, para **evitar que los candidatos usen herramientas externas o IA para responder**."
- **HU-003 (Detección de Foco):** "Como **administrador**, quiero que la **aplicación detecte si el candidato minimiza la ventana o cambia a otra aplicación**, para **registrarlo como un posible intento de trampa**."

### **Epic 2: Módulo de Administración de Candidatos**

_Objetivo: Permitir al personal de RRHH o a los reclutadores gestionar el ciclo de vida de las evaluaciones._

- **HU-004 (Dashboard de Candidatos):** "Como **administrador**, quiero **ver un dashboard con todos los candidatos**, su **correo, la prueba asignada, su estado actual** (Pendiente, En Proceso, Finalizado, Bloqueado) y el **número de re-intentos de sesión utilizados**, para **gestionar el proceso de selección eficientientemente**."
- **HU-005 (Invitar Candidato y Notificar):** "Como **administrador**, al **registrar un nuevo candidato (nombre, email) y asignarle una prueba**, quiero que el **sistema le envíe automáticamente un correo electrónico** para **notificarle que su prueba está activa y cómo acceder**."
- **HU-005b (Manual de Candidato):** "Como **candidato**, en el **correo de invitación**, quiero **recibir un enlace a un manual o guía rápida** que me **explique cómo descargar, instalar e iniciar la aplicación de escritorio** para **comenzar mi proceso de evaluación sin problemas**."
- **HU-006 (Revisión de Proceso):** "Como **administrador**, quiero **hacer clic en un candidato 'Finalizado' o 'Bloqueado' y ver un resumen de sus resultados**, los **niveles de competencia (ej. Junior, Senior)** asignados, el **informe del agente y el enlace al video de proctoring**, para **tomar una decisión de contratación**."

### **Epic 3: Módulo de Evaluación (Experiencia del Candidato)**

_Objetivo: Crear el entorno donde el candidato realiza la prueba._

- **HU-007 (Configuración de Plantilla de Evaluación):** "Como **administrador**, al **crear una nueva plantilla de evaluación**, quiero poder:

1. **Configurar el tiempo total** (ej. 90 min o 'tiempo ilimitado').
2. **Añadir una o más 'competencias'** (ej. 'React Hooks').
3. **Para cada competencia**, definir un **contexto** y **cantidades mínimas por tipo de pregunta** (ej. 2 múltiple, 1 código, 1 abierta).
4. **Definir el número máximo de re-intentos de sesión** (ej. 3 intentos) que un candidato tiene para reingresar si cierra la aplicación antes de finalizar."

- **HU-008 (Inicio de Prueba e Instrucciones Claras):** "Como **candidato**, al iniciar sesión, quiero **ver las instrucciones de la prueba**, incluyendo el **tiempo límite (o si es ilimitado), el número de preguntas, las reglas de proctoring**, la **regla de pausa del timer** (si aplica) y el **límite de re-intentos de sesión**, para **entender el proceso antes de comenzar**."
- **HU-008b (Manejo de Interrupciones y Re-intentos):** "Como **sistema**, cuando **un candidato intenta reingresar a una prueba 'En Proceso'** (después de un cierre inesperado o salida), quiero **verificar su contador de intentos de re-ingreso**. Si el contador es menor al límite (definido en HU-007), **le permitiré continuar donde se quedó**. Si supera el límite, la **prueba se marcará como 'Bloqueada'** y se le informará al candidato."
- **HU-009 (Preguntas de Selección Múltiple):** "Como **candidato**, quiero **poder ver una pregunta de selección múltiple y elegir una o varias opciones** como respuesta."
- **HU-010 (Preguntas Abiertas):** "Como **candidato**, quiero **poder ver una pregunta abierta y escribir mi respuesta** en un campo de texto."
- **HU-011 (Preguntas de Código):** "Como **candidato**, quiero **ver un problema de código y tener un editor simple (con resaltado de sintaxis)** donde pueda **escribir y ejecutar mi solución** (contra casos de prueba básicos)."
- **HU-012 (Flujo de Evaluación y Pausa de Timer):** "Como **candidato**, quiero **ver un temporizador global de la prueba (si aplica)**. Este temporizador **deberá pausarse automáticamente cuando estoy en la pantalla de feedback (HU-012b)** y **reanudar cuando cargo la siguiente pregunta**, para **no consumir mi tiempo de evaluación durante la revisión**."
- **HU-012b (Visualización de Feedback Inmediato):** "Como **candidato**, después de **enviar mi respuesta a una pregunta**, quiero **ver un feedback inmediato** (generado por el agente verificador) sobre mi desempeño en esa pregunta, para **entender mis errores antes de pasar a la siguiente**."

### **Epic 4: Sistema de Proctoring (Supervisión)**

_Objetivo: Grabar la sesión del candidato para validación y auditoría._

- **HU-013 (Solicitud de Permisos):** "Como **candidato**, antes de comenzar la prueba, quiero que la **aplicación me solicite permisos para acceder a mi cámara web y grabar mi pantalla**, y **debo aceptar para continuar**."
- **HU-014 (Inicio de Grabación):** "Como **sistema**, al **momento en que el candidato presiona 'Iniciar Prueba'**, quiero **comenzar a grabar simultáneamente la cámara web y la pantalla completa**."
- **HU-015 (Finalización y Subida de Grabación):** "Como **sistema**, cuando **el candidato finaliza la prueba (o se bloquea, o se acaba el tiempo)**, quiero **detener las grabaciones, compilarlas en un solo archivo de video y subirlo de forma segura** al servicio de almacenamiento en la nube."

### **Epic 5: Módulo de Agentes IA**

_Objetivo: Automatizar la creación, corrección y análisis de las pruebas._

- **HU-016 (Agente Generador de Evaluación \- Basado en Receta):** "Como **sistema**, al **generar una evaluación para un candidato (basada en una plantilla HU-007)**, quiero que el **Agente Generador lea la 'receta' de cada competencia**, y **genere la cantidad solicitada de cada tipo de pregunta** (múltiple, código, abierta) basándose en el **contexto y nivel de dificultad provistos**."
- **HU-017 (Agente Verificador de Respuestas \- Sincrónico):** "Como **sistema**, **inmediatamente después de que el candidato envía una respuesta**, quiero que el **Agente Verificador analice la respuesta (abierta, múltiple, código)**, la **compare con una rúbrica, evalúe su calidad y genere un feedback y puntaje** que será **mostrado al candidato de inmediato**."
- **HU-018 (Agente Generador de Informe Final y Nivelación):** "Como **sistema**, quiero que el **Agente de Informe Final** (al finalizar la prueba):

1. **Compile los puntajes** (acumulados de cada pregunta).
2. **Agrupe todas las respuestas por cada 'competencia'** definida en la plantilla.
3. **Analice el desempeño holístico** del candidato dentro de _cada_ competencia.
4. **Asigne un nivel de maestría (ej. Junior, Advanced, Senior)** para _cada_ competencia evaluada, basándose en la calidad de todas sus respuestas (Este nivel es solo para el administrador).
5. **Genere un informe cualitativo** que incluya fortalezas, debilidades, y una **ruta de mejora y recomendaciones**."

### **Epic 6: Reporte y Cierre del Proceso**

_Objetivo: Entregar los resultados tanto al administrador como al candidato._

- **HU-019 (API de Resultados):** "Como **sistema**, al **finalizar la generación del informe final**, quiero **enviar automáticamente un paquete de datos (JSON) a una API externa configurable** que contenga **el informe (incluyendo los niveles por competencia)**, el **historial de respuestas (y su feedback)** y la **URL del video de proctoring**, para **integrarse con el ATS (Applicant Tracking System) del cliente**."
- **HU-020 (Feedback Final al Candidato):** "Como **candidato**, al **finalizar mi evaluación** (sea por completitud o bloqueo), quiero **ver una pantalla de agradecimiento** junto con la **ruta de mejora y las recomendaciones generadas por el agente de informe** (sin ver el nivel de competencia asignado), para **obtener un plan de acción claro**."

## **4\. Plan de Implementación por Fases (Roadmap)**

Sugiero un enfoque por fases para mitigar riesgos y entregar valor rápidamente.

### **Fase 1: MVP (Producto Mínimo Viable) \- El Core de la Evaluación**

- **Enfoque:** Construir la funcionalidad central de tomar una prueba.
- **Historias Clave:** HU-001 (OTP), HU-004 (Dashboard básico), **HU-005 (Invitar y Notificar)**, **HU-005b (Manual)**, **HU-007 (Configuración de Plantilla, aún simplificada para MVP)**, **HU-008 (Instrucciones dinámicas)**, HU-009, HU-010, HU-011.
- **Nota MVP:** En esta fase, HU-007 permite _definir_ la plantilla, pero la generación de preguntas (HU-016) aún no está; se usarán preguntas pre-cargadas manualmente para validar el flujo. **El feedback (HU-012b) será simulado o simple (ej. "Respuesta Correcta/Incorrecta") sin IA.**

### **Fase 2: Integración de Seguridad y Agentes IA**

- **Enfoque:** Hacer la plataforma segura e inteligente con generación dinámica y feedback inmediato.
- **Historias Clave:** HU-002 (Bloqueo), HU-003 (Detección Foco), **HU-004 (Visibilidad de re-intentos)**, **HU-007 (Config. completa de re-intentos)**, **HU-008b (Lógica de bloqueo por re-intentos)**, **HU-016 (Agente Generador \- Basado en Receta)**, **HU-012 (Flujo por pregunta y timer con pausa)**, **HU-012b (Feedback Inmediato)**, **HU-017 (Verificador Sincrónico)**, **HU-018 (Agente de Informe con Nivelación)**.
- **Resultado:** La plataforma ahora **genera**, **califica interactivamente** y **maneja interrupciones** de las evaluaciones.

### **Fase 3: Proctoring y Cierre (Funcionalidades Enterprise)**

- **Enfoque:** Añadir la capa de supervisión avanzada y la integración final.
- **Historias Clave:** HU-013 (Permisos), HU-014 (Grabación), **HU-015 (Finalización de grabación)**, **HU-006 (Revisión Admin con Nivelación)**, **HU-019 (API Externa con Nivelación)**, **HU-020 (Feedback Final al Candidato)**.
- **Resultado:** Producto completo listo para el mercado.

## **5\. Riesgos Clave y Estrategias de Mitigación**

1. **Riesgo (Alto): Latencia del Agente Verificador Sincrónico.**

- **Mitigación:** El candidato no puede continuar hasta que la IA responda. Se deben usar modelos de IA optimizados para velocidad (ej. gemini-2.5-flash-preview-00-2025) y mostrar un estado de carga claro (ej. "Analizando tu respuesta...") para gestionar la expectativa del candidato.

2. **Riesgo (Alto):** Calidad y Coherencia del Agente Generador de Preguntas (Basado en Receta).

- **Mitigación:** Este es ahora el mayor riesgo. El Agente debe ser "prompted" con rúbricas muy claras para seguir la "receta" (HU-007). Se debe implementar un **paso de validación humana** (QA por un experto) para las primeras N pruebas generadas, para asegurar que las preguntas son relevantes, tienen la dificultad correcta y cumplen con el contexto.

3. **Riesgo:** El bloqueo de copiar/pegar y la detección de foco pueden ser eludidos en algunos SO.

- **Mitigación:** Es una medida disuasoria, no infalible. La principal medida de seguridad es el **Proctoring (grabación de pantalla y cámara)**.

4. **Riesgo (Alto):** Precisión de los Agentes de IA (Verificador de Código y **Nivelación de Competencia**).

- **Mitigación:** Iniciar con un modelo de "Humano en el Bucle" (Human-in-the-loop), donde el agente asigna un puntaje _sugerido_ y un nivel _sugerido_ que un administrador debe validar. Entrenar a los agentes con los datos de estas validaciones.

5. **Riesgo:** Privacidad y Almacenamiento de Datos (Videos).

- **Mitigáción:** Implementar políticas claras de consentimiento (HU-013), encriptación robusta de los videos almacenados y políticas de retención de datos (ej. eliminar videos después de 90 días).

6. **Riesgo: Manejo de Interrupciones Justas.**

- **Descripción:** Un corte de internet o un crash de la app no es culpa del candidato. El sistema debe ser robusto para diferenciar un 're-intento' (re-login) de una 'sesión' (el candidato ve las preguntas).
- **Mitigación:** El contador de 're-intentos' (HU-007.4) solo debe incrementarse si el candidato vuelve a la pantalla de login _después_ de haber iniciado la prueba (HU-014). El estado 'En Proceso' debe guardarse en el backend y el frontend debe re-sincronizarse al reconectar.

## **6\. Mapa del Sitio y Flujo de Pantallas (UX)**

A continuación, se presenta una visualización de alto nivel de las pantallas y flujos de usuario para garantizar una UX coherente, separada por las dos interfaces principales.

### **A. Interfaz de Administración (Web App)**

Este es el panel donde los reclutadores y administradores gestionan el proceso.

1. **Login de Administrador** (No detallado en HU, pero implícito)
2. **Pantalla Principal: Dashboard de Candidatos (HU-004)**
   - Vista de tabla/lista de todos los candidatos.
   - Columnas: Estado (Pendiente, En Proceso, Finalizado, Bloqueado), Intentos Usados, etc.
   - Acción: Filtros por estado.
   - Acción: `[Botón: Invitar Candidato]` \-\> Abre **Modal 6.A.1**.
   - Acción: `[Clic en Candidato]` \-\> Navega a **Pantalla 6.A.3**.
3. **Pantalla: Gestión de Plantillas de Evaluación (HU-007)**
   - Vista de lista de plantillas creadas.
   - Acción: `[Botón: Crear Nueva Plantilla]` \-\> Navega a **Pantalla 6.A.2**.
   - Acción: `[Editar Plantilla]` \-\> Navega a **Pantalla 6.A.2**.
4. **Pantalla: Detalle del Candidato (HU-006)**
   - Información del candidato.
   - Resumen del Informe (HU-018).
   - **Vista: Nivel de Competencia (Junior/Senior) (HU-018.4)**.
   - Vista: Historial de respuestas y feedback dado.
   - Acción: `[Botón: Ver Grabación de Proctoring]` (HU-015) \-\> Abre video en modal o nueva pestaña.

#### **Modales y Sub-Pantallas (Admin)**

- **Modal 6.A.1: Invitar Nuevo Candidato (HU-005)**
  - Input: Nombre del Candidato.
  - Input: Email del Candidato.
  - Dropdown: Seleccionar Plantilla de Evaluación (de HU-007).
  - Acción: `[Botón: Enviar Invitación]` (Dispara email HU-005b).
- **Pantalla 6.A.2: Editor de Plantillas (HU-007)**
  - Input: Nombre de la Plantilla.
  - Toggle: \[Tiempo Límite\] vs \[Ilimitado\].
  - Input (Condicional): Duración (ej. "90 minutos").
  - Input: Límite de Re-intentos de Sesión (ej. "3").
  - **Sección Dinámica: Competencias (HU-007.3)**
    - Acción: `[Botón: Añadir Competencia]` \-\> Abre **Modal 6.A.2.1**.
    - Lista de competencias añadidas.
  - Acción: `[Botón: Guardar Plantilla]`.
- **Modal 6.A.2.1: Configurar Competencia (HU-007.3)**
  - Input: Nombre de Competencia (ej. "JavaScript Moderno").
  - Input (TextArea): Contexto de Evaluación (para la IA).
  - Input (Number): Cant. Preguntas Múltiple.
  - Input (Number): Cant. Preguntas Abiertas.
  - Input (Number): Cant. Preguntas de Código.
  - Acción: `[Botón: Guardar Competencia]`.

### **B. Interfaz del Candidato (Aplicación de Escritorio)**

Este es el flujo lineal y seguro que el candidato experimenta.

1. **Pantalla: Login (HU-001)**
   - (App de escritorio iniciada tras instalación desde manual HU-005b).
   - Input: Email.
   - Acción: `[Botón: Enviar Código de Acceso]`.
2. **Pantalla: Verificación OTP (HU-001)**
   - Input: Código de 6 dígitos (recibido por correo).
   - Acción: `[Botón: Iniciar Sesión]`.
3. **Pantalla: Instrucciones y Bienvenida (HU-008)**
   - Vista: Muestra reglas (Tiempo, No copiar/pegar, Límite de re-intentos).
   - Vista: Muestra regla de pausa del timer (HU-012).
   - Acción: `[Botón: Entendido, Siguiente]`.
4. **Pantalla: Verificación de Permisos (Proctoring) (HU-013)**
   - Texto explicativo.
   - Acción: `[Botón: Conceder Permisos de Cámara y Pantalla]` (Dispara diálogos nativos del SO).
   - (Una vez aceptado)
   - Acción: `[Botón: Comenzar Evaluación]` (Dispara HU-014, inicia grabación).
5. **Pantalla: Evaluación (Flujo Principal)**
   - Header: Timer Global (si aplica) (HU-012).
   - Header: Pregunta X / Y.
   - **Vista de Pregunta (HU-009, HU-010, HU-011)**
     - Muestra el enunciado de la pregunta (generada por HU-016).
     - Muestra el área de respuesta (radio buttons, text area, o editor de código).
   - Acción: `[Botón: Enviar Respuesta]`.
6. **Vista: Feedback Inmediato (HU-012b)**
   - (Reemplaza la vista de pregunta).
   - **Estado de Carga:** "Analizando tu respuesta..." (Riesgo 1).
   - **Vista de Feedback:** Muestra el análisis del Agente Verificador (HU-017).
   - _Nota: El Timer Global está en pausa (HU-012)._
   - Acción: `[Botón: Siguiente Pregunta]`.
   - _(El flujo repite 5 \-\> 6 hasta la última pregunta)_.
7. **Pantalla: Fin de la Evaluación (HU-020)**
   - Texto: "¡Evaluación completada\! Gracias."
   - Vista: Muestra la Ruta de Mejora y Recomendaciones (generadas por HU-018).
   - _(No se muestra el Nivel de Competencia)_.
   - _En background: Se detiene y sube la grabación (HU-015), se envía reporte a API (HU-019)._
   - Acción: `[Botón: Salir de la Aplicación]`.

#### **Flujos Alternativos (Candidato)**

- **Flujo: Interrupción y Re-intento (HU-008b)**
  - (Usuario cierra la app en Pantalla 5 o 6).
  - (Usuario abre la app de nuevo) \-\> Va a **Pantalla 1 (Login)**.
  - (Usuario completa Login) \-\> Sistema verifica intentos.
  - **Si (intentos \< límite):** \-\> Navega a **Pantalla 5 (donde quedó)**.
  - **Si (intentos \>= límite):** \-\> Navega a **Pantalla 6.B.1 (Bloqueado)**.
- **Pantalla 6.B.1: Prueba Bloqueada (HU-008b)**
  - Texto: "Has excedido el número máximo de intentos para reingresar a la prueba. Tu evaluación ha sido finalizada y enviada para revisión."
  - (Flujo termina aquí, se trata como una finalización para HU-018, HU-019).

## **7\. Diagrama de Arquitectura de Backend (AWS Serverless)**

Esta sección detalla la arquitectura de backend propuesta, utilizando **Electron** para el cliente de escritorio y un stack 100% serverless en **AWS**, con **Amazon Bedrock** para los agentes de IA.

### **Componentes Principales:**

- **Cliente Desktop:** Aplicación **Electron.js** (Instalada por el candidato).
- **Cliente Admin:** Aplicación Web (Alojada en AWS Amplify o S3/CloudFront).
- **Capa de API:** **Amazon API Gateway** (REST API) como punto de entrada único.
- **Lógica de Negocio:** **AWS Lambda** (Funciones en Python/Node.js) para toda la lógica de negocio.
- **Base de Datos:** **Amazon DynamoDB** (NoSQL) para almacenar estado, usuarios, plantillas de competencias, respuestas e informes.
- **Agentes IA:** **Amazon Bedrock Agents** (Agente Generador, Verificador, Informe) que orquestan modelos fundacionales (ej. Claude 3, Llama 3\) y usan funciones Lambda como "Action Groups" para interactuar con DynamoDB.
- **Almacenamiento:** **Amazon S3** para alojar los videos de proctoring (HU-015) y el manual de usuario (HU-005b).
- **Mensajería y Notificación:**
  - **Amazon SES (Simple Email Service)** para enviar el OTP (HU-001) y la invitación (HU-005).
  - **Amazon EventBridge** como bus de eventos para desacoplar el envío final a la API externa (HU-019).

### **Diagrama de Flujo (Mermaid)**

`graph TD`

    `subgraph "Cliente (Usuario)"`

        `A["Aplicacion Escritorio (Electron)"]`

        `B["Panel Administracion (Web App)"]`

    `end`

    `subgraph "Capa de API (Serverless)"`

        `C["Amazon API Gateway (REST API)"]`

    `end`

    `subgraph "Logica de Negocio (Serverless)"`

        `D["AWS Lambda (Logica Principal)"]`

        `E["AWS Lambda (Acciones de Agente)"]`

        `F["AWS Lambda (Reporte API Externa)"]`

    `end`

    `subgraph "Servicios de Datos (Serverless)"`

        `G["Amazon DynamoDB (Base de Datos NoSQL)"]`

        `H["Amazon S3 (Almacenamiento Video/Manuales)"]`

    `end`

    `subgraph "Servicios de IA (Serverless)"`

        `I[Amazon Bedrock Agents]`

        `J["Agente Generador (Bedrock)"]`

        `K["Agente Verificador (Bedrock)"]`

        `L["Agente Informe Final (Bedrock)"]`

    `end`

    `subgraph "Servicios de Soporte"`

        `M["Amazon SES (Email OTP/Invitacion)"]`

        `N["Amazon EventBridge (Bus de Eventos)"]`

        `O["API Externa (Cliente ATS)"]`

    `end`

    `%% --- Flujos de Usuario ---`

    `A -- "Peticiones API (Login, Enviar Respuesta)" --> C`

    `B -- "Peticiones API (Invitar, Ver Reporte)" --> C`

    `C -- Invoca --> D`

    `%% --- Logica Principal ---`

    `D -- "Lee/Escribe" --> G`

    `D -- "Envia Email" --> M`

    `D -- "Genera URL de Carga/Lectura" --> H`

    `A -- "Sube Video (HU-015)" --> H`

    `B -- "Lee Reporte/Video" --> H`

    `%% --- Flujo de Agentes IA ---`

    `D -- "Invoca (Generar Prueba)" --> I`

    `D -- "Invoca (Verificar Respuesta)" --> I`

    `I --> J`

    `I --> K`

    `I --> L`

    `I -- "Usa 'Action Groups'" --> E`

    `E -- "Lee (Contexto/Rubricas)" --> G`

    `%% --- Flujo de Reporte Final ---`

    `D -- "Fin de Prueba" --> N`

    `N -- Invoca --> F`

    `F -- "Envia Payload (HU-019)" --> O`
