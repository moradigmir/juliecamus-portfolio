const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Check which deployment platform to use
const platform = process.env.DEPLOY_PLATFORM || 'cloudflare';

console.log(`🚀 Starting deployment to ${platform === 'cloudflare' ? 'Cloudflare Pages' : 'Netlify'}...\n`);

// Count files in dist
function countFiles(dir) {
  let count = 0;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

// Check if URL is accessible
function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

try {
  // Build the project
  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Count files before deployment
  const distPath = path.join(__dirname, 'dist');
  const totalFiles = countFiles(distPath);
  const mediaFiles = countFiles(path.join(distPath, 'media'));
  
  console.log(`\n📊 Build Summary:`);
  console.log(`   Total files: ${totalFiles}`);
  console.log(`   Media files: ${mediaFiles}`);
  
  // Deploy
  let deployOutput, siteUrl;
  
  if (platform === 'cloudflare') {
    console.log('\n🌐 Deploying to Cloudflare Pages...');
    console.log('   Uploading 237 files (454 MB)...\n');
    
    try {
      deployOutput = execSync('npx wrangler pages deploy dist --project-name=juliecamus-portfolio', { 
        encoding: 'utf8',
        stdio: 'inherit',
        maxBuffer: 1024 * 1024 * 100
      });
      
      // Cloudflare Pages URL format
      siteUrl = 'https://juliecamus-portfolio.pages.dev';
    } catch (e) {
      console.log('\n⚠️  Cloudflare deployment may need authentication');
      console.log('   Run: npx wrangler login');
      throw e;
    }
  } else {
    console.log('\n🌐 Deploying to Netlify...');
    console.log('   Uploading 237 files (454 MB)...\n');
    
    deployOutput = execSync('netlify deploy --prod --dir=dist', { 
      encoding: 'utf8',
      stdio: 'inherit',
      maxBuffer: 1024 * 1024 * 100
    });
    
    // Extract URL from output
    const urlMatch = deployOutput.match(/https:\/\/[a-z0-9-]+\.netlify\.app/);
    siteUrl = urlMatch ? urlMatch[0] : null;
    
    if (!siteUrl) {
      console.log('\n⚠️  Could not extract site URL from deployment output');
      console.log('Check https://app.netlify.com for your deployment');
      process.exit(0);
    }
  }
  
  console.log('\n✅ Deployment complete!');
  console.log(`\n🌍 Site URL: ${siteUrl}`);
  
  // Wait a moment for CDN to propagate
  console.log('\n⏳ Waiting 5 seconds for CDN propagation...');
  execSync('timeout 5', { stdio: 'ignore' }).catch(() => {});
  
  // Verify deployment
  console.log('\n🔍 Verifying deployment...');
  
  (async () => {
    // Check manifest
    const manifestUrl = `${siteUrl}/media.manifest.json`;
    const manifestOk = await checkUrl(manifestUrl);
    console.log(`   ${manifestOk ? '✅' : '❌'} Manifest: ${manifestUrl}`);
    
    // Check a few sample media files
    const sampleFiles = [
      '/media/hidrive/01/preview.jpg',
      '/media/hidrive/04/preview.png',
      '/media/hidrive/05/Factice%20by%20Anton%20Zemlyanoy%2001%20copie.jpg'
    ];
    
    let mediaOk = 0;
    for (const file of sampleFiles) {
      const fileUrl = `${siteUrl}${file}`;
      const ok = await checkUrl(fileUrl);
      if (ok) mediaOk++;
      console.log(`   ${ok ? '✅' : '❌'} ${file}`);
    }
    
    console.log(`\n📊 Verification Summary:`);
    console.log(`   Manifest: ${manifestOk ? 'OK' : 'FAILED'}`);
    console.log(`   Sample media files: ${mediaOk}/${sampleFiles.length} accessible`);
    
    if (manifestOk && mediaOk === sampleFiles.length) {
      console.log('\n🎉 Deployment verified successfully!');
      console.log(`\n🔗 Visit your site: ${siteUrl}`);
    } else {
      console.log('\n⚠️  Some files may not be accessible yet. Wait a minute and check:');
      console.log(`   ${siteUrl}`);
    }
  })();
  
} catch (error) {
  console.error('\n❌ Deployment failed:', error.message);
  console.log('\n💡 Alternative: Deploy manually via Netlify Drop');
  console.log('   1. Go to https://app.netlify.com/drop');
  console.log('   2. Drag the "dist" folder onto the page');
  process.exit(1);
}
