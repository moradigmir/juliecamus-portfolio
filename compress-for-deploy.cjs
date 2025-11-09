const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FFMPEG_PATH = 'C:\\Users\\bsartek\\OneDrive - Green Remarket\\Documents\\dev\\Hannah\\ffmpeg_temp\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe';

const MAX_SIZE_MB = 24;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function findLargeFiles(dir) {
  const largeFiles = [];
  
  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.size > MAX_SIZE_BYTES && /\.(mp4|mov|webm)$/i.test(item)) {
        largeFiles.push({
          path: fullPath,
          sizeMB: (stat.size / (1024 * 1024)).toFixed(2)
        });
      }
    }
  }
  
  scan(dir);
  return largeFiles;
}

async function compressVideo(inputPath) {
  return new Promise((resolve, reject) => {
    const tempOutput = inputPath + '.compressed.mp4';
    
    console.log(`  Compressing ${path.basename(inputPath)} (${(fs.statSync(inputPath).length / (1024 * 1024)).toFixed(2)} MB)...`);
    
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '28',
      '-maxrate', '4M',
      '-bufsize', '8M',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      '-y',
      tempOutput
    ];

    const child = spawn(FFMPEG_PATH, args, { stdio: 'pipe' });
    
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`    ❌ FFmpeg failed: ${stderr.slice(-200)}`);
        reject(new Error(`FFmpeg exited with code ${code}`));
        return;
      }
      
      const newSize = fs.statSync(tempOutput).length;
      const newSizeMB = (newSize / (1024 * 1024)).toFixed(2);
      
      if (newSize > MAX_SIZE_BYTES) {
        console.log(`    ⚠️  Still too large (${newSizeMB} MB), trying higher compression...`);
        fs.unlinkSync(tempOutput);
        
        // Try again with more aggressive compression
        const args2 = [
          '-i', inputPath,
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '32',
          '-maxrate', '2M',
          '-bufsize', '4M',
          '-c:a', 'aac',
          '-b:a', '64k',
          '-movflags', '+faststart',
          '-y',
          tempOutput
        ];
        
        const child2 = spawn(FFMPEG_PATH, args2, { stdio: 'pipe' });
        child2.on('close', (code2) => {
          if (code2 !== 0) {
            reject(new Error(`FFmpeg second attempt failed`));
            return;
          }
          
          const finalSize = fs.statSync(tempOutput).length;
          const finalSizeMB = (finalSize / (1024 * 1024)).toFixed(2);
          
          // Replace original with compressed
          fs.unlinkSync(inputPath);
          fs.renameSync(tempOutput, inputPath);
          
          console.log(`    ✅ Compressed to ${finalSizeMB} MB`);
          resolve();
        });
      } else {
        // Replace original with compressed
        fs.unlinkSync(inputPath);
        fs.renameSync(tempOutput, inputPath);
        
        console.log(`    ✅ Compressed to ${newSizeMB} MB`);
        resolve();
      }
    });
  });
}

async function main() {
  console.log('🔍 Finding videos larger than 24MB...\n');
  
  const mediaDir = path.join(__dirname, 'public', 'media', 'hidrive');
  const largeFiles = findLargeFiles(mediaDir);
  
  if (largeFiles.length === 0) {
    console.log('✅ No videos over 24MB found!');
    return;
  }
  
  console.log(`Found ${largeFiles.length} large video(s):\n`);
  largeFiles.forEach(file => {
    console.log(`  ${path.basename(file.path)} - ${file.sizeMB} MB`);
  });
  
  console.log('\n🎬 Compressing videos...\n');
  
  for (const file of largeFiles) {
    try {
      await compressVideo(file.path);
    } catch (error) {
      console.error(`  ❌ Failed to compress ${path.basename(file.path)}: ${error.message}`);
    }
  }
  
  console.log('\n✅ All videos compressed!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
