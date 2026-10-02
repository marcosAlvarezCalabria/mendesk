# Manual de instalación de Mendesk por taller

Este documento es la lista operativa para preparar una instalación independiente de Mendesk. Está pensado para poder repetir el proceso sin depender de la memoria de quien lo ejecuta.

Cada taller debe tener su propio frontend, Directus, PostgreSQL, archivos, usuarios, copias de seguridad y despliegue. Este procedimiento no crea un SaaS multi-tenant y nunca reutiliza datos, secretos o sesiones de otra tienda.

La creación inicial del producto fue un trabajo único: Mendesk se creó como repositorio independiente a partir de una base funcional saneada y sin historial, secretos ni datos de Koko. Para incorporar un taller nuevo se parte siempre del repositorio Mendesk; no se vuelve a copiar Koko ni ninguna instalación existente.

## 1. Límites que no se deben cruzar

- No copiar `.git`, `.env*`, contraseñas, tokens, sesiones, fotografías, uploads, logs, cachés, builds ni `node_modules` desde otra instalación.
- No importar una base de datos de otro cliente para iniciar una tienda nueva.
- No apuntar dos tiendas al mismo Directus, PostgreSQL, volumen de archivos o fichero de configuración.
- No publicar Directus ni PostgreSQL en Internet. El frontend accede a Directus por una red Docker privada; la administración se realiza mediante túnel SSH.
- No cargar los datos ficticios de demostración en una tienda real.
- No ejecutar cambios de esquema, borrados, restauraciones o despliegues sin identificar primero la instalación y disponer de rollback.
- No mostrar la firma de Mendesk/Incamdi en tickets, QR o mensajes dirigidos a clientes salvo decisión expresa.

## 2. Datos que hay que pedir al taller

Crear una ficha privada fuera de Git con estos valores:

| Dato | Ejemplo no real |
| --- | --- |
| Nombre visible | `Demo Atelier` |
| Identificador estable | `demo-atelier` |
| Nombre corto/PWA | `Demo` |
| Logo aprobado | `/store/demo-atelier-mark.svg` |
| Dominio del panel | `panel.example.com` |
| URL de reseñas, si existe | `https://example.com/review` |
| Idiomas disponibles | `en,uk` |
| Idioma inicial | `en` |
| Zona horaria | `Europe/Dublin` |
| Moneda | `EUR` |
| Prefijo telefónico | `353` |
| Email del administrador técnico | dirección privada |
| Email de cada usuario del taller | dirección individual |
| Política de conservación y copias | decisión contractual |

Confirmar también quién controla DNS, quién recibe avisos operativos y quién puede autorizar una restauración.

## 3. Variables usadas en este manual

Sustituir siempre los marcadores antes de ejecutar una acción:

```text
<SHOP_SLUG>             identificador de la tienda
<SERVER_ALIAS>          alias SSH verificado
<PANEL_HOSTNAME>        dominio público sin https://
<RELEASE_COMMIT>        commit exacto aprobado de Mendesk
<DIRECTUS_DIR>          directorio privado de la instalación Directus
<PANEL_DIR>             directorio privado del frontend
<DIRECTUS_NETWORK>      red Docker exclusiva de la instalación
<ADMIN_EMAIL>           administrador técnico de Directus
<STAFF_EMAIL>           usuario individual del taller
```

No pegar secretos en comandos que puedan quedar en el historial. Guardarlos en ficheros del servidor con permisos `0600` o introducirlos mediante un mecanismo de secretos aprobado.

## 4. Preparar y verificar la versión

En un checkout limpio de Mendesk:

```sh
git fetch origin
git checkout <RELEASE_COMMIT>
corepack enable
pnpm install --frozen-lockfile
pnpm run check
pnpm build
```

No continuar si alguna comprobación falla. Registrar el commit exacto, la fecha y el responsable de la instalación. No desplegar una rama de trabajo ni un árbol con cambios locales.

## 5. Revisar el servidor

Antes de escribir nada, comprobar:

```sh
ssh <SERVER_ALIAS> "id; docker version; docker compose version; nginx -v; certbot --version; df -h /; free -h; ss -lnt"
```

Lista de control:

- [ ] Acceso por clave SSH, sin compartir contraseñas de root.
- [ ] Ubuntu y paquetes de seguridad actualizados.
- [ ] Docker, Compose, Nginx y Certbot disponibles.
- [ ] Espacio suficiente para imágenes, base de datos, archivos y copias.
- [ ] Puertos públicos limitados a los estrictamente necesarios: normalmente 80 y 443, además de SSH restringido.
- [ ] PostgreSQL no tiene puerto público.
- [ ] Directus escucha solo en loopback o en su red Docker privada.
- [ ] No existe otro servicio usando el puerto interno elegido para el frontend.
- [ ] Backups del proveedor activados cuando corresponda; no sustituyen las copias de PostgreSQL y uploads.

## 6. Crear Directus y PostgreSQL

### Instalación de demostración

Para una demo con datos completamente ficticios se puede usar el runtime documentado en `docs/DEMO_DIRECTUS.md` y `infra/demo/compose.yaml`.

1. Generar un entorno nuevo con `pnpm demo:env`.
2. Guardar el fichero generado fuera de Git y con permisos `0600`.
3. Arrancar el stack con `pnpm demo:up` o con Compose desde su directorio definitivo.
4. Confirmar que Directus está saludable y que solo publica su puerto en `127.0.0.1`.
5. Confirmar que PostgreSQL no publica ningún puerto del host.

### Instalación de un cliente real

El compose llamado `demo` no se considera todavía un paquete de producción comercial. Antes del primer cliente de pago hay que aprobar un paquete de Directus específico para producción que incluya, como mínimo:

- secretos gestionados fuera de Git;
- volúmenes con nombres exclusivos del taller;
- correo SMTP para recuperación de acceso;
- copias cifradas de PostgreSQL y uploads;
- monitorización, alertas de disco y prueba de restauración;
- política de actualizaciones y versiones fijadas;
- requisitos legales y de protección de datos aplicables.

No etiquetar una instalación como lista para cliente hasta completar esta sección.

## 7. Aplicar el contrato de datos

Con `DIRECTUS_URL` y `DIRECTUS_ADMIN_TOKEN` disponibles solo en el proceso seguro de provisión:

```sh
pnpm directus:schema:audit
pnpm directus:schema:apply
pnpm directus:schema:audit

pnpm directus:access:audit
pnpm directus:access:apply
pnpm directus:access:audit
```

El orden importa: auditar, aplicar y volver a auditar. Si el provisionador detecta un campo incompatible, detenerse e investigar; no forzar cambios manuales sobre datos existentes.

La política de aplicación no debe conceder administración de Directus ni acceso al Studio al personal del taller. Las capacidades necesarias se ejercen desde Mendesk.

## 8. Crear usuarios

Cada persona debe tener su propio usuario. No compartir una cuenta entre empleados en una instalación real.

Para la demo, crear el usuario de aplicación mediante:

```sh
pnpm directus:user:audit
pnpm directus:user:apply
pnpm directus:user:audit
```

La contraseña debe tener al menos 16 caracteres y combinar mayúsculas, minúsculas, números y símbolos. Se entrega por un canal distinto al del usuario y se cambia antes de compartir públicamente la demo.

Un administrador también puede cambiarla desde Directus: **User Directory → usuario → Password → Save**. Después, cerrar las sesiones abiertas de Mendesk.

## 9. Datos iniciales

### Demo comercial

Solo para una demostración ficticia:

```sh
pnpm directus:seed:audit
pnpm directus:seed:apply
pnpm directus:seed:audit
```

El seed crea clientes, encargos, prendas, pagos y citas sintéticos. No usar esos teléfonos para llamadas o WhatsApp.

### Cliente real

Empezar con las colecciones vacías. Cualquier importación debe tener:

- autorización del cliente;
- mapeo revisado de campos;
- copia previa;
- ensayo en una instalación aislada;
- recuentos antes y después;
- revisión de duplicados, consentimiento y conservación.

Nunca usar un volcado de Koko, de la demo o de otro taller como plantilla de datos.

## 10. Configurar la identidad de la tienda

Crear un `deployment.env` privado fuera del checkout tomando como guía `infra/deploy/deployment.env.template`.

```text
MENDESK_APP_PORT=<puerto loopback libre>
MENDESK_DIRECTUS_NETWORK=<DIRECTUS_NETWORK>
DIRECTUS_URL=http://directus:8055
MENDESK_STORE_ID=<SHOP_SLUG>
MENDESK_STORE_NAME=<nombre visible>
MENDESK_STORE_SHORT_NAME=<nombre corto>
MENDESK_STORE_LOGO_PATH=<ruta pública del logo>
MENDESK_STORE_PANEL_URL=https://<PANEL_HOSTNAME>
MENDESK_STORE_REVIEW_URL=<url opcional>
MENDESK_STORE_LOCALES=<idiomas>
MENDESK_STORE_DEFAULT_LOCALE=<idioma inicial>
MENDESK_STORE_TIME_ZONE=<zona IANA>
MENDESK_STORE_CURRENCY=<moneda>
MENDESK_STORE_CALLING_CODE=<prefijo sin +>
```

Verificar que el logo pertenece a esa tienda y que tickets, QR y WhatsApp no contienen marcas de otra instalación.

La grafía oficial del fabricante está confirmada como **Incamdi**. La firma prevista es **“Powered by Mendesk · by Incamdi”**, discreta y solo dentro del panel. Su presencia visual debe implementarse y aprobarse por separado; no se añade automáticamente a comunicaciones dirigidas a clientes.

## 11. Desplegar el frontend de forma privada

Clonar Mendesk en `<PANEL_DIR>/source`, fijar `<RELEASE_COMMIT>` y mantener el entorno fuera del checkout. Después:

```sh
cd <PANEL_DIR>/source
docker compose \
  --env-file <PANEL_DIR>/deployment.env \
  -f infra/deploy/compose.yaml \
  up -d --build --wait
```

Verificar antes de abrir Nginx:

```sh
docker compose --env-file <PANEL_DIR>/deployment.env -f infra/deploy/compose.yaml ps
curl --fail --silent --show-error http://127.0.0.1:<puerto>/login >/dev/null
ss -lnt | grep '127.0.0.1:<puerto>'
```

El contenedor debe aparecer saludable, ejecutarse como usuario `nextjs` y escuchar únicamente en loopback.

Comprobar desde el contenedor que Directus responde por la red privada:

```sh
docker exec <contenedor-frontend> wget -qO- http://directus:8055/server/ping
```

La respuesta esperada es `pong`.

## 12. DNS, Nginx y HTTPS

1. Crear en Cloudflare un registro `A` para `<PANEL_HOSTNAME>` apuntando a la IPv4 del servidor.
2. Mantener inicialmente **DNS only** (nube gris) y TTL automático.
3. Esperar y verificar la resolución desde el equipo local y desde el servidor.
4. Crear un bloque Nginx exclusivo con `server_name <PANEL_HOSTNAME>` y `proxy_pass http://127.0.0.1:<puerto>`.
5. Ejecutar `nginx -t`; solo si pasa, recargar Nginx.
6. Comprobar el host por HTTP antes de pedir el certificado.
7. Emitir el certificado:

```sh
certbot --nginx \
  --domain <PANEL_HOSTNAME> \
  --email <OPERATIONS_EMAIL> \
  --non-interactive \
  --agree-tos \
  --redirect
```

El email operativo debe estar controlado por la persona o equipo que atiende los avisos de renovación.

8. Confirmar que el temporizador de renovación está activo y que `nginx -t` continúa pasando.
9. Verificar desde fuera:

```sh
curl --head http://<PANEL_HOSTNAME>/login
curl --fail --silent --show-error https://<PANEL_HOSTNAME>/login >/dev/null
```

HTTP debe redirigir a HTTPS y HTTPS debe responder correctamente.

10. Cuando el origen HTTPS esté validado, configurar Cloudflare SSL/TLS en **Full (strict)** y activar el proxy (nube naranja). Volver a probar login, uploads, QR y descargas después del cambio.

## 13. Prueba funcional de aceptación

Realizarla con un usuario sin permisos administrativos:

- [ ] Login y logout funcionan por HTTPS.
- [ ] La identidad principal es la tienda correcta en cabecera y PWA.
- [ ] Listar, buscar, crear y editar clientes.
- [ ] Crear un encargo con varias prendas.
- [ ] Registrar depósito y pago final.
- [ ] Cambiar estados y recoger el encargo.
- [ ] Crear, editar y consultar citas e historial.
- [ ] Subir y visualizar una fotografía de prueba autorizada.
- [ ] Imprimir o previsualizar tickets.
- [ ] Abrir el QR y comprobar que usa `<PANEL_HOSTNAME>`.
- [ ] Revisar el texto de WhatsApp sin enviarlo a un número real durante la prueba.
- [ ] Ver estadísticas y recuentos coherentes.
- [ ] Confirmar que un usuario del taller no puede entrar en Directus Studio.
- [ ] Confirmar que Directus y PostgreSQL no tienen puertos públicos.
- [ ] Probar móvil, escritorio, instalación PWA y pantalla offline.

Registrar los resultados y corregir cualquier fallo antes de entregar credenciales.

## 14. Copias y restauración

Antes de considerar lista una instalación real:

- programar una copia cifrada de PostgreSQL;
- copiar también el volumen de uploads de Directus;
- conservar las copias fuera del VPS;
- definir retención y responsables;
- monitorizar antigüedad y tamaño de la última copia;
- realizar una restauración completa en otro entorno aislado.

Una copia que nunca se ha restaurado no se considera verificada. No probar restauraciones encima de la instalación activa.

## 15. Entrega al taller

- [ ] Crear usuarios individuales y retirar cuentas temporales.
- [ ] Cambiar las contraseñas usadas durante la puesta en marcha.
- [ ] Guardar credenciales administrativas en el gestor aprobado.
- [ ] Entregar la URL HTTPS y las instrucciones mínimas de uso.
- [ ] Explicar soporte, copias, actualizaciones y tratamiento de datos.
- [ ] Registrar versión, dominio, servidor, fecha y responsable en el inventario privado.
- [ ] No entregar el token administrador de Directus al personal de tienda.

## 16. Actualizar una instalación existente

1. Identificar tienda, servidor, dominio, commit actual y salud de los contenedores.
2. Confirmar que la última copia está verificada.
3. Revisar la PR y ejecutar `pnpm run check` y `pnpm build` fuera del servidor.
4. Registrar el commit anterior como punto de rollback.
5. Obtener el nuevo commit aprobado y reconstruir solo el frontend.
6. Esperar a que el healthcheck sea correcto antes de recargar el proxy.
7. Repetir la prueba de humo: HTTPS, login, Directus, lectura y una operación reversible.
8. Si falla, volver al commit anterior y reconstruir con el mismo `deployment.env`.

Una actualización del frontend no debe borrar ni recrear los volúmenes de PostgreSQL o Directus.

## 17. Diagnóstico rápido

Orden recomendado:

1. DNS: `<PANEL_HOSTNAME>` resuelve a la IP esperada.
2. TLS: certificado válido y no caducado.
3. Nginx: `nginx -t` y servicio activo.
4. Frontend: contenedor saludable y puerto ligado a loopback.
5. Red privada: el frontend recibe `pong` de Directus.
6. Directus: contenedor saludable y logs sin errores repetidos.
7. PostgreSQL: saludable, espacio disponible y conexiones normales.
8. Permisos: usuario activo, rol correcto y contraseña válida.
9. Configuración: dominio, zona horaria, moneda, prefijo, idiomas y logo de la tienda correcta.

No cambiar varias capas a la vez. Corregir una causa, verificar y documentar el resultado.

## 18. Registro final de instalación

Guardar fuera de Git y sin secretos en el documento compartido:

```text
Tienda:
Identificador:
Dominio:
Servidor:
Commit Mendesk:
Versión Directus:
Fecha de instalación:
Última copia verificada:
Próxima revisión:
Responsable técnico:
Resultado de aceptación:
Observaciones:
```

La contraseña, los tokens, las claves SSH y los datos personales se guardan en sus sistemas seguros correspondientes, nunca en este registro ni en el repositorio.
