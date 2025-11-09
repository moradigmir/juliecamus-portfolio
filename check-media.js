#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 MEDIA FILE AUDIT\n');

// Read manifest
const manifestPath = path.join(__dirname, 'public', 'media.manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

console.log(`📄 Manifest has ${manifest.items.length} items\n`);

const results = {
  total: 0,
  found: 0,
  missing: 0,
  missingFiles: []
};

// Normalize path like the runtime does
function normalizeMediaPath(input) {
  let p = (input ?? '').trim();
  if (!p) return '';
  
  // Strip hidrive:// protocol and authority
  if (p.startsWith('hidrive://')) {
    p = p.replace(/^hidrive:\/\/[^/]+/i, '');
  }
  
  // Ensure leading slash
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/{2,}/g, '/');
  
  // If starts with /public, strip it
  if (p.startsWith('/public')) {
    p = p.slice('/public'.length);
  }
  
  return p;
}

manifest.items.forEach((item, idx) => {
  console.log(`\n${idx + 1}. Folder ${item.folder}: "${item.title}"`);
  
  // Check preview
  const previewPath = normalizeMediaPath(item.previewUrl);
  const previewFile = path.join(__dirname, 'public', previewPath);
  
  const previewExists = fs.existsSync(previewFile);
  const previewSize = previewExists ? fs.statSync(previewFile).size : 0;
  
  console.log(`   Preview: ${item.previewUrl}`);
  console.log(`   → ${previewFile}`);
  console.log(`   → ${previewExists ? `✅ EXISTS (${previewSize} bytes)` : '❌ MISSING'}`);
  
  results.total++;
  if (previewExists && previewSize > 100) {
    results.found++;
  } else {
    results.missing++;
    results.missingFiles.push(previewFile);
  }
  
  // Check full
  const fullPath = normalizeMediaPath(item.fullUrl);
  const fullFile = path.join(__dirname, 'public', fullPath);
  
  const fullExists = fs.existsSync(fullFile);
  const fullSize = fullExists ? fs.statSync(fullFile).size : 0;
  
  console.log(`   Full: ${item.fullUrl}`);
  console.log(`   → ${fullFile}`);
  console.log(`   → ${fullExists ? `✅ EXISTS (${fullSize} bytes)` : '❌ MISSING'}`);
  
  results.total++;
  if (fullExists && fullSize > 100) {
    results.found++;
  } else {
    results.missing++;
    results.missingFiles.push(fullFile);
  }
});

console.log('\n\n📊 SUMMARY');
console.log(`Total files expected: ${results.total}`);
console.log(`Found (>100 bytes): ${results.found}`);
console.log(`Missing or too small: ${results.missing}`);

if (results.missing > 0) {
  console.log('\n❌ MISSING FILES:');
  results.missingFiles.forEach(f => console.log(`   ${f}`));
  console.log('\n💡 ACTION REQUIRED:');
  console.log('   Run: HIDRIVE_USERNAME=... HIDRIVE_PASSWORD=... npm run sync:hidrive');
  console.log('   Or manually copy media files to public/media/hidrive/');
}
