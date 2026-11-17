@echo off
chcp 65001 >nul
title ArchSchool - Fast Local APK Builder
echo ====================================================
echo        ArchSchool Ultra-Fast Android APK Builder
echo ====================================================

set "JAVA_HOME=D:\Android\jbr"
set "ANDROID_HOME=C:\Users\sepeh\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

cd /d "%~dp0android"

echo.
echo Select the type of APK you want to build:
echo.
echo   1) [FAST DEBUG]    For instant testing on Emulator/Phone (Fastest)
echo   2) [STANDALONE RELEASE] Standalone APK (Self-contained, works everywhere)
echo   3) [FULL UNIVERSAL] Universal Debug APK (All architectures)
echo.
choice /C 123 /N /M "Choose [1, 2, or 3]: "

if errorlevel 3 goto universal_debug
if errorlevel 2 goto release_build
if errorlevel 1 goto fast_debug

:fast_debug
echo.
echo ====================================================
echo [MODE] Building Fast Debug APK (arm64-v8a + x86_64)...
echo ====================================================
echo.
call gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64 --build-cache --parallel
set "APK_PATH=%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
goto check_result

:release_build
echo.
echo ====================================================
echo [MODE] Building Standalone Release APK (Self-contained)...
echo ====================================================
echo.
call gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 --build-cache --parallel
set "APK_PATH=%~dp0android\app\build\outputs\apk\release\app-release.apk"
goto check_result

:universal_debug
echo.
echo ====================================================
echo [MODE] Building Full Universal APK (All architectures)...
echo ====================================================
echo.
call gradlew.bat assembleDebug --build-cache --parallel
set "APK_PATH=%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
goto check_result

:check_result
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================================
    echo [SUCCESS] APK built successfully!
    echo Output: %APK_PATH%
    echo ====================================================
    echo.
    choice /M "Do you want to install and launch on connected emulator/device?"
    if errorlevel 2 goto end
    if errorlevel 1 (
        echo Installing APK to device/emulator...
        adb install -r "%APK_PATH%"
        echo Launching ArchSchool...
        adb shell monkey -p archschool.vidxsepehr.ir -c android.intent.category.LAUNCHER 1
    )
) else (
    echo.
    echo ====================================================
    echo [ERROR] Build failed. Check the error log above.
    echo ====================================================
)

:end
echo.
pause
