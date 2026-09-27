# CompatiPC · Backend

API de **CompatiPC**, una herramienta que ayuda a saber si un componente (RAM, disco, procesador, tarjeta gráfica o fuente de poder) es compatible con un equipo antes de comprarlo. El análisis lo hace **Google Gemini** con una respuesta estructurada y validada, y cada resultado se puede descargar en **PDF**.

Frontend: [frontend-compaticpc](https://github.com/CristianGarcia7/frontend-compaticpc)

## ✨ Funcionalidades

- **Registro e inicio de sesión** con sesiones en cookie `httpOnly`; las contraseñas se guardan con `scrypt` y sal.
- **Equipos**: cada usuario registra sus computadores (marca, modelo y board).
- **Análisis de compatibilidad con IA**: Gemini devuelve un veredicto (`compatible`, `conditional` o `incompatible`), qué se revisó, los riesgos y las alternativas. La respuesta se valida con **Zod** y se rechaza si no cumple el esquema.
- **Historial y feedback** de análisis, con **exportación a PDF** (pdfkit).
- **Catálogo de componentes** administrado por usuarios con rol `admin`.
- **Modo demo** opcional con respuestas locales predefinidas, para mostrar la app sin API key.

## 🔒 Seguridad

- `helmet`, límite de 24 KB por petición y `Cache-Control: no-store`.
- Validación del `Origin` en peticiones que modifican datos.
- *Rate limiting* por IP y tipo de ruta: autenticación, IA y general.
- Los datos del usuario se envían a la IA como datos, nunca como instrucciones. El serial y el propietario del equipo no se envían.
- Si la IA falla, responde con 503 o 504 y **nunca** con un resultado inventado.

## 🧱 Stack

NestJS 11 · Express 5 · TypeORM · PostgreSQL · Zod · pdfkit · Gemini API · TypeScript

## 🚀 Cómo correrlo

```bash
cp .env.example .env      # completa DATABASE_URL, SESSION_SECRET (32+ caracteres) y GEMINI_API_KEY
pnpm install
pnpm migrate              # crea las tablas
pnpm dev                  # API en http://127.0.0.1:3100
```

Dar rol de administrador a una cuenta ya registrada:

```bash
ADMIN_EMAIL=tu@correo.com pnpm admin
```

## 🧪 Tests

```bash
pnpm test
```

Cubren el hash de contraseñas, que el registro no pueda asignar roles, la validación de entradas, el esquema de la IA, los errores de Gemini (503/504) y el aislamiento de datos entre usuarios.

## 📡 Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/register` · `/login` · `/logout` | Autenticación |
| `GET` | `/api/auth/me` | Usuario actual |
| `GET` `POST` `DELETE` | `/api/equipment` | Equipos del usuario |
| `POST` | `/api/analyses` | Nuevo análisis de compatibilidad |
| `GET` | `/api/analyses` · `/api/analyses/:id` | Historial y detalle |
| `PATCH` | `/api/analyses/:id/feedback` | Feedback del resultado |
| `GET` | `/api/analyses/:id/pdf` | Descargar el informe en PDF |
| `GET` `POST` `PATCH` `DELETE` | `/api/components` | Catálogo (escritura solo admin) |
| `GET` | `/api/health` · `/api/config` · `/api/dashboard` | Sistema y resumen |
