#!/usr/bin/env node

/**
 * Quick deployment script for testing phase
 * Sets up environment and deploys with protection
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Testing Phase Deployment...\n');

// Check if we're in the frontend directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Please run this script from the frontend directory');
  process.exit(1);
}

// Create .env.local if it doesn't exist
if (!fs.existsSync('.env.local')) {
  console.log('📝 Creating .env.local...');
  fs.copyFileSync('.env.testing', '.env.local');
}

try {
  // Build the project
  console.log('🔨 Building project...');
  execSync('npm run build', { stdio: 'inherit' });

  // Deploy to Cloudflare Pages
  console.log('\n🌐 Deploying to Cloudflare Pages...');
  execSync('npx wrangler pages deploy build --project-name thereplay', { stdio: 'inherit' });

  console.log('\n✅ Deployment complete!');
  console.log('\n🔐 Next Steps:');
  console.log('1. Set environment variables in Cloudflare Dashboard:');
  console.log('   - BASIC_AUTH_USERNAME=admin');
  console.log('   - BASIC_AUTH_PASSWORD=your-secure-password');
  console.log('   - TESTING_MODE=true');
  console.log('\n2. Test your deployment with credentials');
  console.log('\n3. Verify protection is working with the checklist in TESTING_PROTECTION_SETUP.md');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}