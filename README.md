# Backend WPPConnect - Sistema de Envío Masivo WhatsApp

Backend Node.js/TypeScript que reemplaza Evolution API para el manejo de sesiones de WhatsApp y envío masivo de mensajes.

## Características

- ✅ Gestión de 100+ sesiones simultáneas
- ✅ Sesiones persistentes en disco
- ✅ Reconexión automática
- ✅ Sistema de colas con delays aleatorios (2-8 segundos)
- ✅ Límite de mensajes diarios por instancia (50 por defecto)
- ✅ API REST compatible con el frontend PHP existente
- ✅ Integración con MySQL

## Instalación

1. **Instalar dependencias:**
```bash
cd backend-whatsapp
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

3. **Compilar TypeScript:**
```bash
npm run build
```

4. **Iniciar servidor:**
```bash
npm start
# O en modo desarrollo:
npm run dev
```

## Configuración

Variables de entorno en `.env`:

```
PORT=3000
DB_HOST=localhost
DB_NAME=u517927401_mazivoz
DB_USER=u517927401_mazivoz
DB_PASS=102095Finm!
SESSIONS_PATH=./sessions
CHROME_PATH=  # Opcional, ruta a Chrome/Chromium
MAX_MESSAGES_PER_INSTANCE_DAILY=50
DELAY_MIN_MS=2000
DELAY_MAX_MS=8000
```

## API Endpoints

### Instancias

- `POST /api/instances` - Crear nueva instancia
- `GET /api/instances` - Listar todas las sesiones
- `GET /api/instances/:name/qr` - Obtener QR code
- `GET /api/instances/:name/status` - Estado de sesión
- `DELETE /api/instances/:name` - Desconectar sesión

### Mensajes

- `POST /api/messages/send` - Enviar mensaje individual (añade a cola)
- `POST /api/messages/bulk` - Envío masivo
- `GET /api/messages/queue` - Estado de la cola

### Admin

- `GET /api/admin/dashboard` - Panel de administración

## Estructura de Carpetas

```
backend-whatsapp/
├── sessions/          # Sesiones WPPConnect persistentes
├── src/
│   ├── config/       # Configuración (DB)
│   ├── wpp/          # Gestor de sesiones WPPConnect
│   ├── queue/        # Sistema de colas
│   ├── api/          # Rutas Express
│   ├── db/           # Queries MySQL
│   └── utils/        # Utilidades
└── dist/             # Código compilado
```

## Uso

El frontend PHP se conecta automáticamente al backend a través de la URL configurada en `includes/config.php`:

```php
define('WPPCONNECT_API_URL', 'http://localhost:3000/api');
```

## Notas

- Las sesiones se guardan en `sessions/` y persisten tras reinicios
- Los mensajes se procesan con delays aleatorios para evitar detección de spam
- El sistema respeta límites diarios por instancia
- Los logs se registran en la base de datos MySQL

