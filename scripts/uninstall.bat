@echo off
setlocal EnableExtensions

set "EXTENSION_ID=com.rendertom.flow.v2"
set "TARGET_DIR=%APPDATA%\Adobe\CEP\extensions\%EXTENSION_ID%"

echo Uninstalling Flow by leylin...
if not exist "%TARGET_DIR%" (
    echo Flow is not installed in the current user profile.
    pause
    exit /b 0
)

choice /M "Remove Flow from this computer"
if errorlevel 2 exit /b 0

rmdir /S /Q "%TARGET_DIR%"
if exist "%TARGET_DIR%" (
    echo ERROR: Could not remove the extension folder.
    echo Close After Effects and run this file again.
    pause
    exit /b 1
)

echo Flow was uninstalled successfully.
echo Any existing CEP debug settings were left unchanged.
pause
exit /b 0
