const fs = require('fs');
const path = require('path');

function checkManifests() {
  const mediaDir = path.join(__dirname, 'public', 'media', 'hidrive');
  let corrupted = [];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (item === 'MANIFEST.txt') {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('<html') || content.includes('<!DOCTYPE')) {
            corrupted.push(fullPath);
            console.log(`❌ CORRUPTED: ${fullPath}`);
            console.log(`First 200 chars: ${content.substring(0, 200)}`);
            console.log('---');
          } else {
            console.log(`✅ OK: ${fullPath}`);
          }
        } catch (error) {
          console.log(`⚠️ ERROR reading: ${fullPath} - ${error.message}`);
        }
      }
    }
  }
  
  console.log('Scanning MANIFEST.txt files for HTML corruption...\n');
  scanDirectory(mediaDir);
  
  if (corrupted.length === 0) {
    console.log('\n✅ No corrupted MANIFEST files found!');
  } else {
    console.log(`\n❌ Found ${corrupted.length} corrupted MANIFEST files:`);
    corrupted.forEach(file => console.log(`  - ${file}`));
  }
}

checkManifests();
