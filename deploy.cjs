const { execSync } = require('child_process');

console.log('🚀 Starting deployment...');

try {
  // Build the project
  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Deploy to Vercel non-interactively
  console.log('🌐 Deploying to Vercel...');
  execSync('npx vercel --prod --yes', { stdio: 'inherit' });
  
  console.log('✅ Deployment complete!');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
