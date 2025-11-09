const fs = require('fs');
const path = require('path');

const filesToCompress = [
  'public/media/hidrive/40/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4',
  'public/media/hidrive/42/DIOR HOLIDY NEIGE BY ELINA KECHICHEVA.mp4', 
  'public/media/hidrive/50/50.mp4',
  'public/media/hidrive/60/DIOR_JEWELS_NOEL_23_MAIN_FILM_1-1_VA_20231107 copie.mp4',
  'public/media/hidrive/58/2023_10_13_DIOR_HOLDSTOCK_04_0068.jpg',
  'public/media/hidrive/58/preview'
];

console.log('Files that need compression for free hosting:\n');

for (const filePath of filesToCompress) {
  try {
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const ext = path.extname(filePath).toLowerCase();
    
    console.log(`📁 ${filePath}`);
    console.log(`   Size: ${sizeMB} MB`);
    
    if (['.mp4', '.mov', '.webm', '.avi'].includes(ext)) {
      console.log('   Type: Video');
      console.log('   Options:');
      console.log('     1. Upload to https://cloudconvert.com/mp4-compressor');
      console.log('     2. Use ffmpeg after installation');
      console.log('     3. Upload to YouTube/Vimeo and embed instead');
    } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      console.log('   Type: Image');
      console.log('   Options:');
      console.log('     1. Upload to https://squoosh.app/');
      console.log('     2. Use https://tinypng.com/');
      console.log('     3. Use ImageMagick: magick input.jpg -quality 85 output.jpg');
    } else {
      console.log('   Type: Unknown');
      console.log('   Options: Check file type and choose appropriate tool');
    }
    console.log('');
  } catch (error) {
    console.log(`❌ File not found: ${filePath}\n`);
  }
}

console.log('Quick workflow:');
console.log('1. For videos: Use CloudConvert -> Target size: 40-45MB');
console.log('2. For images: Use Squoosh -> Quality: 80-85%');
console.log('3. Replace original files with compressed versions');
console.log('4. Run: npm run build:manifest');
console.log('5. Commit changes and deploy\n');

console.log('Alternative: Move large videos to external CDN');
console.log('- Upload to YouTube (unlisted)');
console.log('- Replace video files with YouTube embed');
console.log('- Or use Vimeo/Cloudflare R2 for direct hosting');
