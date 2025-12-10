#!/bin/bash

echo "========================================"
echo "  Backend WPPConnect - Iniciando..."
echo "========================================"
echo ""

# Verificar si existe .env
if [ ! -f .env ]; then
    echo "[ERROR] Archivo .env no encontrado!"
    echo "Copiando .env.example a .env..."
    cp .env.example .env
    echo ""
    echo "[IMPORTANTE] Edita el archivo .env con tus credenciales antes de continuar"
    exit 1
fi

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias..."
    npm install
    echo ""
fi

# Compilar TypeScript
echo "Compilando TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "[ERROR] Error al compilar"
    exit 1
fi
echo ""

# Iniciar servidor
echo "========================================"
echo "  Servidor iniciando en modo desarrollo"
echo "  Presiona Ctrl+C para detener"
echo "========================================"
echo ""
npm run dev

