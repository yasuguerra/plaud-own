# Plan de Rediseño UI/UX: Interfaz Limpia y Documento-Céntrica (Estilo PLAUD Web)

Este documento detalla la investigación de la interfaz oficial de PLAUD Web y el plan de transformación visual para rediseñar nuestra plataforma [src/App.tsx](src/App.tsx), eliminando el ruido del tablero de 3 columnas para migrar hacia un diseño enfocado en la lectura, limpio, espaciado y sumamente elegante.

---

## 1. Análisis Visual de la Interfaz PLAUD Web (Referencia Compartida)

Al navegar y analizar la interfaz oficial de PLAUD Web en la consulta `"05-29 Consulta: Implementación de Celia Bot para Automatización y CRM"`, extraemos las siguientes directrices clave de diseño que la hacen tan atractiva y descansada para el usuario:

```
+-----------------------------------------------------------------------------------------+
|  [Σ] ESPACIO Yasu Guerra       | All files > 05-29 Consulta: Implementación Celia Bot   |
|  Personal Workspace            +--------------------------------------------------------+
|                                | [ TRANSCRIPT ]   [ SUMMARY (Active) ]                  |
|  + Add Audio                   +--------------------------------------------------------+
|                                |                                                        |
|  🔍 Search                     | 05-29 Consulta: Implementación de Celia Bot...         |
|  🏠 Home                       |                                                        |
|  ✨ Ask Plaud                  | Fecha y Hora: 2026-05-29 15:11:43                      |
|                                | Ubicación: [Insertar Ubicación]                        |
|  All files (18)                | Cliente: [Insertar Cliente / Julio]                    |
|  Unfiled (18)                  |                                                        |
|  Trash (13)                    | ## Resumen General                                     |
|                                | La serie de consultas se enfoca en la implementación   |
|  HISTORIAL                     | de "Selia Bot", una herramienta de automatización...   |
|  * 06-01 09:36 | 1h 46s         |                                                        |
|  * 05-29 15:11 | 1h 56m (Active)| ## Puntos de Dolor                                     |
|  * 05-28 16:33 | 1h 2m          | * **Ineficiencia en Prospección:** La prospección...   |
|                                |                                                        |
+-----------------------------------------------------------------------------------------+
```

### 1.1 Estructura y Jerarquía Espacial
1. **Consolidación de Sidebar Izquierdo**: El menú izquierdo se enfoca en la navegación de carpetas, accesos rápidos de la cuenta y el archivo completo de minutas con su fecha y duración (ej. `05-29 15:11 | 1h 56m 19s`). Es angosto, de fondo blanco o gris neutro ultra-tenue y con bordes finos.
2. **Tablero Central de Foco Único (Single-Column Document)**: En lugar de un mosaico saturado de tres columnas que compiten entre sí, el centro de la pantalla es un lienzo ancho dedicado exclusivamente al documento seleccionado (Resumen o Transcripción). Esto elimina la fatiga visual.
3. **Pestañas de Selección Claras**: Solo existen dos pestañas principales en el documento: **Summary** (Resumen) y **Transcript** (Transcripción). No hay barras de botones flotantes ni selectores de atajos redundantes.
4. **Módulos Colapsables / Drawer Derecho**: Las herramientas de apoyo secundarias, como el Asistente de IA (Ask Plaud) o el Mapa Mental, se comportan como paneles laterales (drawers) o ventanas modales flotantes que solo aparecen cuando el usuario las invoca, manteniendo la pantalla de lectura totalmente despejada.

### 1.2 Tipografía y Espaciado de Lectura (Letras Grandes)
* **Títulos Dominantes**: Los encabezados de sección (ej. `"Resumen General"`, `"Puntos de Dolor"`) son grandes (`text-xl` o `text-2xl`), en tipografía sans-serif de peso pesado (`font-bold` o `font-extrabold`) con color grafito oscuro (`text-slate-900`) para un contraste de alta calidad.
* **Márgenes de Sección Generosos**: Cada sección principal tiene un margen de separación vertical muy amplio (`mt-10` o `mt-12`), permitiendo que el documento "respire".
* **Interlineado Suave**: El texto de los párrafos utiliza un interlineado extra holgado (`leading-relaxed` o `leading-loose`) y un tamaño de letra cómodo (`text-sm` o `text-[14.5px]`), con colores gris neutro oscuro (`text-slate-600` o `text-slate-700`) que facilitan la concentración prolongada.
* **Listas Sangradas con Negritas de Contraste**: Los elementos de las listas (ej. `* **Producto/Solución:** ...`) tienen una sangría limpia (`pl-5`) y destacan el concepto clave en negrita, seguido del desarrollo en texto regular.
* **Bloques Destacados (Blockquotes)**: Para resúmenes e ideas especiales de la IA, se utilizan bloques con un fondo gris o azul ultra-claro, un borde izquierdo acentuado en color principal y tipografía cursiva o semibold.

---

## 2. Plan de Acción de Rediseño (The PLAUD-Style Transformation)

Para migrar nuestro prototipo actual hacia esta experiencia refinada y de clase mundial, ejecutaremos el siguiente plan en fases sobre la base del código actual en [src/App.tsx](src/App.tsx):

### Fase 1: Rediseño del Layout General (Bifurcación Limpia)
* **Acción**: Eliminar el grid actual de 3 columnas de la sección activa de la sesión (`col-span-12 lg:col-span-3`, `col-span-12 lg:col-span-5`, `col-span-12 lg:col-span-4`).
* **Nuevo Layout**: 
  - **Columna 1 (Ancho Fijo - 260px)**: Sidebar izquierdo que unifica la cuenta del usuario, la gestión de carpetas (crear, agrupar sesiones) y el historial cronológico con duración en minutos/segundos.
  - **Columna 2 (Flexible - Document-First Reader / Folder Dashboard)**: Un gran contenedor central con un ancho máximo de lectura óptimo (ej. `max-w-4xl mx-auto`).
    - *Si se selecciona una Sesión*: Muestra el **Resumen Ejecutivo** o la **Transcripción**, con pestañas minimalistas superiores ("Summary" | "Transcript").
    - *Si se selecciona una Carpeta*: Muestra un **Folder Dashboard**, con un resumen global, listado de sesiones contenidas, y botones de acción ("Generar Mapa Mental del Folder", "Generar Infografías") para desencadenar la carga bajo demanda (Lazy Generation).
  - **Columna 3 (Flotante / Toggle Drawer)**: El Asistente de IA (Chat Buddy) y las analíticas de sesión individual se comportarán como un panel lateral derecho deslizable (Drawer) o una pestaña lateral que se activa con un botón discreto ("Ask AI" / "Ver Analíticas").

### Fase 2: Aplicación del Estilo Tipográfico y Espaciado PLAUD
* **Acción**: Actualizar el componente de Markdown personalizado `FormatMarkdown` y el Timeline de Transcripción en [src/App.tsx](src/App.tsx) para usar la escala visual premium de PLAUD.
* **Estilos a Inyectar**:
  - Encabezados principales (`h2`): `text-xl md:text-2xl font-extrabold text-slate-900 mt-10 mb-4 pb-2 border-b border-slate-100 tracking-tight`.
  - Párrafos (`p`): `text-slate-600 text-sm md:text-[14.5px] leading-relaxed mb-5 font-normal`.
  - Listas (`li`): `pl-5 list-disc mb-3.5 text-slate-600 leading-relaxed text-sm`.
  - Timestamps de Transcripción: En lugar de cajas de colores fuertes, utilizaremos etiquetas de texto gris/azul tenue discretas, alineando el diálogo completo en una tipografía con excelente ritmo de lectura.

### Fase 3: Cabecera de Metadatos del Documento
* **Acción**: Introducir un bloque estructurado de metadatos al inicio de cada resumen (estilo PLAUD Web) que aporte valor organizativo inmediato al usuario corporativo.
* **Componente de Metadata**:
  ```tsx
  <div className="border-b border-slate-100 pb-6 mb-8 text-xs text-slate-450 text-slate-500 grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
    <div><strong className="text-slate-700">Fecha y Hora:</strong> {new Date(activeSession.createdAt).toLocaleString()}</div>
    <div><strong className="text-slate-700">Ubicación:</strong> [Llamada Virtual / Presencial]</div>
    <div><strong className="text-slate-700">Hablantes Detectados:</strong> {speakerMetrics.length} oradores</div>
  </div>
  ```

### Fase 4: Integración Simplificada de Herramientas de Inteligencia
* **Acción**: Organizar las funcionalidades complementarias como el Mapa Mental y las Infografías de forma que no compitan con el lector de documentos.
* **Esquema de Menú Lateral Derecho**:
  - Añadir un panel flotante en la derecha para el chat conversacional con la IA, con un botón flotante flotando sobre el borde para abrir/cerrar.
  - Colocar el Mapa Mental y las Infografías bajo un selector secundario o ventana modal de alta definición para que cuando el usuario desee explorar las analíticas o el mapa de ideas, se abran en pantalla completa sin saturar el espacio de lectura.

---

## 3. Guía de Implementación del Código CSS / Tailwind

Para lograr la concentración absoluta en la pantalla grande donde está el resumen, utilizaremos las siguientes clases utilitarias de Tailwind en el contenedor de lectura:

| Elemento | Clases de Tailwind Sugeridas | Propósito |
| :--- | :--- | :--- |
| **Contenedor Lector** | `max-w-3xl mx-auto py-10 px-8 bg-white shadow-3xs rounded-2xl` | Delimita el ancho para evitar líneas de texto demasiado largas (óptimo: 70-80 caracteres por línea). |
| **Cuerpo del Texto** | `font-sans text-[14.5px] text-slate-650 text-slate-700 leading-relaxed tracking-normal` | Letras grandes, espaciadas y color gris grafito descansado. |
| **Separador de Temas** | `border-t border-slate-100/80 my-8` | Líneas de división ultra-limpias para no cortar bruscamente las ideas. |
| **Citas / IA Sugerencias** | `bg-slate-50 border-l-4 border-indigo-600 p-5 rounded-r-xl my-6` | Destaca de forma elegante las sugerencias y conclusiones críticas. |

---

Este plan será la hoja de ruta definitiva para refinar de manera quirúrgica la experiencia de usuario y dotar a PLAUD Corporate Intelligence de una presencia visual sofisticada, moderna y sumamente profesional.
