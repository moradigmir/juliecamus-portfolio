// This script requires ffmpeg to be installed
// Install with: choco install ffmpeg  (Windows)
// Or: winget install Gyan.FFmpeg
// Or download from: https://ffmpeg.org/download.html

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = [
  {
    input: 'public/media/hidrive/40/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4',
    output: 'public/media/hidrive/40/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4.tmp.mp4'
  },
  {
    input: 'public/media/hidrive/42/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4',
    output: 'public/media/hidrive/42/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4.tmp.mp4'
  },
  {
    input: 'public/media/hidrive/50/50.mp4',
    output: 'public/media/hidrive/50/50.mp4.tmp.mp4'
  },
  {
    input: 'public/media/hidrive/60/DIOR_JEWELS_NOEL_23_MAIN_FILM_1-1_VA_20231107 copie.mp4',
    output: 'public/media/hidrive/60/DIOR_JEWELS_NOEL_23_MAIN_FILM_1-1_VA_20231107 copie.mp4.tmp.mp4'
  }
];

async function compressVideo(input, output) {
  return new Promise((resolve, reject) => {
    console.log(`Compressing ${input}...`);
    
    const args = [
      '-i', input,
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '24',
      '-maxrate', '6826k',
      '-bufsize', '13652k',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-y',
      output
    ];

    const child = spawn('ffmpeg', args);
    
    child.stdout.on('data', (data) => {
      // FFmpeg outputs to stderr, not stdout
    });

    child.stderr.on('data', (data) => {
      process.stdout.write('.');
    });

    child.on('close', (code) => {
      if (code === 0) {
        const originalSize = fs.statSync(input).size;
        const newSize = fs.statSync(output).size;
        const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
        console.log(`\n✓ Reduced from ${(originalSize/1024/1024).toFixed(2)}MB to ${(newSize/1024/1024).toFixed(2)}MB (${reduction}% reduction)`);
        resolve();
      } else {
        console.log(`\n✗ Failed to compress ${input}`);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`\n✗ Error: ${error.message}`);
      console.log('\nPlease install ffmpeg:');
      console.log('  - Windows: choco install ffmpeg OR winget install Gyan.FFmpeg');
      console.log('  - Or download from: https://ffmpeg.org/download.html');
      reject(error);
    });
  });
}

async function main() {
  console.log('Starting video compression...\n');
  
  for (const file of files) {
    try {
      await compressVideo(file.input, file.output);
      
      // Replace original with compressed version
      fs.unlinkSync(file.input);
      fs.renameSync(file.output, file.input);
      console.log(`✓ Replaced original file\n`);
      
    } catch (error) {
      console.error(`Failed to compress ${file.input}:`, error.message);
      console.log('Continuing with next file...\n');
    }
  }
  
  console.log('Compression complete!');
  console.log('Run: npm run build:manifest to update the media manifest');
}

main().catch(console.error);
