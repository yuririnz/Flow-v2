@echo off
setlocal EnableExtensions

set "EXTENSION_ID=com.rendertom.flow.v2"
set "SOURCE_DIR=%~dp0.."
set "INSTALL_ROOT=%APPDATA%\Adobe\CEP\extensions"
set "TARGET_DIR=%INSTALL_ROOT%\%EXTENSION_ID%"

echo Installing Flow by leylin...
if not exist "%SOURCE_DIR%\CSXS\manifest.xml" (
    echo ERROR: CSXS\manifest.xml was not found.
    pause
    exit /b 1
)

if not exist "%INSTALL_ROOT%" mkdir "%INSTALL_ROOT%"
robocopy "%SOURCE_DIR%" "%TARGET_DIR%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /XJ >nul
if errorlevel 8 (
    echo ERROR: Could not copy the extension files.
    pause
    exit /b 1
)

echo Flow was installed successfully.
echo Restart After Effects before opening the panel.
pause
exit /b 0
