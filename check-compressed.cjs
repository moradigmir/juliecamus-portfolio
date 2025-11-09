const fs = require('fs');
const path = require('path');

const mediaDir = 'public/media/hidrive';
const dirs = ['40', '42', '50', '60'];

console.log('Checking compressed files...\n');

for (const dir of dirs) {
  const dirPath = path.join(mediaDir, dir);
  const files = fs.readdirSync(dirPath);
  
  const original = files.find(f => !f.includes('.tmp.'));
  const compressed = files.find(f => f.includes('.tmp.'));
  
  if (original && compressed) {
    const originalPath = path.join(dirPath, original);
    const compressedPath = path.join(dirPath, compressed);
    
    const originalSize = fs.statSync(originalPath).size;
    const compressedSize = fs.statSync(compressedPath).size;
    
    const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    console.log(`📁 ${dir}/`);
    console.log(`   Original: ${(originalSize/1024/1024).toFixed(2)} MB`);
    console.log(`   Compressed: ${(compressedSize/1024/1024).toFixed(2)} MB`);
    console.log(`   Reduction: ${reduction}%`);
    console.log(`   Status: Ready to replace\n`);
  }
}

console.log('Run compress-videos.bat to complete the process');
console.log('Then run: npm run build:manifest');
