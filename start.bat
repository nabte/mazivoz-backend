@echo off
echo ========================================
echo   Backend WPPConnect - Iniciando...
echo ========================================
echo.

REM Verificar si existe .env
if not exist .env (
    echo [ERROR] Archivo .env no encontrado!
    echo Copiando .env.example a .env...
    copy .env.example .env
    echo.
    echo [IMPORTANTE] Edita el archivo .env con tus credenciales antes de continuar
    pause
    exit /b 1
)

REM Verificar si node_modules existe
if not exist node_modules (
    echo Instalando dependencias...
    call npm install
    echo.
)

REM Compilar TypeScript
echo Compilando TypeScript...
call npm run build
if errorlevel 1 (
    echo [ERROR] Error al compilar
    pause
    exit /b 1
)
echo.

REM Iniciar servidor
echo ========================================
echo   Servidor iniciando en modo desarrollo
echo   Presiona Ctrl+C para detener
echo ========================================
echo.
call npm run dev

