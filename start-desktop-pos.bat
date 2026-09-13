@echo off
title Odhavram POS Desktop
cd /d "%~dp0"

if exist "release\Odhavram POS 0.1.0.exe" (
    echo Starting Odhavram General Store POS Desktop App (.exe)...
    start "" "release\Odhavram POS 0.1.0.exe"
    exit /b
)

if exist "release\win-unpacked\Odhavram POS.exe" (
    echo Starting Odhavram General Store POS Desktop App...
    start "" "release\win-unpacked\Odhavram POS.exe"
    exit /b
)

echo Starting Odhavram General Store POS via Electron...
npx electron .

