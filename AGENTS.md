# AGENTS.md — Reglas de trabajo para el agente de desarrollo

## Misión y regla absoluta de inicio desde cero

Construí una aplicación web pequeña, elegante y mobile-first para gestionar turnos de depilación. La especificación funcional completa está en [`docs/spec-turnos.md`](docs/spec-turnos.md); leela antes de implementar y usala como fuente principal de verdad.

**ESTE PROYECTO ES COMPLETAMENTE NUEVO. No reutilices nada de aplicaciones, prototipos o repositorios anteriores.** No busques ni copies código de otros proyectos, carpetas, ramas, commits, repositorios remotos ni conversaciones anteriores. No intentes adaptar una aplicación previa ni preservar su arquitectura, componentes, estilos, dependencias o configuración.

Usá el workspace actual como destino para crear el producto desde cero. Los únicos documentos de referencia del producto son `AGENTS.md` y `docs/spec-turnos.md`; creá una base de aplicación nueva y elegí libremente la implementación que cumpla la especificación. No conectes automáticamente un remoto GitHub anterior ni importes historial Git. La inicialización de Git y la elección del repositorio remoto deben tratarse como pasos separados de la implementación, documentados para el propietario si hacen falta.

No borres indiscriminadamente archivos ajenos al proyecto. Sin embargo, cualquier código de una versión anterior no es una base que debas reutilizar: construí el producto nuevo independientemente de él.

## Reglas de oro

1. **Prioridad absoluta: experiencia mobile-first.** Diseñá primero para un teléfono. Después adaptá la interfaz a pantallas mayores. Evitá scroll horizontal, controles diminutos y formularios incómodos en móvil.
2. **La especificación manda sobre las suposiciones.** No inventes requisitos de negocio. Cuando falte un dato no crítico, elegí una opción sencilla, centralizá su configuración y documentá que es un valor provisional.
3. **Diseño elegante y delicado.** Usá la paleta y las pautas visuales de `docs/spec-turnos.md`. Evitá una estética genérica de dashboard, decoraciones excesivas o una interfaz infantil.
4. **Calendario hecho a medida.** La interfaz del calendario y la lista de horarios deben construirse específicamente para este producto; no incorpores una biblioteca pesada de calendarios ya armados. Podés usar utilidades de fechas pequeñas si aportan valor.
5. **Una solución simple, no una plataforma.** El uso esperado es bajo y el único dato de negocio que debe persistir es el relacionado con las fechas de atención y los turnos necesarios para operar. No agregues perfiles de clientes, pagos, mensajería, analíticas, CRM ni funcionalidades que no estén solicitadas.
6. **Backend mínimo, completo y desplegable.** Implementá la persistencia real y la autorización necesaria para que el producto funcione online. Preferí servicios administrados y planes gratuitos adecuados al uso esperado, después de verificar sus límites actuales. No construyas infraestructura propia si un servicio sencillo resuelve el problema.
7. **La seguridad no puede depender de esconder un botón.** La interfaz puede mostrar un acceso discreto de administración, pero cada operación de edición/borrado y cualquier lectura de datos privados deben estar protegidas también en el servidor o en las políticas de acceso de la base de datos.
8. **Privacidad pública estricta.** En la vista pública se muestran únicamente el horario y las iniciales de la persona que reservó. Nunca exponer el nombre completo, teléfono, edad ni zonas seleccionadas en las respuestas públicas, el HTML, los logs, los errores o las consultas accesibles sin autenticación.
9. **No exponer secretos en el frontend.** Ninguna contraseña, clave privada, token de administración o clave privilegiada puede formar parte del bundle del navegador, del repositorio o de variables públicas como las que Vite incorpora al cliente. Usá variables de entorno del servidor y un archivo `.env.example` sin secretos reales.
10. **Validación y concurrencia en el servidor.** La disponibilidad mostrada en pantalla es orientativa hasta que se confirma la reserva. Al confirmar, el backend debe comprobar y registrar el turno de forma atómica, impidiendo dos reservas para la misma fecha y hora.
11. **Interfaz en español rioplatense.** Todo el texto visible debe estar en español, con fechas argentinas y horario de 24 horas. Usá `America/Argentina/Buenos_Aires` cuando sea pertinente. No mezcles inglés técnico en los textos de cara al cliente.
12. **Accesibilidad sin sacrificar la estética.** Usá etiquetas de formulario, estados claros, navegación por teclado, foco visible en rosa oscuro, contraste legible, objetivos táctiles de alrededor de 44 px y respeto por `prefers-reduced-motion`.
13. **No bloquees el avance por preguntas menores.** Tomá decisiones razonables y continuá. Centralizá los valores provisionales (por ejemplo, la lista de zonas) para que sean fáciles de modificar. Documentá qué requiere configuración manual o credenciales del propietario.
14. **No simules que algo se guardó.** Los datos de prueba son válidos únicamente para desarrollo. En producción, una confirmación de éxito solo puede aparecer después de que la persistencia real responda correctamente.
15. **Verificá el resultado.** Ejecutá las comprobaciones y el build disponibles. Probá los recorridos principales, los errores de validación, la reserva duplicada, el modo administrador y la protección de datos. Corregí los errores que encuentres antes de terminar.
16. **Entregá instrucciones operativas.** Actualizá o creá un `README.md` breve con cómo ejecutar localmente, configurar las variables, preparar el proveedor de datos/autenticación y desplegar. Incluí migraciones o scripts de inicialización reproducibles cuando corresponda.

## Libertad de implementación

Tenés libertad para elegir la organización del código, el manejo de estado, la estrategia de persistencia y la herramienta de autenticación que mejor cumplan la especificación. Como punto de partida, una SPA React/Vite desplegada en Netlify y un servicio administrado como Supabase son opciones razonables, pero no son una obligación si existe una alternativa más simple que cumpla los mismos requisitos.

No uses la libertad técnica para ampliar el alcance: la aplicación debe seguir siendo pequeña, fácil de mantener y sencilla de desplegar.

## Condiciones para dar la tarea por terminada

- El flujo público permite consultar disponibilidad y reservar un turno real.
- No se pueden reservar fechas u horarios no habilitados ni duplicar una reserva.
- Una reserva exitosa aparece inmediatamente como ocupada en la vista pública.
- El público solo ve iniciales; los datos personales completos quedan restringidos al administrador.
- El acceso de administración está autenticado y permite gestionar fechas, horarios y reservas.
- La interfaz funciona en móvil y escritorio, mantiene la identidad visual solicitada y presenta estados de carga, error, vacío y éxito.
- Hay instrucciones para configuración y despliegue; no quedan secretos en el repositorio.
