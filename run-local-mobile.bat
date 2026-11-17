@echo off
chcp 65001 >nul
title ArchSchool - Local Mobile Dev (Metro / Fast Refresh)
echo ====================================================
echo        Starting ArchSchool Local Mobile Dev
echo ====================================================

cd /d "%~dp0"

set "ANDROID_HOME=C:\Users\sepeh\AppData\Local\Android\Sdk"
set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"

REM Forward ports to connected emulator/device so localhost:8000 routes to PC
adb reverse tcp:8000 tcp:8000 2>nul
adb reverse tcp:8081 tcp:8081 2>nul

echo.
echo [Config: LOCAL ISOLATED ENVIRONMENT]
echo - Backend URL: http://10.0.2.2:8000/api
echo - Live Reload: Active (Fast Refresh in milliseconds)
echo - Privacy:     100%% Local (No EAS build / No public deploy)
echo.
echo Tips:
echo   - Press 'a' to open on Android Emulator.
echo   - Press 'r' to reload the app.
echo ====================================================
echo.

set "EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api"
call npx.cmd expo start

pause
