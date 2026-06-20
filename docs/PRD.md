# Product Requirements Document (PRD)
## Proyecto: PLAUD Corporate Intelligence (PLAUD-CI)

Este documento define los requisitos de producto para la evolución y consolidación del prototipo "AI Study Buddy" en la plataforma corporativa definitiva **PLAUD-CI**. Está diseñado para la captura de ideas, transcripción con diarización de alta fidelidad, resúmenes ejecutivos estructurados por plantillas, mapas de conocimiento espaciales y análisis cruzado de múltiples fuentes de información corporativa.

---

## 1. Visión General del Producto

### 1.1 Declaración de la Visión
**PLAUD-CI** es una plataforma de software corporativa diseñada para capturar, transcribir y sintetizar de manera inteligente el contenido de reuniones presenciales y virtuales, llamadas y documentos de negocio. Inspirado en la sofisticada interfaz web de **PLAUD.AI** y el entorno de conocimiento de **NotebookLM** de Google, el producto permite transformar flujos de audio, video y documentos desorganizados en activos de información corporativa estructurada, accionable, visual y semánticamente consultable a nivel organizacional.

### 1.2 Audiencia Objetivo
*   **Directivos y Ejecutivos de C-Level**: Para obtener resúmenes rápidos de decisiones estratégicas y métricas sin asistir a largas sesiones de alineación.
*   **Gestores de Proyectos (PMs)**: Para la generación automática de actas de reunión, listas de tareas pendientes (Action Items) con responsables y plazos de entrega claros.
*   **Equipos de Ingeniería y Producto**: Para registrar discusiones de diseño de arquitectura, lluvias de ideas de producto y decisiones técnicas de alta complejidad.
*   **Consultores y Analistas**: Para procesar de forma unificada grabaciones de entrevistas con clientes junto con contratos y reportes corporativos extensos en un solo lugar.

---

## 2. Requisitos de Funcionalidades (Feature Requirements)

### 2.1 Captura e Ingesta Multimodal (Alta Capacidad)
*   **F-1.1: Grabación en Vivo**: Capacidad de registrar audio en tiempo real directamente desde el navegador, con retroalimentación visual del volumen y medidores dinámicos que no bloqueen la interfaz principal.
*   **F-1.2: Carga de Archivos de Audio y Video**: Soporte para formatos comunes (MP3, WAV, MP4, WebM, MOV, M4A) con un límite de alta capacidad de hasta 150 MB por archivo.
*   **F-1.3: Carga Segmentada (Chunked Upload)**: Soporte técnico robusto para fragmentar archivos grandes en porciones (ej. 3MB-4MB) antes del envío, asegurando estabilidad en conexiones inestables.
*   **F-1.4: Ingesta de Documentos de Negocio**: Habilidad para subir documentos contextuales complementarios (presentaciones, actas previas, contratos, agendas en PDF escaneados o legibles, Markdown, TXT) que actúen como "contexto de fondo" para calibrar las transcripciones de las reuniones.

### 2.2 Transcripción Fiel y Diarización de Hablantes Premium
*   **F-2.1: Diarización de Hablantes Multilingüe (Speaker Diarization)**: Identificación automática de los diferentes interlocutores (ej. "Speaker A", "Speaker B"). Utilizando el motor de Google Speech-to-Text V2 (Chirp 2), el sistema debe soportar cambios automáticos de idioma (code-switching) y mapear los oradores de forma coherente.
*   **F-2.2: Re-etiquetado Inteligente de Oradores**: Mapeo automático en base a auto-presentaciones, firmas de voz o el contexto del perfil corporativo de los usuarios frecuentes (ej. mapear "Speaker 1" a "Julio" de forma automática en el resumen final). Permite al usuario renombrar oradores directamente en la interfaz de forma interactiva y propagar el cambio instantáneamente.
*   **F-2.3: Transcripción Estructurada por Bloques**: El texto de la transcripción debe organizarse cronológicamente en temas bien diferenciados, con visualización del minuto y segundo exacto en un lado de la interfaz, permitiendo la navegación rápida haciendo clic en el bloque para saltar al audio original.
*   **F-2.4: Tubería de Audio Auto-Sanable (Self-Healing Audio Pipeline)**: Para evitar bucles de repetición infinitos o transcripciones incompletas en grabaciones extensas (de hasta 3-4 horas), el sistema debe monitorear la salida en tiempo real. Si se detecta un patrón de bucle, el pipeline debe conmutar automáticamente a un sistema de auto-recuperación de alta precisión respaldado por Google Cloud Speech-to-Text de manera asíncrona.
*   **F-2.5: Reproducción y Streaming Confiable de Históricos**: Las grabaciones de sesiones guardadas deben transmitirse bajo demanda desde Google Cloud Storage (GCS) de forma segura y optimizada, permitiendo que la interfaz del reproductor cargue la línea de tiempo real completa de la reunión sin experimentar pérdidas de estado o mostrar una duración de 00:00.
*   **F-2.6: Live API (Conversación por Voz en Tiempo Real)**: Integración de la tecnología de agentes de voz de tiempo real mediante el Live API de Google. Esto habilita un sparring de voz interactivo de ultra-baja latencia (subsegundo) para que el usuario pueda debatir, hacer preguntas o ensayar presentaciones sobre el tema de la reunión usando su propia voz nativa.

### 2.3 Síntesis de Conocimiento y Resumen Ejecutivo por Plantillas
*   **F-3.1: Resumen Ejecutivo Corporativo Adaptativo**: Redacción de un reporte estructurado de alto nivel en formato Markdown utilizando plantillas corporativas especializadas (ej. *Client Needs*, *Meeting Secretary*, *Detailed Summary*, *Training Summary*). Cada plantilla define su estructura, bloques destacados (blockquotes) e información relevante.
*   **F-3.2: Checklist de Accionables Dinámicos**: Extracción inteligente de tareas de seguimiento derivadas de la conversación. Cada tarea incluirá:
    *   Descripción clara y detallada de la acción.
    *   Prioridad/Importancia (Alta, Media, Baja) con códigos de colores discretos.
    *   Asignado sugerido (vinculado a los oradores identificados).
    *   Casilla interactiva para marcar el progreso de compleción en tiempo real sincronizado con el backend.

### 2.4 Visualización Espacial de Ideas (Mapa Mental Interactivo)
*   **F-4.1: Mapa Mental Interactivo (Lienzo SVG Nativo)**: Renderizado de un mapa conceptual jerárquico que parte del tema central de la reunión hacia las agendas y detalles secundarios de la discusión, eliminando la sobrecarga cognitiva.
*   **F-4.2: Navegación Fluida del Lienzo**: Capacidad de zoom, arrastre del mapa (drag-and-canvas) y despliegue/ocultamiento de nodos específicos para revelar detalles secundarios.
*   **F-4.3: Mapas Mentales Transversales (Bajo Demanda)**: Posibilidad de generar un mapa mental a nivel de Carpeta que relacione los temas de múltiples sesiones. Esta generación se realiza de manera explícita (On-Demand) con un botón, optimizando el consumo de la API.

### 2.5 Expansión de Conocimiento: Flashcards e Infografías de Impacto
*   **F-5.1: Flashcards Corporativas de Aprendizaje Activo**: Generación de tarjetas interactivas de "pregunta y respuesta" sobre términos de negocio, definiciones técnicas o compromisos clave para validación y asimilación rápida de la información.
*   **F-5.2: Infografías de Métricas y Flujos**: Generación de diagramas de flujos del negocio (pipelines discutidos en la reunión) y gráficos de métricas sugeridos, integrados de manera interactiva mediante SVG o Apache ECharts (distribución de voz, línea de tiempo del sentimiento).
*   **F-5.3: Analíticas Globales de Carpeta (Bajo Demanda)**: Generación explícita (On-Demand) de infografías y resúmenes ejecutivos que procesen todo el volumen de texto de las sesiones agrupadas en un Folder.

### 2.6 Chat de Asistencia Grounded (Knowledge Base & NotebookLM Corporativo)
*   **F-6.1: Agrupación Temática (Knowledge Base Folders)**: Capacidad para que los usuarios creen carpetas (Folders) y agrupen múltiples conversaciones relacionadas con un mismo cliente o proyecto. Estas carpetas actúan como una base de conocimiento profunda y acumulativa.
*   **F-6.2: AI Meeting Assistant (Contexto Global)**: Una interfaz de chat conversacional donde el usuario puede consultar información sobre una sesión aislada, o seleccionar una carpeta para interactuar con el contexto de *todas* las reuniones consolidadas, permitiendo análisis transversales de múltiples semanas de seguimiento.
*   **F-6.3: Búsqueda Semántica RAG (No-Hallucination Guard)**: Respuestas basadas estrictamente en la evidencia física del audio transcribido. La IA buscará en el índice vectorial de toda la carpeta y citará las sesiones exactas, nombres de documentos o marcas de tiempo correspondientes, bloqueando cualquier alucinación.
*   **F-6.4: Context Caching de Alta Eficiencia (90% Ahorro de Tokens)**: Carga inteligente en caché del contexto histórico y documentos extensos mediante el Context Caching API. Al realizar múltiples preguntas en ráfaga dentro del chat (`ChatBuddy`) sobre transcripciones de reuniones de varias horas o PDF corporativos de 1000 páginas, la caché evita re-procesar los archivos repetidamente, reduciendo la latencia de respuesta a nivel subsegundo y disminuyendo los costos de tokens del API de Gemini en un 90%.

### 2.7 Interfaz Limpia y Documento-Céntrica (Estilo PLAUD Web)
*   **F-7.1: Tablero Central de Foco Único (Single-Column Reader)**: Consolidación del espacio de trabajo en un canvas limpio y ancho, de columna única, optimizado para la lectura sin distracciones.
*   **F-7.2: Sidebar de Navegación y Archivo de Minutas**: Un menú izquierdo discreto que unifica perfiles, creación de temas/carpetas y el historial de sesiones con duración (ej. `1h 56m`) y fecha.
*   **F-7.3: Cajón de Utilidades Lateral (Drawer Derecho)**: El asistente de chat ("Ask AI"), los diagramas y el mapa mental se comportan como paneles laterales colapsables, activables mediante toggles estéticos en la cabecera del lector principal.

---

## 3. Requisitos No Funcionales (Non-Functional Requirements)

### 3.1 Seguridad y Privacidad Corporativa de Nivel Bancario
*   **N-1.1: Cumplimiento de Privacidad de Datos y No-Entrenamiento**: El procesamiento de voz, documentos y prompts debe realizarse exclusivamente a través de la infraestructura corporativa de Google Cloud (Vertex AI y Speech-to-Text V2), garantizando por contrato que los datos del cliente jamás se utilicen para entrenar modelos públicos de Google.
*   **N-1.2: Claves de Cifrado Administradas por el Cliente (CMEK)**: Soporte para cifrado de datos en reposo (Firestore, Cloud Storage) utilizando claves gestionadas en Cloud KMS.
*   **N-1.3: Residencia y Soberanía de Datos**: Capacidad para asegurar que el procesamiento de audio y el almacenamiento de datos residan exclusivamente en zonas geográficas específicas (ej. `us-central1` o `europe-west3`).
*   **N-1.4: Cifrado de Tránsito Obligatorio**: Cifrado obligatorio HTTPS / TLS 1.3 para toda transferencia de datos.

### 3.2 Usabilidad, Interfaz y Rendimiento de Clase Mundial
*   **N-2.1: Diseño Visual Premium de Alta Densidad**: Uso de una paleta de colores sofisticada para el usuario de negocios (fondos blancos limpios, gris pizarra, azul marino de acento, bordes finos de 1px) con tipografía cómoda (`text-[14.5px]`, `leading-relaxed`) para evitar el cansancio visual.
*   **N-2.2: Responsividad Móvil Total**: Optimización móvil nativa para que un directivo pueda iniciar grabaciones en salas físicas, escuchar audios y revisar accionables desde su dispositivo celular de manera fluida.
*   **N-2.3: Procesamiento Asíncrono de Gran Volumen**: Tolerancia técnica y asincronía real para procesar grabaciones muy largas (de 1 a 4 horas) en background. El usuario debe recibir retroalimentación visual del progreso, pudiendo salir de la pantalla o cerrar la pestaña sin interrumpir la transcripción en la nube.
