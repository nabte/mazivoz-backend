# ⚡ Inicio Rápido - 3 Pasos

## 1️⃣ Configurar

```bash
cd backend-whatsapp
cp .env.example .env
# Editar .env con tus credenciales de BD
```

## 2️⃣ Iniciar

```bash
npm install        # Solo primera vez
npm run build      # Compilar
npm run dev        # Iniciar servidor
```

## 3️⃣ Probar

1. Abre tu plataforma PHP: `https://mazivoz.brandcode.com.mx`
2. **Login igual que antes** - No cambió nada
3. Ve a "Gestionar Instancias"
4. Clic en "Agregar Instancia"
5. Escanea el QR que aparece (igual que antes)
6. ¡Listo! Ya está conectado

## ✅ Verificar que Funciona

En la terminal del backend deberías ver:
```
[INFO] Servidor WPPConnect iniciado en puerto 3000
[user1] 📱 QR generado - Listo para escanear
[user1] ✅ Sesión conectada exitosamente
```

## 🔗 URLs Importantes

- **Backend API:** `http://localhost:3000/api`
- **Health Check:** `http://localhost:3000/health`
- **Frontend PHP:** `https://mazivoz.brandcode.com.mx` (igual que antes)

## ❓ ¿El login cambió?

**NO** - El login PHP sigue exactamente igual. Solo cambió el backend que maneja WhatsApp.

