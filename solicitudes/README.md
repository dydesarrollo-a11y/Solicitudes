# Solicitudes · Blender Group

Sistema de tickets tipo **Kanban** para gestionar solicitudes internas de
**igualación, muestras, reportes y entregas**. Acceso restringido al dominio
`@blendergroup.com`, con roles, SLA en horario hábil (zona `America/Mexico_City`),
notificaciones internas y a Google Chat, y auditoría completa por ticket.

> Stack: **Next.js 14 (App Router, export estático) + React + TypeScript +
> Tailwind** en el frontend, publicado en **GitHub Pages**; **Firebase** (Auth,
> Cloud Firestore, Storage, Cloud Functions, Scheduled Functions) como backend.

---

## 1. Arquitectura

El cliente **nunca** realiza escrituras críticas. Crear ticket, mover columnas,
asignar roles, confirmar entrega y cierre forzado pasan **siempre** por Cloud
Functions (Admin SDK). Las **Firestore Rules** y **Storage Rules** son la segunda
barrera y bloquean cualquier manipulación desde el frontend.

```
Next.js (cliente) ──httpsCallable──▶ Cloud Functions ──▶ Firestore / Storage
       │                                   ▲                     ▲
       └──lecturas filtradas por rol───────┘        Security Rules (barrera)
Firebase Auth (Google) → custom claims { role, status }
Scheduled Function slaSweep (cada 15 min) → recalcula estado de tiempo
Google Chat ◀── webhook desde Functions
```

Permisos por **custom claims** (`role`, `status`) verificables en Rules y
Functions sin lecturas extra.

## 2. Estructura del proyecto

```
solicitudes/
├─ src/
│  ├─ app/                 # Rutas: / /login /dashboard /admin /ticket/[id]
│  ├─ components/          # Header, Kanban, ticket/*, admin/*, ui/*
│  ├─ hooks/               # useAuth, useTickets, useNotifications, useConfig, useTheme
│  └─ lib/
│     ├─ business/         # businessTime.ts (horas hábiles), sla.ts, permissions.ts, constants.ts
│     ├─ firebase/         # config, auth, services (callables, storage, queries)
│     └─ types/            # contrato TypeScript del dominio
├─ functions/src/          # createTicket, moveTicket, confirmDelivery, forceClose,
│                          # assignRole, setUserStatus, onUserCreate, onCommentCreate, slaSweep
├─ firestore.rules · storage.rules · firestore.indexes.json
├─ scripts/seed-superadmins.mjs
└─ firebase.json · .firebaserc · .env.local.example
```

## 3. Roles

| Rol | Capacidades clave |
|---|---|
| **SuperAdmin** | Todo: usuarios/roles, SLA, calendario, cierre forzado (con motivo), auditoría. |
| **Administrador** | Ve/edita todos los tickets, asigna compromiso, mueve `En espera→Igualación` y `Reporte→Entregado`, métricas. |
| **Solicitante** | Crea y ve sus tickets, comenta, adjunta, **confirma la entrega** (cierra el ticket). |
| **Técnico** | Ve etapas técnicas, mueve `Igualación→Muestra` y `Muestra→Reporte`. Sin asignación individual. |
| **Auditor** | Solo lectura (tickets, comentarios, historial, adjuntos). |

## 4. Flujo del ticket

`En espera → Igualación → Muestra → Reporte → Entregado → Cerrado`

- El Solicitante crea el ticket (folio automático `SOL-AAAA-0001`) en **En espera**.
- Admin/SuperAdmin asigna **fecha compromiso** (requisito para salir de En espera).
- Técnicos avanzan las etapas técnicas; Admin pasa a **Entregado**.
- En **Entregado** se notifica al Solicitante y aparece **Confirmar entrega**.
- Al confirmar → estado **Cerrado** (se registra quién y cuándo, sale del tablero).
- SLA vencido = `timeStatus: late` (rojo, alerta), **no** cambia de columna.

## 5. Horario hábil y SLA

Todo el cálculo de tiempos usa `src/lib/business/businessTime.ts` (mismo motor en
backend): jornada **08:00–18:00**, **L–V**, zona **America/Mexico_City**, excluye
festivos oficiales de México y días personalizados. Ejemplo verificado: una etapa
con 2 h hábiles iniciada **viernes 17:30** vence el **lunes 09:30**.

Los SLA por etapa y el umbral “por vencer” se configuran en **Admin → SLA**.

---

## 6. Puesta en marcha

### Requisitos
- Node.js 20+
- Firebase CLI: `npm i -g firebase-tools`
- Un proyecto Firebase con **Auth (Google)**, **Firestore**, **Storage** y
  **Functions** habilitados (plan Blaze para Functions/Scheduler).

### Configuración
1. Edita `.firebaserc` y pon el ID real de tu proyecto en `default`.
2. Copia variables de entorno:
   ```bash
   cp .env.local.example .env.local
   ```
   Rellena los valores de **Project Settings → Your apps (Web)**.
3. En **Authentication → Sign-in method** habilita **Google** y agrega tu
   dominio autorizado.

### Instalación
```bash
npm install
cd functions && npm install && cd ..
```

### Desarrollo local (emuladores)
```bash
# en .env.local: NEXT_PUBLIC_USE_EMULATORS=true
firebase emulators:start      # Auth, Firestore, Storage, Functions
npm run dev                   # http://localhost:3000
```

### Pruebas del motor de horas hábiles
```bash
npm run test:business
```

---

## 7. Despliegue: frontend en GitHub Pages + backend en Firebase

El **frontend** se publica como sitio estático (`output: 'export'`) en **GitHub
Pages** mediante GitHub Actions. El **backend permanece en Firebase**:
**Authentication**, **Cloud Firestore**, **Storage** y **Cloud Functions**. El
navegador habla directo con Firebase (SDK web) y con las Functions vía
`httpsCallable` (CORS resuelto por callables).

### 7.1 Backend en Firebase (una vez, desde tu máquina o por Actions)
```bash
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions,firestore:rules,firestore:indexes,storage --project TU_PROJECT_ID
```
Define la URL pública para los enlaces de las notificaciones (incluye el basePath
del repo). En la consola de cada Function (gen 2) agrega la variable de entorno:
```
APP_BASE_URL = https://TU_USUARIO.github.io/TU_REPO
```

> Opcional: el workflow `.github/workflows/deploy-firebase-backend.yml` despliega
> el backend automáticamente. Requiere los secrets `FIREBASE_SERVICE_ACCOUNT`
> (JSON de cuenta de servicio) y `FIREBASE_PROJECT_ID`.

### 7.2 Frontend en GitHub Pages
1. Sube el contenido de `solicitudes/` a un repositorio de GitHub (rama `main`).
2. En **Settings → Pages**, en *Build and deployment* elige **GitHub Actions**.
3. En **Settings → Secrets and variables → Actions** agrega los secrets con la
   config web de Firebase (no son secretos sensibles, pero así no quedan en el repo):
   `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
4. Haz push a `main`. El workflow `.github/workflows/deploy-pages.yml` compila el
   export estático y lo publica. La app quedará en
   `https://TU_USUARIO.github.io/TU_REPO/`.

> El workflow fija `NEXT_PUBLIC_BASE_PATH=/<repo>` automáticamente (necesario para
> GitHub Pages de proyecto). Si usas un repo `usuario.github.io` o un dominio
> propio, deja `NEXT_PUBLIC_BASE_PATH` vacío.

### 7.3 Autorizar el dominio de Pages en Firebase Auth (IMPORTANTE)
Para que el inicio de sesión con Google funcione desde GitHub Pages:
**Firebase Console → Authentication → Settings → Authorized domains → Add domain**
y agrega `TU_USUARIO.github.io`. Sin esto, el popup de Google será rechazado.

### Build local del export (para probar antes de subir)
```bash
npm run build      # genera la carpeta ./out (sitio estático)
npx serve out      # o cualquier servidor estático
```

---

## 8. SuperAdmins iniciales

Los correos **amartinez@blendergroup.com** y **dydesarrollo@blendergroup.com**
están registrados como SuperAdmin semilla:

- **Automático**: la primera vez que cualquiera de ellos inicie sesión con Google,
  el trigger `onUserCreate` lo crea como SuperAdmin **activo** (custom claims +
  documento en `users`). El resto del dominio entra como `pending` hasta que un
  SuperAdmin le asigne rol.
- **Manual** (si ya existían en Auth antes de desplegar el trigger): descarga la
  clave de servicio como `serviceAccountKey.json` en la raíz y ejecuta:
  ```bash
  npm run seed
  ```
  Después esos usuarios deben cerrar y reabrir sesión para refrescar el token.

Para cambiar la lista, edita `SEED_SUPERADMINS` en
`functions/src/admin.ts` (y opcionalmente `src/lib/business/constants.ts`).

---

## 9. Modelo de datos (Firestore)

```
users/{uid}                         role, status, email, displayName, lastLoginAt…
tickets/{ticketId}                  todos los campos del ticket (SOL-AAAA-0001)
tickets/{ticketId}/comments/{id}    autor, texto, menciones, adjuntos, fecha
tickets/{ticketId}/history/{id}     evento, actor, antes/después, fecha (auditoría)
notifications/{id}                  recipientUid | recipientRole, tipo, leído…
slaSettings/config                  duraciones por etapa + umbral de alerta
businessCalendar/config             jornada, días, festivos, no laborables
notificationSettings/config         webhook de Google Chat + toggles
chatNotificationLogs/{id}           bitácora de envíos externos
counters/tickets-AAAA               folio consecutivo (transacción)
```

## 10. Seguridad — resumen

- Acceso solo a `@blendergroup.com`; usuarios nuevos quedan `pending`.
- Escrituras de tickets, roles y cierres: **solo Cloud Functions**.
- Comentarios: escritura directa permitida por Rules únicamente al autor con
  permiso sobre el ticket; inmutables después.
- Notificaciones: el usuario solo puede marcar `read`.
- Storage: lectura/subida según permisos del ticket, límite de 25 MB y tipos.

## 11. Calidad

TypeScript estricto, componentes reutilizables, validación de formularios,
estados de carga/vacío/error, diseño responsive y modo claro/oscuro, separación
frontend / servicios Firebase / lógica de negocio, y lógica de horas hábiles con
pruebas (`npm run test:business`).
