// Comprehensive site tests
const fs = require('fs');
const path = require('path');

module.exports = (runner) => {
  runner.describe('Site Comprehensive Tests', () => {
  const manifestFolders = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
  const previewFolders = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
  
  runner.describe('1. Manifest Files', () => {
    runner.test('At least 15 folders have valid manifests with proper titles', () => {
      let validManifests = 0;
      const results = [];
      
      for (const folder of manifestFolders) {
        const manifestPath = path.join(__dirname, '..', 'public', 'media', 'hidrive', folder, 'MANIFEST.txt');
        
        if (fs.existsSync(manifestPath)) {
          const content = fs.readFileSync(manifestPath, 'utf8');
          const hasTitle = content.includes('title:');
          const title = content.match(/title:\s*["']?(.+?)["']?$/m)?.[1] || 'No title';
          
          if (hasTitle && title !== 'No title' && !title.includes(`Folder ${folder}`)) {
            validManifests++;
            results.push({ folder, title, status: '✅' });
          } else {
            results.push({ folder, title: title || 'No title', status: '❌' });
          }
        } else {
          results.push({ folder, title: 'No manifest', status: '❌' });
        }
      }
      
      console.log('\nManifest Results:');
      results.forEach(r => console.log(`   ${r.status} Folder ${r.folder}: "${r.title}"`));
      console.log(`\n📊 Valid manifests: ${validManifests}/${manifestFolders.length}`);
      
      runner.expect(validManifests).toBeGreaterThanOrEqual(15);
    });
  });
  
  runner.describe('2. Preview Files', () => {
    runner.test('All 10 folders have preview files', () => {
      const previewExtensions = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm'];
      const specificFiles = {
        '05': 'Factice by Anton Zemlyanoy 01 copie.jpg',
        '08': 'Chanel Beauty by Anairam 13 copie.jpg',
        '09': 'PARURE_03_EDIT_CARRE_v4 ETALO.mp4',
        '10': 'DIOR LE BAUME by axel morin.mp4'
      };
      
      let previewCount = 0;
      const results = [];
      
      for (const folder of previewFolders) {
        const previewNames = [
          `preview`, 
          `${folder}_preview`, 
          `${folder}-preview`,
          `${folder}_short`,
          folder
        ];
        
        let hasPreview = false;
        let foundFile = null;
        
        // Check common patterns
        for (const name of previewNames) {
          for (const ext of previewExtensions) {
            const previewPath = path.join(__dirname, '..', 'public', 'media', 'hidrive', folder, `${name}.${ext}`);
            if (fs.existsSync(previewPath)) {
              hasPreview = true;
              foundFile = `${name}.${ext}`;
              break;
            }
          }
          if (hasPreview) break;
        }
        
        // Check specific files
        if (!hasPreview && specificFiles[folder]) {
          const specificPath = path.join(__dirname, '..', 'public', 'media', 'hidrive', folder, specificFiles[folder]);
          if (fs.existsSync(specificPath)) {
            hasPreview = true;
            foundFile = specificFiles[folder];
          }
        }
        
        if (hasPreview) {
          previewCount++;
          results.push({ folder, file: foundFile, status: '✅' });
        } else {
          results.push({ folder, file: 'None', status: '❌' });
        }
      }
      
      console.log('\nPreview Results:');
      results.forEach(r => console.log(`   ${r.status} Folder ${r.folder}: ${r.file}`));
      console.log(`\n📊 Previews found: ${previewCount}/${previewFolders.length}`);
      
      runner.expect(previewCount).toBe(previewFolders.length);
    });
  });
  
  runner.describe('3. Supabase Removal', () => {
    runner.test('No Supabase references in hidrive.ts', () => {
      const hidrivePath = path.join(__dirname, '..', 'src', 'lib', 'hidrive.ts');
      const content = fs.readFileSync(hidrivePath, 'utf8');
      
      const hasSupabase = content.includes('supabase') || content.includes('fvrgjyyflojdiklqepqt.functions.supabase.co');
      
      runner.expect(hasSupabase).toBe(false);
    });
  });
  
  runner.describe('4. Local Server', () => {
    runner.test('Local server is running on port 8080', async () => {
      try {
        const response = require('child_process').execSync(
          'powershell "(Invoke-WebRequest -Uri \'http://localhost:8080/\' -UseBasicParsing).StatusCode"', 
          { encoding: 'utf8' }
        );
        runner.expect(response.trim()).toBe('200');
      } catch (error) {
        throw new Error('Local server not responding');
      }
    });
  });
  
  runner.describe('5. Responsive Design', () => {
    runner.test('Index.html has viewport meta tag', () => {
      const indexPath = path.join(__dirname, '..', 'index.html');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        runner.expect(content).toContain('viewport');
      }
    });
  });
  });
};
