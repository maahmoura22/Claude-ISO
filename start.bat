@echo off
title Sistema Gestao Engenharia ISO
echo ============================================================
echo   SISTEMA DE GESTAO - ENGENHARIA METALURGICA ISO
echo ============================================================
echo.

:: Verifica Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado.
    echo Instale em: https://python.org/downloads
    echo Marque "Add Python to PATH" na instalacao.
    pause
    exit /b 1
)

:: Instala dependencias
echo Instalando dependencias...
pip install flask --quiet

:: Inicia servidor
echo.
echo Iniciando servidor...
echo Acesse: http://localhost:5000
echo Pressione Ctrl+C para encerrar.
echo.
start "" http://localhost:5000
python app.py
pause
