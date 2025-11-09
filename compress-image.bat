@echo off
echo Compressing images for free hosting...
echo.

REM Try common magick locations
set MAGICK_PATH=
if exist "C:\Program Files\ImageMagick-7.1.1-Q16-HDRI\magick.exe" set MAGICK_PATH="C:\Program Files\ImageMagick-7.1.1-Q16-HDRI\magick.exe"
if exist "C:\ProgramData\chocolatey\bin\magick.exe" set MAGICK_PATH="C:\ProgramData\chocolatey\bin\magick.exe"

if "%MAGICK_PATH%"=="" (
    echo WARNING: ImageMagick not found. Please install ImageMagick first:
    echo   winget install ImageMagick.ImageMagick
    echo   OR choco install imagemagick.app
    echo   OR download from https://imagemagick.org/script/download.php
    echo.
    echo Alternative: Use online tools like https://squoosh.app/
    echo.
    pause
    exit /b 1
)

echo Using ImageMagick at: %MAGICK_PATH%
echo.

REM Compress the large image
echo Compressing 58/2023_10_13_DIOR_HOLDSTOCK_04_0068.jpg...
%MAGICK_PATH% "public/media/hidrive/58/2023_10_13_DIOR_HOLDSTOCK_04_0068.jpg" -quality 85 -strip "public/media/hidrive/58/2023_10_13_DIOR_HOLDSTOCK_04_0068.jpg.tmp.jpg"
if exist "public/media/hidrive/58/2023_10_13_DIOR_HOLDSTOCK_04_0068.jpg.tmp.jpg" (
    del "public/media/hidrive/58/2023_10_13_DIOR_HOLDSTOCK_04_0068.jpg"
    rename "public/media/hidrive\58\2023_10_13_DIOR_HOLDSTOCK_04_0068.jpg.tmp.jpg" "2023_10_13_DIOR_HOLDSTOCK_04_0068.jpg"
    echo ✓ Image compressed
) else (
    echo ✗ Failed to compress image
)

echo.
echo Compression complete!
echo Run: npm run build:manifest
pause
