# Decode URL-encoded filenames in the media directory
$mediaDir = "public\media\hidrive"
$files = Get-ChildItem $mediaDir -Recurse -File | Where-Object { $_.Name -like '*%*' }

Write-Host "Found $($files.Count) files with URL-encoded names"
Write-Host "Decoding filenames..."

foreach ($file in $files) {
    try {
        # Decode the filename
        $decoded = [System.Web.HttpUtility]::UrlDecode($file.Name)
        $newPath = Join-Path $file.DirectoryName $decoded
        
        # Skip if already exists (safety check)
        if (Test-Path $newPath) {
            Write-Host "  SKIP: $decoded (already exists)"
            continue
        }
        
        # Rename the file
        Rename-Item -Path $file.FullName -NewName $decoded -ErrorAction Stop
        Write-Host "  OK: $($file.Name) -> $decoded"
    }
    catch {
        Write-Host "  ERROR renaming $($file.Name): $_" -ForegroundColor Red
    }
}

Write-Host "`nDone! Renamed files."
