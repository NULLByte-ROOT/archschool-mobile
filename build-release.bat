@echo off
chcp 65001 >nul
title ArchSchool - Standalone Release APK Builder
echo =========================================================
echo       ArchSchool Mobile - Standalone Release Build
echo =========================================================

set "JAVA_HOME=D:\Android\jbr"
set "ANDROID_HOME=C:\Users\sepeh\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

cd /d "%~dp0android"

echo.
echo [1/2] Compiling Native Code and Bundling Assets (ARM64)...
call gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --build-cache --parallel

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =========================================================
    echo [SUCCESS] Standalone Release APK built successfully!
    echo Output: %~dp0android\app\build\outputs\apk\release\app-release.apk
    echo =========================================================
    echo.
    choice /M "Do you want to install it on connected phone via ADB?"
    if errorlevel 2 goto end
    if errorlevel 1 (
        echo Installing APK...
        adb install -r "%~dp0android\app\build\outputs\apk\release\app-release.apk"
        echo Launching ArchSchool...
        adb shell monkey -p archschool.vidxsepehr.ir -c android.intent.category.LAUNCHER 1
    )
) else (
    echo.
    echo =========================================================
    echo [ERROR] Build failed! Check the log above.
    echo =========================================================
)

:end
echo.
pause
