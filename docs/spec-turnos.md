# Especificación funcional y técnica — Turnos de depilación

## 1. Resumen del producto

Aplicación web **nueva e independiente de cualquier proyecto o prototipo anterior**, mobile-first, para que clientes consulten las fechas de atención de un servicio de depilación, vean horarios libres u ocupados y reserven un turno sin aprobación manual. El negocio suele habilitar **una fecha por mes y, ocasionalmente, dos fechas durante un mismo fin de semana**.

### Instrucción de greenfield obligatoria

- Crear la aplicación desde cero en el workspace actual.
- No reutilizar, importar, copiar ni adaptar código, componentes, estilos, configuración, dependencias ni arquitectura de ninguna versión previa.
- No usar otro repositorio, rama, historial Git o remoto como base del producto.
- Tomar `AGENTS.md` y este documento como las únicas especificaciones del proyecto. Resolver la implementación sin depender de conversaciones anteriores ni de archivos de aplicaciones previas.
- No es obligatorio conservar la estructura de carpetas de ningún proyecto existente. Elegir una estructura nueva y coherente con la solución seleccionada.
- La creación de un repositorio remoto y el despliegue en cuentas externas son tareas de configuración separadas; no vincular automáticamente un remoto antiguo.

La aplicación debe ser simple y económica de operar. Solo hace falta persistir las fechas de atención configuradas y los turnos asociados. No se necesita un sistema de usuarios para clientes, cobros, notificaciones, CRM ni un panel de gestión complejo.

### Objetivo principal

Permitir que una persona encuentre un horario libre, informe sus datos, verifique la información y confirme la reserva. Una vez confirmada, la reserva queda guardada y el horario se muestra inmediatamente como ocupado para cualquier visitante.

### Alcance

- Frontend completo y adaptable a móviles.
- Calendario mensual propio, con fechas específicas de atención.
- Horarios de 30 minutos.
- Formulario, revisión y confirmación de reserva.
- Visualización pública de horarios ocupados con iniciales únicamente.
- Acceso de administración discreto, autenticado, integrado en la vista de turnos.
- Gestión administrativa de fechas, rangos horarios y turnos.
- Persistencia real y configuración lista para desplegar en un hosting económico/gratuito compatible.

### Fuera de alcance

- Cuenta o registro para clientes.
- Pagos, señas o facturación.
- Confirmación manual de reservas.
- SMS, WhatsApp automático, correo transaccional o recordatorios.
- Catálogo con precios o cálculo de duración por tratamiento.
- Múltiples empleados, sucursales o recursos simultáneos.
- Roles administrativos complejos o un dashboard separado con métricas.

## 2. Experiencia, diseño y estilo

### Dirección visual

**Elegante y delicada**, con aire de spa: bastante espacio en blanco, jerarquía tipográfica clara, detalles sutiles y controles cómodos. Evitar el aspecto de plantilla administrativa genérica, adornos excesivos, gradientes llamativos y elementos infantiles.

Paleta de referencia:

| Uso | Color | Hex |
|---|---|---|
| Fondo rosa suave / secciones | Rosa muy claro | `#FFE4EC` |
| Superficies o detalles secundarios | Rosa medio | `#F7B5C9` |
| Acciones principales, títulos destacados y foco | Rosa oscuro | `#C12653` |
| Texto principal | Tono oscuro neutro con contraste suficiente | Elegir según el sistema visual |
| Superficies de lectura | Blanco o casi blanco | Elegir según el sistema visual |

La paleta es una referencia, no obliga a usar rosa medio como fondo de todos los componentes. Priorizá legibilidad y contraste.

### Reglas visuales

- Diseñar primero para un viewport móvil estrecho; adaptar luego a escritorio.
- Usar una composición simple, tipografía refinada para títulos y tipografía muy legible para formularios y horarios.
- Botones principales claros, con tamaño táctil generoso y estados hover/focus/disabled visibles.
- Bordes y radios suaves; sombras únicamente si ayudan a separar niveles.
- Transiciones discretas entre pantallas, sin bloquear la interacción y respetando `prefers-reduced-motion`.
- Estados de carga, error, éxito, sin resultados y horario ocupado claramente diferenciados.
- No comunicar disponibilidad exclusivamente con color: acompañarla con texto o iconografía accesible.
- Formularios fáciles de completar con teclado móvil adecuado para edad y teléfono.
- No hace falta depender de imágenes. El diseño puede resolverse con tipografía, espacio, color y componentes.
- No inventar nombre comercial ni logo: emplear un título neutral y fácil de configurar hasta que se proporcione la marca.

### Idioma y fechas

- Toda la interfaz pública en español argentino.
- Fechas en formato local natural, por ejemplo, `viernes 23 de octubre`.
- Horas en formato de 24 horas (`08:00`, `18:30`), nunca AM/PM.
- La semana empieza el lunes.
- Zona horaria de negocio: `America/Argentina/Buenos_Aires`.

## 3. Recorridos y pantallas

### 3.1 Inicio

Pantalla de bienvenida con un título breve, texto auxiliar opcional y dos acciones claramente diferenciadas:

1. **Crear turno**: inicia el recorrido de reserva en el calendario, con selección de fecha y horario habilitada.
2. **Ver calendario**: abre la vista pública de consulta. Permite explorar las fechas de atención y revisar horarios libres y ocupados, pero no entra directamente al formulario. El usuario puede volver a Inicio y elegir `Crear turno` para reservar.

Debe existir también un enlace o botón de poca prominencia visual para **Administración**. Puede estar en el pie de página o en una zona secundaria; no debe competir con las acciones principales. No debe tratarse como una medida de seguridad por sí mismo.

### 3.2 Calendario y horarios

Es una única experiencia reutilizable, con dos modos:

- **Consulta pública**: el visitante puede cambiar de mes, elegir una fecha habilitada y ver la lista de horarios y las iniciales de quienes ya reservaron. No puede editar ni borrar turnos.
- **Reserva**: el cliente elige una fecha habilitada y un horario libre. Una vez seleccionados ambos, continúa al formulario.
- **Administración autenticada**: la misma vista incorpora acciones de gestión de fechas, rangos horarios y reservas. No construir un panel de administración separado salvo que la implementación lo necesite por una razón clara.

El calendario debe estar construido a medida con componentes y CSS propios. No utilizar una biblioteca de calendario visual ya resuelto.

Comportamiento esperado:

- Mostrar el mes y año visibles, controles de mes anterior/siguiente y una cuadrícula con lunes como primer día de la semana.
- Marcar visualmente las fechas de atención configuradas por el administrador.
- Las fechas sin evento son no disponibles para reservar. No inferir que todos los viernes, sábados o domingos son fechas de atención.
- No permitir reservar en fechas pasadas.
- Al elegir una fecha configurada, mostrar los horarios disponibles y ocupados de ese día.
- Los turnos se generan en intervalos fijos de 30 minutos dentro del rango horario de esa fecha.
- Un horario ocupado no puede seleccionarse para una nueva reserva.
- Los horarios ocupados muestran **solo iniciales** de la persona. Ejemplos: `S.` para `Susana`; `M. P.` para `María Pérez`. Nunca mostrar el nombre completo ni el teléfono en la interfaz pública.
- En la vista pública de consulta, debe quedar claro que se está consultando la agenda. La reserva se inicia desde `Crear turno`.
- En modo reserva, indicar visualmente fecha y horario seleccionados y permitir volver al calendario para cambiarlos.

### 3.3 Formulario de reserva

Se muestra después de elegir fecha y horario. Campos:

1. **Nombre y apellido** — obligatorio.
2. **Edad** — obligatoria, numérica y entera. No establecer una edad mínima comercial inventada; validar que el dato sea un entero positivo.
3. **Zonas a depilar** — selección múltiple; elegir al menos una.
4. **Teléfono** — obligatorio, con validación tolerante a formatos habituales argentinos (`+`, espacios, guiones y paréntesis permitidos cuando corresponda).

Los nombres definitivos de las zonas todavía no fueron proporcionados. Implementar la lista como una configuración única y fácil de editar. Si se necesitan valores para completar y probar el flujo, señalarlos claramente como **ejemplos provisionales**; no presentarlos como catálogo oficial del negocio.

Requisitos del formulario:

- Mostrar de forma persistente qué fecha y horario se están reservando.
- Validar los campos obligatorios y explicar el error junto al campo correspondiente.
- Conservar los datos ingresados si el usuario vuelve al calendario o avanza a la verificación.
- No guardar el turno todavía al pasar del formulario a la verificación.

### 3.4 Verificación

Antes de confirmar, mostrar un resumen legible de:

- Nombre y apellido.
- Edad.
- Zonas seleccionadas.
- Teléfono.
- Fecha y horario.

Acciones:

- **Modificar datos**: vuelve al formulario conservando lo ingresado.
- **Cambiar fecha u horario**: vuelve al calendario conservando el resto de los datos.
- **Confirmar turno**: intenta registrar la reserva de forma real.

No usar un botón genérico que oculte la acción; la acción final debe identificarse claramente como confirmación de reserva.

### 3.5 Confirmación

Solo mostrar éxito cuando el backend confirme que la reserva quedó guardada. La pantalla debe indicar que el turno fue confirmado e incluir fecha, horario y un resumen útil, sin necesidad de mostrar datos sensibles de más.

Si el horario dejó de estar disponible entre la selección y la confirmación, no crear una reserva duplicada ni mostrar éxito. Informar que el horario acaba de ocuparse, conservar los datos del formulario y permitir volver al calendario para elegir otro horario.

## 4. Reglas del negocio

### 4.1 Fechas de atención

- La atención ocurre en fin de semana: viernes, sábado o domingo.
- El negocio suele habilitar una fecha al mes y, ocasionalmente, dos fechas en un mismo fin de semana.
- El administrador define explícitamente las fechas disponibles. El calendario público no debe inferir fechas automáticamente por ser fin de semana.
- El administrador puede crear, editar, activar/desactivar y eliminar fechas de atención.
- Cada fecha debe tener un horario de apertura y cierre propio, con valores por defecto de **08:00 a 18:00**.
- La ventana de atención configurable nunca puede exceder los límites **06:00–22:00**. El inicio debe ser anterior al cierre.
- La interfaz administrativa debe validar que una fecha nueva sea viernes, sábado o domingo y que no sea pasada.
- Si una fecha contiene reservas y se intenta eliminarla o cambiar el horario de forma que invalide turnos ya creados, advertirlo y exigir que el administrador resuelva los turnos afectados. Nunca borrar o dejar huérfanas reservas silenciosamente.

### 4.2 Generación de horarios

- Duración fija inicial: **30 minutos por turno**, independientemente de las zonas seleccionadas.
- Crear horarios consecutivos desde la hora de apertura hasta la hora de cierre; el último turno debe terminar como máximo a la hora de cierre.
- Ejemplo con apertura `08:00` y cierre `10:00`: `08:00`, `08:30`, `09:00` y `09:30`.
- Si el rango no puede dividirse en bloques completos de 30 minutos, no crear un turno que exceda el cierre. Idealmente, exigir apertura y cierre alineados a intervalos de media hora.
- El esquema no requiere una fila de base de datos por cada horario libre: pueden generarse a partir de la fecha configurada y combinarse con los turnos reservados.
- Una sola reserva por combinación de fecha y hora de inicio.

### 4.3 Reservas

- La confirmación es inmediata; no existe aprobación manual.
- Cualquier visitante puede ver las fechas, los horarios libres y los ocupados, y puede crear una nueva reserva siguiendo el flujo público.
- Los visitantes no pueden editar ni cancelar reservas existentes.
- Solo el administrador autenticado puede editar o eliminar reservas existentes.
- Una cancelación hecha por el administrador libera el horario.
- La validación de disponibilidad debe hacerse nuevamente en el backend al confirmar, no solo en React.
- La base de datos debe impedir duplicados para la misma fecha y hora, incluso si llegan dos solicitudes simultáneas.

### 4.4 Datos públicos y privacidad

**Público:** fecha de atención, horario, estado disponible/ocupado e iniciales de la persona que reservó.

**Privado (solo administración):** nombre completo, edad, zonas seleccionadas y teléfono.

- No enviar datos privados al cliente para luego esconderlos con CSS o condicionales de React.
- La respuesta de la consulta pública debe incluir solo los datos mínimos necesarios.
- No registrar teléfono, nombre completo ni otros datos personales en logs innecesarios.
- El usuario público no dispone de una función para editar o borrar turnos.

## 5. Administración

### Acceso

- Agregar un botón o enlace secundario `Administración` discreto.
- Al activarlo, mostrar un formulario/modal de inicio de sesión con usuario y contraseña.
- Debe existir un único usuario administrador para el MVP. No hay registro público de administradores.
- Una autenticación válida habilita el **modo administrador dentro de la vista de turnos**. No hace falta crear un dashboard grande o independiente.
- Debe existir una forma clara de cerrar sesión/salir del modo administrador.
- Ni el nombre de usuario ni la contraseña real pueden estar hardcodeados en el frontend o guardados en Git.
- La autenticación y autorización deben verificarse en el servidor o mediante un proveedor de autenticación con políticas de acceso correctas. El modo visual no concede permisos por sí mismo.

### Funciones de administración

Dentro de la vista de turnos, el administrador puede:

- Crear una nueva fecha de atención y fijar apertura/cierre.
- Modificar la fecha o el rango horario de una fecha existente, con protección ante reservas afectadas.
- Activar/desactivar o eliminar una fecha, resolviendo primero los turnos relacionados cuando corresponda.
- Consultar los datos completos de cada reserva.
- Editar los datos de una reserva y/o reubicarla en un horario libre.
- Eliminar/cancelar una reserva, liberando el horario.
- Ver una confirmación antes de acciones destructivas.

No agregar estadísticas, gestión de clientes, exportaciones ni permisos múltiples salvo necesidad real.

## 6. Arquitectura técnica recomendada

El agente puede modificar esta propuesta si demuestra que otra solución reduce la complejidad sin comprometer los requisitos.

### Enfoque preferido

- **Frontend:** React + Vite, pensado como SPA responsive.
- **Hosting:** Netlify u otro hosting gratuito/low-cost compatible con la solución elegida.
- **Persistencia:** base de datos SQL administrada, por ejemplo PostgreSQL a través de Supabase, u otra opción equivalente adecuada al uso bajo.
- **Autenticación administrativa:** funcionalidad de autenticación administrada o una sesión verificada del lado servidor.
- **Backend:** funciones serverless, RPCs seguras o el mecanismo más pequeño que permita validar reservas, proteger datos privados y aplicar permisos. Evitar mantener un servidor dedicado si no es necesario.

Una combinación como Netlify + Supabase es una opción razonable: hosting estático para React y base de datos/autenticación administradas. Antes de comprometerse con un proveedor, verificar la documentación y los límites actuales del plan gratuito; no asumir que el precio o los límites nunca cambian.

### Límites de seguridad obligatorios

- Proteger todas las operaciones de edición y borrado con autenticación y autorización del lado servidor/base de datos.
- Conceder al visitante público únicamente acceso a la información pública y al flujo validado de creación de reservas.
- Exponer para lectura pública una vista, consulta o endpoint que solo devuelva fechas, horas, estado e iniciales. No conceder lectura indiscriminada de la tabla que contiene datos personales.
- La creación de una reserva debe pasar por una operación segura que valide los datos, que la fecha esté habilitada, que el slot pertenezca a la grilla de 30 minutos y que aún esté libre.
- Usar una restricción única o mecanismo transaccional equivalente para evitar duplicados concurrentes.
- Mantener claves privilegiadas, secretos y credenciales únicamente en el servidor/proveedor, nunca en el código del navegador.
- Si se elige Supabase, usar RLS y grants explícitos y no exponer la clave `service_role` o claves secretas al frontend. Una política RLS no reemplaza la necesidad de limitar las columnas/objetos que puede consultar el público.
- No depender de que el botón de administración esté oculto o sea poco visible.
- No permitir que un visitante edite o elimine una reserva cambiando manualmente las peticiones HTTP.

Documentación oficial de referencia, si se usa ese stack:

- [Supabase — Securing your data](https://supabase.com/docs/guides/database/secure-data)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Netlify — Functions](https://docs.netlify.com/build/functions/get-started/)
- [Netlify — Environment variables for Functions](https://docs.netlify.com/build/functions/environment-variables/)

### Modelo de datos conceptual

No es obligatorio conservar estos nombres exactos; sí las reglas de integridad y privacidad.

**Fecha de atención / evento**

- Identificador.
- Fecha local de atención (`DATE`, no un timestamp ambiguo para representar un día local).
- Hora de apertura.
- Hora de cierre.
- Estado habilitado/activo.
- Timestamps de creación/actualización si son útiles.

**Reserva**

- Identificador.
- Fecha de atención y hora de inicio del turno (o referencia a la fecha de atención más hora de inicio).
- Nombre completo.
- Edad.
- Zonas seleccionadas.
- Teléfono.
- Fecha/hora de creación.

La combinación fecha + hora de inicio debe ser única entre reservas activas. La interfaz puede calcular las iniciales a partir del nombre completo, preferentemente en el backend o en una respuesta pública segura; no se debe enviar el nombre completo al navegador público para calcularlas allí.

Al representar turnos, guardar la fecha como fecha local y la hora del turno como hora local del negocio. Evitar convertir un día de calendario a UTC de forma que cambie la fecha visible. Usar `America/Argentina/Buenos_Aires` para las operaciones en las que la zona horaria sea relevante.

### Configuración y despliegue

- Incluir `.env.example` con nombres y descripciones de las variables requeridas, sin valores secretos reales.
- Incluir migraciones SQL o un script reproducible para crear las estructuras, restricciones, vistas/funciones y políticas requeridas.
- Documentar cómo crear/configurar el proyecto del proveedor de persistencia y cómo crear el usuario administrador.
- Documentar los comandos de instalación, desarrollo, build y deploy.
- Documentar claramente qué pasos requieren intervención manual del propietario (crear proyecto, definir credenciales, cargar variables y vincular el repositorio con el hosting).
- No afirmar que el sitio ya quedó desplegado en una cuenta externa si el agente no realizó efectivamente esa operación.

## 7. Historias de usuario y criterios de aceptación

### HU-01 — Consultar el calendario

**Como visitante**, quiero ver las fechas habilitadas y los horarios libres/ocupados para conocer la disponibilidad.

Criterios:

- [ ] Puedo abrir `Ver calendario` desde Inicio.
- [ ] Puedo cambiar de mes y elegir una fecha de atención habilitada.
- [ ] Veo horarios de 30 minutos desde apertura hasta cierre.
- [ ] Los horarios ocupados se identifican como ocupados y muestran solo iniciales.
- [ ] No veo nombres completos, edad, teléfono ni zonas de otras personas.
- [ ] Las fechas sin evento y las fechas pasadas no se pueden reservar.

### HU-02 — Crear una reserva

**Como cliente**, quiero reservar un horario libre sin tener que esperar una aprobación.

Criterios:

- [ ] `Crear turno` inicia el flujo con selección activa de fecha y horario.
- [ ] No puedo seleccionar un horario ocupado.
- [ ] Completo nombre y apellido, edad, una o más zonas y teléfono.
- [ ] Puedo revisar toda mi información antes de confirmar.
- [ ] Puedo volver a editar datos o cambiar el horario sin perder innecesariamente la información cargada.
- [ ] Al confirmar, la reserva se guarda realmente y aparece la pantalla de éxito.
- [ ] La reserva aparece inmediatamente como ocupada en el calendario público.
- [ ] Si el horario se ocupa antes de confirmar, recibo un mensaje claro y puedo elegir otro sin volver a empezar.

### HU-03 — Evitar reservas duplicadas

**Como sistema**, debo impedir que dos clientes confirmen el mismo horario.

Criterios:

- [ ] La disponibilidad se vuelve a validar en la operación de confirmación del lado servidor.
- [ ] La persistencia impone unicidad para fecha + hora de inicio.
- [ ] Dos intentos concurrentes no pueden crear dos turnos para el mismo horario.
- [ ] El intento que no consigue el horario recibe un error recuperable y comprensible.

### HU-04 — Iniciar sesión como administrador

**Como responsable**, quiero acceder a opciones de gestión sin exponerlas a visitantes.

Criterios:

- [ ] Hay un acceso discreto de `Administración`.
- [ ] El acceso solicita usuario y contraseña.
- [ ] No existe registro público de administradores.
- [ ] Una sesión inválida no puede ejecutar acciones administrativas.
- [ ] El botón discreto no es la única protección: el backend/base de datos valida los permisos.
- [ ] Puedo cerrar la sesión de administración.

### HU-05 — Administrar fechas y horarios

**Como administrador**, quiero configurar las fechas en las que se atenderá y el rango horario de cada fecha.

Criterios:

- [ ] Puedo crear y editar fechas de atención de viernes, sábado o domingo.
- [ ] Puedo definir la hora de apertura y cierre para cada fecha.
- [ ] Los valores iniciales sugeridos son `08:00` a `18:00`.
- [ ] No se permite salir de la ventana configurable `06:00`–`22:00`.
- [ ] La grilla de turnos se actualiza en función de la configuración.
- [ ] Si una modificación afecta reservas existentes, la interfaz explica el problema y exige una resolución explícita.
- [ ] Puedo desactivar/eliminar una fecha sin perder reservas de forma silenciosa.

### HU-06 — Administrar reservas

**Como administrador**, quiero ver y gestionar turnos existentes.

Criterios:

- [ ] Puedo acceder a los datos completos de una reserva desde el modo administrador.
- [ ] Puedo editar la información o reubicar el turno a un horario libre.
- [ ] Puedo eliminar/cancelar una reserva tras una confirmación.
- [ ] Al cancelar, el horario vuelve a estar disponible.
- [ ] Un visitante normal no puede editar, reubicar ni borrar reservas.

### HU-07 — Usar la aplicación desde un teléfono

**Como cliente móvil**, quiero completar el proceso de forma clara y cómoda desde el navegador del teléfono.

Criterios:

- [ ] La interfaz no tiene scroll horizontal en anchos de móvil habituales.
- [ ] Botones, días, horarios e inputs son fáciles de tocar.
- [ ] Los textos no se cortan y el calendario conserva su legibilidad en pantallas estrechas.
- [ ] El foco por teclado es visible y los errores del formulario se entienden.
- [ ] Las animaciones son sutiles y se reducen cuando el dispositivo solicita `prefers-reduced-motion`.

## 8. Checklist de implementación paso a paso

### Fase 1 — Base y dirección visual

- [ ] Leer esta especificación y `AGENTS.md` antes de implementar.
- [ ] Crear una aplicación nueva desde cero en el workspace actual, sin reutilizar código, archivos, dependencias, configuración, ramas, historial o remotos de ningún proyecto anterior.
- [ ] Confirmar que instalación, ejecución local y build funcionan.
- [ ] Definir tokens de color, tipografía, espaciado, radios, botones, inputs y estados de foco.
- [ ] Crear el layout mobile-first y validar que se vea bien en una pantalla angosta.
- [ ] Implementar las transiciones de pantalla con respeto por `prefers-reduced-motion`.

### Fase 2 — Flujo público

- [ ] Crear la pantalla de Inicio con `Crear turno`, `Ver calendario` y acceso secundario a `Administración`.
- [ ] Implementar el calendario mensual a medida, iniciando la semana el lunes.
- [ ] Implementar navegación entre meses y estados de fecha: habilitada, no habilitada, pasada y seleccionada.
- [ ] Implementar la lista de horarios de 30 minutos al seleccionar una fecha de atención.
- [ ] Añadir los dos modos de calendario: consulta pública y selección activa para reservar.
- [ ] Mostrar únicamente las iniciales para los horarios ocupados en modo público.
- [ ] Implementar el formulario con nombre, edad, zonas y teléfono.
- [ ] Centralizar la lista provisional de zonas y marcarla como pendiente de reemplazo por los nombres oficiales.
- [ ] Implementar validación de campos y mensajes accesibles.
- [ ] Implementar la pantalla de verificación con opciones para editar datos o cambiar fecha/horario.
- [ ] Implementar una pantalla de confirmación vinculada al resultado real de la operación.
- [ ] Manejar estados de carga, fallos de red, slot ocupado concurrentemente y reintentos.

### Fase 3 — Persistencia y backend mínimo

- [ ] Elegir una solución administrada simple y compatible con el hosting objetivo; comprobar los límites vigentes de su plan gratuito.
- [ ] Crear la estructura de fechas de atención y reservas.
- [ ] Añadir restricciones para validar ventanas horarias, fechas y unicidad de fecha + hora de turno.
- [ ] Crear la operación segura para crear una reserva con validación atómica de disponibilidad.
- [ ] Crear una consulta pública que devuelva solo información de calendario e iniciales.
- [ ] Asegurar que nombres completos, teléfonos, edades y zonas solo sean accesibles al administrador.
- [ ] Configurar permisos/políticas explícitos para operaciones públicas y administrativas.
- [ ] Implementar la autenticación de un único administrador sin registro público.
- [ ] Asegurar que las credenciales y claves privilegiadas nunca estén expuestas en el bundle del frontend.
- [ ] Cargar datos de demostración únicamente si son claramente identificados como datos de prueba y no se mezclan con producción.

### Fase 4 — Modo administrador

- [ ] Implementar el acceso discreto y el formulario de usuario/contraseña.
- [ ] Habilitar el modo administrador dentro de la vista de turnos después de autenticar.
- [ ] Implementar crear, modificar, activar/desactivar y eliminar fechas de atención.
- [ ] Configurar rangos horarios por fecha con valores iniciales `08:00`–`18:00` y límites `06:00`–`22:00`.
- [ ] Implementar la vista administrativa de los datos completos de cada reserva.
- [ ] Implementar edición/reubicación de reservas comprobando el horario destino.
- [ ] Implementar cancelación/eliminación con confirmación y liberación del horario.
- [ ] Asegurar que cada mutación vuelva a validar permisos en el backend/base de datos.
- [ ] Implementar cierre de sesión y estados de sesión vencida.

### Fase 5 — Pruebas de aceptación

- [ ] Probar el recorrido completo: Inicio → Crear turno → Calendario → Horario → Formulario → Verificación → Confirmación.
- [ ] Probar el recorrido de solo consulta desde `Ver calendario`.
- [ ] Probar que ninguna fecha no configurada sea reservable.
- [ ] Probar rangos `08:00`–`18:00`, límites de `06:00` y `22:00`, y generación exacta de intervalos de 30 minutos.
- [ ] Probar validaciones de nombre, edad, zonas y teléfono.
- [ ] Probar que una reserva creada aparece ocupada y con iniciales.
- [ ] Inspeccionar las respuestas públicas para comprobar que no filtran datos privados.
- [ ] Probar reserva duplicada y dos confirmaciones simultáneas para el mismo horario.
- [ ] Probar acceso administrativo válido e inválido.
- [ ] Probar que un visitante no puede editar/borrar una reserva ni leer datos privados manipulando solicitudes.
- [ ] Probar altas, cambios y bajas de fechas de atención con reservas existentes.
- [ ] Probar la interfaz en anchos de móvil y escritorio, incluidos foco por teclado y movimiento reducido.
- [ ] Ejecutar build y las verificaciones disponibles; corregir errores y documentar los límites conocidos.

### Fase 6 — Entrega y despliegue

- [ ] Crear `.env.example` sin secretos reales.
- [ ] Incluir migraciones/scripts reproducibles para inicializar la base de datos, permisos y consultas seguras.
- [ ] Crear o actualizar `README.md` con instalación, desarrollo local, configuración de credenciales, inicialización del proveedor y despliegue.
- [ ] Documentar los pasos que el propietario debe completar manualmente en las consolas del proveedor.
- [ ] Si se requiere versionado Git, inicializarlo como repositorio nuevo e independiente; no importar historial ni vincular automáticamente un remoto de un proyecto anterior. Documentar cómo conectar un remoto nuevo cuando el propietario lo decida.
- [ ] Verificar el build de producción y las rutas/API del hosting elegido.
- [ ] Confirmar que no se haya agregado ningún secreto al repositorio.
- [ ] Entregar un resumen conciso de la solución, decisiones técnicas, comandos probados y pasos pendientes para desplegar en la cuenta real.

## 9. Decisiones provisionales que deben quedar fáciles de cambiar

- Nombre comercial y logo: no proporcionados; usar un título neutral.
- Lista oficial de zonas: no proporcionada; mantener una lista configurable y claramente provisional.
- Horario inicial habitual: `08:00`–`18:00`, configurable para cada fecha.
- Duración inicial: 30 minutos por reserva; no cambia según zonas seleccionadas.
- Frecuencia de atención: una fecha al mes habitualmente; puede haber dos fechas en un mismo fin de semana.
- Proveedor exacto de hosting/base de datos: decisión del agente según simplicidad, seguridad y límites actuales del plan gratuito.
