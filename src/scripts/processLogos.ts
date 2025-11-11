import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const INPUT_DIR = path.join(process.cwd(), 'public', 'logos-raw');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'logos');

// Target dimensions for all logos
const TARGET_WIDTH = 200;
const TARGET_HEIGHT = 120;

async function processLogos() {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all PNG files from input directory
  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.png'));
  
  console.log(`📦 Processing ${files.length} logos...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const inputPath = path.join(INPUT_DIR, file);
    
    // Generate clean output filename: logo-001.png, logo-002.png, etc.
    const outputFilename = `logo-${String(i + 1).padStart(3, '0')}.png`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    try {
      await sharp(inputPath)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ ${file} → ${outputFilename}`);
    } catch (error) {
      console.error(`❌ Failed to process ${file}:`, error);
    }
  }

  console.log(`\n✨ Done! Processed ${files.length} logos to ${OUTPUT_DIR}`);
  console.log(`\n📋 All logos are now ${TARGET_WIDTH}x${TARGET_HEIGHT}px with transparent backgrounds`);
}

processLogos().catch(console.error);
