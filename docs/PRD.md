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

### 2.5 Expansión de Conocimiento: Flashcards e Infografías de Impacto
*   **F-5.1: Flashcards Corporativas de Aprendizaje Activo**: Generación de tarjetas interactivas de "pregunta y respuesta" sobre términos de negocio, definiciones técnicas o compromisos clave para validación y asimilación rápida de la información.
*   **F-5.2: Infografías de Métricas y Flujos**: Generación de diagramas de flujos del negocio (pipelines discutidos en la reunión) y gráficos de métricas sugeridos, integrados de manera interactiva mediante SVG o Apache ECharts (distribución de voz, línea de tiempo del sentimiento).

### 2.6 Chat de Asistencia Grounded (Basado en Hechos - NotebookLM Corporativo)
*   **F-6.1: AI Meeting Assistant**: Una interfaz de chat conversacional integrada en la que el usuario puede realizar preguntas en lenguaje natural sobre una sola sesión o sobre un folder entero de reuniones.
*   **F-6.2: Búsqueda Semántica RAG (No-Hallucination Guard)**: Respuestas basadas estrictamente en la evidencia física del audio transcribido y de los documentos complementarios indexados mediante búsqueda vectorial. La IA debe citar las secciones, nombres de documentos o marcas de tiempo correspondientes de donde se extrajo la respuesta, bloqueando cualquier alucinación.

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
