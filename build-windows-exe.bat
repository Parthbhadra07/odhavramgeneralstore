@echo off
echo ===================================================
echo   Odhavram General Store - Building Windows EXE
echo ===================================================
echo.
echo Step 1: Building production static POS bundle...
call npm run build:mobile
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Next.js production build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Step 2: Packaging standalone Windows .exe...
call npx electron-builder --config electron-builder.json
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] EXE packaging failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [SUCCESS] Windows .EXE generated in the "release" folder!
echo You can find:
echo  1. Portable EXE: release\Odhavram POS <version>.exe (share this single file directly!)
echo  2. Setup Installer: release\Odhavram POS Setup <version>.exe
echo ===================================================
pause
