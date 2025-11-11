@echo off
echo Compressing videos for free hosting...
echo.

REM Try common ffmpeg locations
set FFMPEG_PATH=
if exist "C:\Program Files\ffmpeg\bin\ffmpeg.exe" set FFMPEG_PATH="C:\Program Files\ffmpeg\bin\ffmpeg.exe"
if exist "C:\ProgramData\chocolatey\bin\ffmpeg.exe" set FFMPEG_PATH="C:\ProgramData\chocolatey\bin\ffmpeg.exe"
if exist "%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0-full_build\bin\ffmpeg.exe" set FFMPEG_PATH="%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0-full_build\bin\ffmpeg.exe"

if "%FFMPEG_PATH%"=="" (
    echo ERROR: ffmpeg not found. Please install ffmpeg first:
    echo   winget install Gyan.FFmpeg
    echo   OR choco install ffmpeg
    echo   OR download from https://ffmpeg.org/download.html
    pause
    exit /b 1
)

echo Using ffmpeg at: %FFMPEG_PATH%
echo.

REM Compress video 40 (already done)
if exist "public/media/hidrive/40/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4.tmp.mp4" (
    del "public/media/hidrive/40/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4"
    rename "public/media/hidrive/40/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4.tmp.mp4" "DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4"
    echo ✓ Video 40 compressed
)

REM Compress video 42
echo Compressing 42/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4...
%FFMPEG_PATH% -i "public/media/hidrive/42/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4" -c:v libx264 -preset slow -crf 24 -maxrate 6826k -bufsize 13652k -c:a aac -b:a 128k -y "public/media/hidrive/42/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4.tmp.mp4"
if exist "public/media/hidrive/42/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4.tmp.mp4" (
    del "public/media/hidrive/42/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4"
    rename "public/media/hidrive/42/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4.tmp.mp4" "DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4"
    echo ✓ Video 42 compressed
) else (
    echo ✗ Failed to compress video 42
)

REM Compress video 50
echo Compressing 50/50.mp4...
%FFMPEG_PATH% -i "public/media/hidrive/50/50.mp4" -c:v libx264 -preset slow -crf 24 -maxrate 6826k -bufsize 13652k -c:a aac -b:a 128k -y "public/media/hidrive/50/50.mp4.tmp.mp4"
if exist "public/media/hidrive/50/50.mp4.tmp.mp4" (
    del "public/media/hidrive/50/50.mp4"
    rename "public/media/hidrive/50/50.mp4.tmp.mp4" "50.mp4"
    echo ✓ Video 50 compressed
) else (
    echo ✗ Failed to compress video 50
)

REM Compress video 60
echo Compressing 60/DIOR_JEWELS_NOEL_23_MAIN_FILM_1-1_VA_20231107 copie.mp4...
%FFMPEG_PATH% -i "public/media/hidrive/60/DIOR_JEWELS_NOEL_23_MAIN_FILM_1-1_VA_20231107 copie.mp4" -c:v libx264 -preset slow -crf 24 -maxrate 6826k -bufsize 13652k -c:a aac -b:a 128k -y "public/media/hidrive/60/DIOR_JEWELS_NOEL_23_MAIN_FILM_1-1_VA_20231107 copie.mp4.tmp.mp4"
if exist "public/media/hidrive/60/DIOR_JEWELS_NOEL_23_MAIN_FILM_1-1_VA_20231107 copie.mp4.tmp.mp4" (
    del "public/media/hidrive/60/DIOR_JEWELS_NOEL_23_MAIN_FILM_1-1_VA_20231107 copie.mp4"
    rename "public/media/hidrive/60/DIOR_JEWELS_NOEL_23_MAIN_FILM_1-1_VA_20231107 copie.mp4.tmp.mp4" "DIOR_JEWELS_NOEL_23_MAIN_FILM_1-1_VA_20231107 copie.mp4"
    echo ✓ Video 60 compressed
) else (
    echo ✗ Failed to compress video 60
)

echo.
echo Compression complete!
echo Run: npm run build:manifest
pause
