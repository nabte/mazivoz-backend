# Instrucciones de Inicio - Backend WPPConnect

## Pasos para Iniciar el Sistema

### 1. Instalar Dependencias
```bash
cd backend-whatsapp
npm install
```

### 2. Configurar Variables de Entorno
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales
# Asegúrate de configurar:
# - DB_HOST, DB_NAME, DB_USER, DB_PASS (de tu MySQL)
# - PORT (puerto donde correrá el servidor, default: 3000)
# - SESSIONS_PATH (ruta donde se guardan las sesiones)
```

### 3. Compilar TypeScript
```bash
npm run build
```

### 4. Iniciar el Servidor

**Modo Producción:**
```bash
npm start
```

**Modo Desarrollo (con auto-reload):**
```bash
npm run dev
```

### 5. Verificar que Funciona

Abre en tu navegador o usa curl:
```bash
curl http://localhost:3000/health
```

Deberías recibir:
```json
{"status":"ok","timestamp":"2024-01-01T12:00:00.000Z"}
```

### 6. Configurar Frontend PHP

Asegúrate de que en `includes/config.php` esté configurado:
```php
define('WPPCONNECT_API_URL', 'http://localhost:3000/api');
```

Si el backend está en otro servidor, cambia la URL.

## Verificación de Funcionamiento

1. **Crear una instancia desde el frontend PHP**
   - Debería aparecer un QR code en la terminal del backend
   - El QR también se guarda en la BD

2. **Escanear el QR con WhatsApp**
   - La sesión debería conectarse automáticamente
   - Verás logs en la terminal: `[instanceName] ✅ Sesión conectada exitosamente`

3. **Enviar un mensaje de prueba**
   - Desde el frontend, crear una campaña pequeña
   - Verás logs del procesamiento en la terminal

## Logs Importantes

El sistema genera logs claros con emojis para debugging:

- 📨 = Mensaje recibido
- ✅ = Operación exitosa
- ❌ = Error
- ⚠️ = Advertencia
- 📱 = QR code generado
- 🔄 = Cambio de estado
- ⏳ = Esperando acción

## Solución de Problemas

### El servidor no inicia
- Verifica que el puerto 3000 no esté en uso
- Revisa las credenciales de BD en `.env`
- Asegúrate de que Node.js esté instalado (v18+)

### Las sesiones no se conectan
- Verifica que Chrome/Chromium esté instalado
- Revisa los logs para ver errores específicos
- Asegúrate de que el directorio `sessions/` tenga permisos de escritura

### Los mensajes no se envían
- Verifica que la instancia esté conectada (status: 'connected')
- Revisa los logs de la cola de mensajes
- Verifica que los números de teléfono estén en formato correcto

## Notas

- Las sesiones se guardan automáticamente en `sessions/`
- El sistema respeta límites de 50 mensajes/día por instancia
- Los delays aleatorios (2-8s) ayudan a evitar detección de spam
- Las pausas largas (50-120s) se aplican cada 8-15 mensajes

