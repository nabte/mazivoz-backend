# 🧪 Guía Completa de Testing - Backend WPPConnect

## 📋 Resumen

- ✅ **El login PHP NO cambia** - Sigues usando el mismo sistema de autenticación
- ✅ **Solo cambia el backend de WhatsApp** - De Evolution API a WPPConnect
- ✅ **El frontend PHP sigue igual** - Solo se conecta a un backend diferente

## 🚀 Paso 1: Configurar el Backend

### 1.1 Crear archivo `.env`

```bash
cd backend-whatsapp
cp .env.example .env
```

### 1.2 Editar `.env` con tus datos:

```env
PORT=3000
DB_HOST=localhost
DB_NAME=u517927401_mazivoz
DB_USER=u517927401_mazivoz
DB_PASS=102095Finm!
SESSIONS_PATH=./sessions
CHROME_PATH=
MAX_MESSAGES_PER_INSTANCE_DAILY=50
DELAY_MIN_MS=2000
DELAY_MAX_MS=8000
BASE_URL=http://localhost:3000
```

**Nota:** Si estás en Windows y tienes Chrome instalado, puedes dejar `CHROME_PATH` vacío o poner la ruta completa:
```
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

## 🚀 Paso 2: Instalar e Iniciar

```bash
# Instalar dependencias (solo la primera vez)
npm install

# Compilar TypeScript
npm run build

# Iniciar servidor (modo desarrollo con auto-reload)
npm run dev
```

Deberías ver:
```
[INFO] Servidor WPPConnect iniciado en puerto 3000
[INFO] Health check: http://localhost:3000/health
[INFO] API disponible en: http://localhost:3000/api
```

## 🔗 Paso 3: Verificar Conexión

Abre otra terminal y prueba:

```bash
curl http://localhost:3000/health
```

O en el navegador: `http://localhost:3000/health`

Deberías ver:
```json
{"status":"ok","timestamp":"2024-01-01T12:00:00.000Z"}
```

## 📱 Paso 4: Conectar WhatsApp (Igual que Antes)

### 4.1 Desde el Frontend PHP

1. **Inicia sesión** en tu plataforma PHP (el login NO cambió)
   - URL: `https://mazivoz.brandcode.com.mx/login.php`
   - Usuario y contraseña igual que antes

2. **Ve a "Gestionar Instancias"** o "Instancias"
   - URL: `https://mazivoz.brandcode.com.mx/instances.php`

3. **Haz clic en "Agregar Instancia"**
   - El sistema creará la instancia en el backend WPPConnect
   - Verás logs en la terminal del backend Node.js

### 4.2 Escanear QR Code

**Opción A: Desde el Frontend**
- El QR aparecerá en la página web (igual que antes)
- Escanea con WhatsApp desde tu celular

**Opción B: Desde la Terminal**
- El QR también aparece en la terminal del backend Node.js
- Copia y pega el QR de la terminal si prefieres

### 4.3 Verificar Conexión

Después de escanear:
- En la terminal del backend verás: `[instanceName] ✅ Sesión conectada exitosamente`
- En el frontend PHP, el estado cambiará a "Conectado"

## 🧪 Paso 5: Probar Envío de Mensajes

### 5.1 Crear Campaña de Prueba

1. Ve a "Crear Campaña" en el frontend PHP
2. Escribe un mensaje de prueba
3. Selecciona algunos contactos
4. Haz clic en "Crear y Enviar Campaña"

### 5.2 Ver Logs en Tiempo Real

En la terminal del backend verás:
```
📨 Recibido envío masivo { campaignId: 1, totalContacts: 5 }
✅ Generadas 4 variaciones del mensaje
📤 Procesando instancia user1 con 5 mensajes
📝 Encolando mensaje 1 para 5219991234567
[user1] Pausa de 3s antes de enviar mensaje msg_123... (índice 0)
[user1] Enviando mensaje msg_123... a 5219991234567 (índice 0)
[user1] ✅ Mensaje msg_123... enviado exitosamente a 5219991234567
```

## 🔍 Verificación de Funcionamiento

### ✅ Checklist de Pruebas

- [ ] Backend inicia sin errores
- [ ] Health check responde OK
- [ ] Puedo crear una instancia desde PHP
- [ ] Aparece QR code (en web y/o terminal)
- [ ] Puedo escanear QR con WhatsApp
- [ ] La instancia se marca como "Conectada"
- [ ] Puedo crear una campaña
- [ ] Los mensajes se encolan correctamente
- [ ] Los mensajes se envían (ver logs)
- [ ] Los logs aparecen en la BD (campaign_logs)

## 🐛 Solución de Problemas

### El backend no inicia

**Error:** `Cannot find module 'express'`
```bash
cd backend-whatsapp
npm install
```

**Error:** `Port 3000 already in use`
- Cambia el puerto en `.env`: `PORT=3001`
- O cierra el proceso que usa el puerto 3000

### No aparece QR code

1. Verifica que el backend esté corriendo
2. Revisa los logs en la terminal
3. Verifica que la URL en `includes/config.php` sea correcta:
   ```php
   define('WPPCONNECT_API_URL', 'http://localhost:3000/api');
   ```

### La instancia no se conecta

1. Verifica que Chrome/Chromium esté instalado
2. Revisa los logs del backend para errores
3. Asegúrate de escanear el QR rápidamente (expira en ~30 segundos)

### Los mensajes no se envían

1. Verifica que la instancia esté "Conectada" (no "Pending")
2. Revisa los logs del backend
3. Verifica que los números estén en formato correcto (521...)

## 📊 Monitoreo en Tiempo Real

### Ver Estado de Sesiones

```bash
curl http://localhost:3000/api/instances
```

### Ver Estado de Cola

```bash
curl http://localhost:3000/api/messages/queue
```

### Ver Dashboard Completo

```bash
curl http://localhost:3000/api/admin/dashboard
```

## 🔄 Flujo Completo

```
1. Usuario inicia sesión en PHP (login.php) ✅ NO CAMBIA
   ↓
2. Usuario crea instancia (instances.php) 
   → PHP llama a: POST http://localhost:3000/api/instances
   → Backend WPPConnect genera QR
   ↓
3. Usuario escanea QR con WhatsApp
   → WPPConnect detecta conexión
   → Estado cambia a "connected"
   ↓
4. Usuario crea campaña (create_campaign.php) ✅ NO CAMBIA
   → PHP llama a: POST http://localhost:3000/api/messages/bulk
   → Backend encola mensajes con delays
   ↓
5. Sistema envía mensajes automáticamente
   → Logs en terminal
   → Actualiza BD (campaign_logs)
```

## 💡 Notas Importantes

1. **El login PHP NO cambia** - Todo el sistema de autenticación sigue igual
2. **Solo el backend de WhatsApp cambió** - De Evolution API a WPPConnect
3. **Las sesiones se guardan automáticamente** - En `backend-whatsapp/sessions/`
4. **Los logs son claros** - Usa emojis para fácil identificación
5. **El sistema funciona igual que n8n** - Mismas variaciones, pausas y delays

## 🎯 Próximos Pasos

1. ✅ Iniciar backend: `npm run dev`
2. ✅ Probar crear instancia desde PHP
3. ✅ Escanear QR y verificar conexión
4. ✅ Enviar mensaje de prueba
5. ✅ Verificar logs y BD

¡Listo para probar! 🚀

