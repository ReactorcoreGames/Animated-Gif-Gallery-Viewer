@echo off
REM ============================================================================
REM  Animated GIF Gallery Viewer - release packager
REM
REM  Assembles dist\animated-gif-gallery-viewer\ from the project files and
REM  zips it into dist\animated-gif-gallery-viewer.zip, ready to upload.
REM
REM  No dependencies: uses PowerShell's built-in Compress-Archive.
REM ============================================================================

setlocal enabledelayedexpansion

set "NAME=animated-gif-gallery-viewer"
set "ROOT=%~dp0"
set "DIST=%ROOT%dist"
set "OUT=%DIST%\%NAME%"
set "ZIP=%DIST%\%NAME%.zip"

echo.
echo  Animated GIF Gallery Viewer - building release
echo  ==============================================
echo.

REM --- sanity check: are we actually in the project folder? -------------------
if not exist "%ROOT%index.html" (
    echo  ERROR: index.html not found next to this script.
    echo  Run build_release.bat from the project root folder.
    goto :fail
)

REM --- clean any previous build ----------------------------------------------
if exist "%OUT%" (
    echo  Cleaning previous build...
    rmdir /s /q "%OUT%"
)
if exist "%ZIP%" del /q "%ZIP%"
mkdir "%OUT%" 2>nul

REM --- app files --------------------------------------------------------------
echo  Copying app files...
copy /y "%ROOT%index.html" "%OUT%\" >nul || goto :fail
copy /y "%ROOT%icon.ico"   "%OUT%\" >nul || goto :fail

xcopy /e /i /q /y "%ROOT%css" "%OUT%\css" >nul || goto :fail
xcopy /e /i /q /y "%ROOT%js"  "%OUT%\js"  >nul || goto :fail

REM --- documentation ----------------------------------------------------------
echo  Copying documentation...
copy /y "%ROOT%readme.md" "%OUT%\" >nul || goto :fail
copy /y "%ROOT%guide.md"  "%OUT%\" >nul || goto :fail
copy /y "%ROOT%promo.md"  "%OUT%\" >nul || goto :fail

REM --- promo folder -----------------------------------------------------------
REM  Included in the download on purpose: the offline copy doesn't strictly
REM  need it, but index.html references promo/icon_og.jpg and promo/modal.png,
REM  so leaving it out would break the header mark and the feature tour.
echo  Copying promo assets...
xcopy /e /i /q /y "%ROOT%promo" "%OUT%\promo" >nul || goto :fail

REM --- verify the two files index.html actually depends on --------------------
if not exist "%OUT%\promo\icon_og.jpg" (
    echo  ERROR: promo\icon_og.jpg missing - the header icon would break.
    goto :fail
)
if not exist "%OUT%\promo\modal.png" (
    echo  ERROR: promo\modal.png missing - the feature tour would break.
    goto :fail
)

REM --- zip it -----------------------------------------------------------------
echo  Creating zip...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Compress-Archive -Path '%OUT%' -DestinationPath '%ZIP%' -CompressionLevel Optimal -Force" || goto :fail

if not exist "%ZIP%" goto :fail

REM --- report -----------------------------------------------------------------
for %%A in ("%ZIP%") do set "SIZE=%%~zA"
set /a SIZEKB=!SIZE! / 1024

echo.
echo  ==============================================
echo   Done.
echo.
echo   Folder:  dist\%NAME%\
echo   Zip:     dist\%NAME%.zip  (!SIZEKB! KB)
echo.
echo   Upload the zip to itch.io / GitHub Releases.
echo  ==============================================
echo.
goto :end

:fail
echo.
echo  BUILD FAILED.
echo.
exit /b 1

:end
endlocal
exit /b 0
