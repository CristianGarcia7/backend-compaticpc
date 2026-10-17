# CompatiPC · Backend

API de **CompatiPC**, una herramienta que ayuda a saber si un componente (RAM, disco, procesador, tarjeta gráfica, fuente de poder, batería o cargador) es compatible con un equipo antes de comprarlo. El análisis lo hace **Google Gemini** con una respuesta estructurada y validada, y cada resultado se puede descargar en **PDF**.

Frontend: [frontend-compaticpc](https://github.com/CristianGarcia7/frontend-compaticpc)

## ✨ Funcionalidades

- **Registro e inicio de sesión** con sesiones en cookie `httpOnly`; las contraseñas se guardan con `scrypt` y sal.
- **Equipos**: cada usuario registra y edita sus computadores (marca, modelo y board).
- **Análisis de compatibilidad con IA**: Gemini devuelve un veredicto (`compatible`, `conditional` o `incompatible`), qué se revisó, los riesgos y las alternativas. La respuesta se valida con **Zod** y se rechaza si no cumple el esquema.
- **Reglas técnicas deterministas** antes de la IA: generación DDR3/DDR4/DDR5, formato DIMM/SO-DIMM según el tipo de equipo, socket del procesador (también inferido del chipset), capacidad de la fuente frente al TDP estimado, potencia/voltaje/conector del cargador y voltaje/Wh/celdas de la batería. Una regla fallida fuerza el veredicto `incompatible` aunque la IA diga lo contrario, y cada resultado incluye `rules` y `warnings`.
- **Contraste con el catálogo**: si la referencia coincide con un componente del catálogo (nombre o número de parte), se usa su ficha técnica y se advierte cuando los datos ingresados la contradicen.
- **Historial y feedback** de análisis, con **exportación a PDF** (pdfkit).
- **Catálogo de componentes** administrado por usuarios con rol `admin`. Cada componente puede enlazar su ficha oficial (`datasheetUrl`); la migración `1789780000000-catalog-datasheets` corrige el catálogo existente por nombre (por ejemplo, la Kingston KF432C16BB1/8 es DIMM de escritorio) y añade cargadores y baterías reales.
- **Modo demo** opcional que responde solo con las reglas técnicas locales, para mostrar la app sin API key.

## 🔒 Seguridad

- `helmet`, límite de 24 KB por petición y `Cache-Control: no-store`.
- Validación del `Origin` en peticiones que modifican datos.
- _Rate limiting_ por IP y tipo de ruta: autenticación, IA y general.
- Los datos del usuario se envían a la IA como datos, nunca como instrucciones. El serial y el propietario del equipo no se envían.
- Si Gemini falla (sin clave, cuota, clave rechazada, modelo inexistente, tiempo de espera o salida inválida), la API responde 200 con el resultado de las **reglas técnicas** (`provider: "rules"`, `model: "rules-v1"`) y `result.fallback.reason` explica la causa al técnico. Nunca se inventa un veredicto de IA.
- Los errores de Gemini se registran con el código HTTP y el cuerpo truncado; la clave de API se enmascara y nunca se escribe en los registros.

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

Cubren el hash de contraseñas, que el registro no pueda asignar roles, la validación de entradas, el esquema de la IA, los errores de Gemini y el respaldo con reglas, el registro sin clave, la verificación de salud de Gemini, las reglas técnicas, la migración del catálogo y el aislamiento de datos entre usuarios.

## 📡 Endpoints principales

| Método                        | Ruta                                        | Descripción                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`                        | `/api/auth/register` · `/login` · `/logout` | Autenticación                                                                                                                                                                   |
| `GET`                         | `/api/auth/me`                              | Usuario actual                                                                                                                                                                  |
| `GET` `POST`                  | `/api/equipment`                            | Equipos del usuario                                                                                                                                                             |
| `PATCH` `DELETE`              | `/api/equipment/:id`                        | Editar (`{brand?, model?, board?, serial?}`) o eliminar un equipo propio                                                                                                        |
| `POST`                        | `/api/analyses`                             | Nuevo análisis de compatibilidad                                                                                                                                                |
| `GET`                         | `/api/analyses` · `/api/analyses/:id`       | Historial y detalle                                                                                                                                                             |
| `PATCH`                       | `/api/analyses/:id/feedback`                | Feedback del resultado: `{feedback: "useful" \| "not-useful", reason?}` (motivo opcional de hasta 500 caracteres, guardado en `feedbackReason`)                                 |
| `GET`                         | `/api/analyses/:id/pdf`                     | Descargar el informe en PDF                                                                                                                                                     |
| `GET` `POST` `PATCH` `DELETE` | `/api/components`                           | Catálogo (escritura solo admin)                                                                                                                                                 |
| `GET`                         | `/api/health`                               | `{status, db, gemini}`: base de datos (`SELECT 1`) y estado de Gemini                                                                                                           |
| `GET`                         | `/api/config`                               | Configuración pública; `gemini: {status, checkedAt, detail?}` viene de una consulta de metadatos del modelo en caché (5 min si responde, 1 min si falla), sin generar contenido |
| `GET`                         | `/api/dashboard`                            | Resumen del usuario                                                                                                                                                             |
