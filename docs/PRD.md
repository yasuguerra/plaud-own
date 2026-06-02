# Product Requirements Document (PRD)
## Proyecto: PLAUD Corporate Intelligence (PLAUD-CI)

Este documento define los requisitos de producto para la transformación del prototipo "AI Study Buddy" en una plataforma corporativa avanzada de captura de ideas, transcripción con diarización, resúmenes ejecutivos y estructuración de conocimiento para reuniones corporativas y análisis de documentos.

---

## 1. Visión General del Producto

### 1.1 Declaración de la Visión
PLAUD-CI es una plataforma de software corporativa diseñada para capturar, transcribir y sintetizar de manera inteligente el contenido de reuniones presenciales y virtuales, llamadas y documentos de negocio. Inspirado en herramientas de hardware como PLAUD.AI y entornos de conocimiento como NotebookLM de Google, el producto permite transformar flujos de audio y video desorganizados en activos de información corporativa estructurada, accionable y visual.

### 1.2 Audiencia Objetivo
*   **Directivos y Ejecutivos de C-Level**: Para obtener resúmenes rápidos de decisiones estratégicas sin asistir a largas sesiones de alineación.
*   **Gestores de Proyectos (PMs)**: Para la generación automática de actas de reunión, listas de tareas pendientes (Action Items) y asignación de responsabilidades de manera estructurada.
*   **Equipos de Ingeniería y Producto**: Para registrar discusiones de diseño de arquitectura, lluvias de ideas de producto y decisiones técnicas de alta complejidad.
*   **Consultores y Analistas**: Para procesar de forma unificada grabaciones de entrevistas con clientes junto con contratos y reportes corporativos extensos.

---

## 2. Requisitos de Funcionalidades (Feature Requirements)

### 2.1 Captura e Ingesta Multimodal (Alta Capacidad)
*   **F-1.1: Grabación en Vivo**: Capacidad de registrar audio en tiempo real directamente desde el navegador con retroalimentación visual del volumen.
*   **F-1.2: Carga de Archivos de Audio y Video**: Soporte para formatos comunes (MP3, WAV, MP4, WebM, MOV, M4A) con un límite de alta capacidad de hasta 150 MB por archivo.
*   **F-1.3: Carga Segmentada (Chunked Upload)**: Soporte técnico robusto para fragmentar archivos grandes en porciones (ej. 3MB-4MB) antes del envío, asegurando estabilidad en conexiones inestables.
*   **F-1.4: Ingesta de Documentos Complementarios**: Habilidad para subir documentos contextuales (presentaciones, actas previas, contratos, agendas en PDF o Markdown) que actúen como "contexto de fondo" para calibrar las transcripciones de las reuniones.

### 2.2 Transcripción Fiel por Temas de Discusión y Diarización de Hablantes
*   **F-2.1: Diarización de Hablantes (Speaker Diarization)**: Reconocimiento e identificación automática de los diferentes interlocutores (ej. "Speaker A", "Speaker B", con la opción de renombrarlos a nombres reales de participantes en la interfaz).
*   **F-2.2: Transcripción Estructurada por Bloques de Discusión**: El texto transcrito no debe ser un bloque de texto plano, sino que debe organizarse cronológicamente en temas o agendas de discusión bien diferenciados.
*   **F-2.3: Marcas de Tiempo Precisas**: Visualización del minuto y segundo exacto en un lado de la interfaz para cada intervención de los hablantes, lo que permite la navegación rápida al audio original.

### 2.3 Síntesis de Conocimiento y Resumen Ejecutivo
*   **F-3.1: Resumen Ejecutivo Corporativo**: Redacción de un reporte estructurado de alto nivel en formato Markdown, incluyendo:
    *   **Contexto de la reunión**: Fecha, título, participantes sugeridos y objetivo principal.
    *   **Temas principales discutidos**: Sinopsis ejecutiva de los puntos clave.
    *   **Acuerdos y Decisiones Críticas**: Listado preciso de las conclusiones formales alcanzadas.
*   **F-3.2: Checklist de Accionables Dinámicos**: Extracción de tareas de seguimiento derivadas de la conversación. Cada tarea incluirá:
    *   Descripción clara de la acción.
    *   Prioridad/Importancia (Alta, Media, Baja).
    *   Asignado sugerido (vinculado a los Speakers identificados).
    *   Casilla interactiva para marcar el progreso de compleción en tiempo real.

### 2.4 Visualización Espacial de Ideas (Mapa Mental Estilo NotebookLM)
*   **F-4.1: Mapa Mental Interactivo (Lienzo SVG)**: Renderizado de un mapa conceptual jerárquico que parte del tema central de la reunión hacia los temas de agenda y detalles específicos de la discusión.
*   **F-4.2: Navegación de Nodos**: Capacidad para hacer zoom, arrastrar el mapa y hacer clic en nodos específicos para desplegar información oculta o detalles secundarios.

### 2.5 Expansión de Conocimiento: Flashcards e Infografías
*   **F-5.1: Flashcards Corporativas**: Generación de tarjetas interactivas de "pregunta y respuesta" sobre términos de negocio, definiciones técnicas o compromisos de la reunión para validar la retención o repasar conceptos clave.
*   **F-5.2: Infografías de Métricas y Flujos**: Generación de diagramas de flujos del negocio (diagramas de flujo de procesos o pipelines discutidos en la reunión) y gráficos de métricas sugeridos, integrados de manera interactiva mediante SVG o la integración de especificaciones gráficas en la pantalla.

### 2.6 Chat de Asistencia Grounded (Basado en Hechos)
*   **F-6.1: AI Meeting Assistant**: Una interfaz de chat conversacional ("Chat Buddy") donde el usuario puede realizar preguntas sobre la reunión ("¿Por qué decidimos retrasar el lanzamiento?" o "¿Quién se comprometió a entregar el presupuesto?").
*   **F-6.2: Restricción al Contexto (No-Hallucination Guard)**: La IA debe responder basándose exclusivamente en el audio transcrito y en los documentos complementarios cargados, citando las secciones o timestamps de donde se extrajo la respuesta.

---

## 3. Requisitos No Funcionales (Non-Functional Requirements)

### 3.1 Seguridad y Privacidad Corporativa
*   **N-1.1: Cumplimiento de Privacidad de Datos**: Al ser una herramienta corporativa, los datos del audio y las transcripciones deben procesarse de forma segura. Se utilizarán endpoints empresariales de Google Cloud que garantizan que el contenido del usuario no se utiliza para entrenar modelos públicos.
*   **N-1.2: Cifrado en Tránsito y Reposo**: Cifrado obligatorio HTTPS para toda la transferencia de datos y almacenamiento seguro de datos del backend.

### 3.2 Usabilidad e Interfaz
*   **N-2.1: Soporte de Modo Oscuro y Profesional**: Diseño limpio de baja fricción enfocado en el descanso visual del usuario corporativo corporativo (gama de colores gris pizarra, azul marino y cobalto).
*   **N-2.2: Responsividad Móvil**: Permite el registro de audios desde dispositivos móviles en salas de reuniones físicas de manera fluida.
