// Generate clean PWA icons from SVG using Sharp
// Run: node generate-icons.js

import { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, 'public/icons');

// Create a clean Pulse icon SVG (simple triangle/arrow design matching the app theme)
const iconSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0B0B12;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#131322;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#A855F7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Background circle (no white pixels anywhere) -->
  <circle cx="256" cy="256" r="256" fill="url(#bg)" />
  <!-- Main accent triangle/arrow pointing right (play symbol) -->
  <polygon points="180,160 180,352 352,256" fill="url(#accent)" />
  <!-- Subtle inner glow -->
  <polygon points="195,185 195,327 320,256" fill="url(#accent)" opacity="0.3" />
</svg>
`;

// Generate icons at multiple sizes
const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function generateIcons() {
  const svgBuffer = Buffer.from(iconSVG);

  for (const { name, size } of sizes) {
    const outputPath = resolve(outputDir, name);
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    console.log(`✅ Generated ${name} (${size}x${size})`);
  }

  // Also generate a maskable version with safe zone (80% of canvas)
  const maskableSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0B0B12;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#131322;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#A855F7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="256" cy="256" r="256" fill="url(#bg)" />
  <!-- Smaller triangle for maskable safe zone (80% = 410px diameter, 205px radius) -->
  <polygon points="205,185 205,327 330,256" fill="url(#accent)" />
</svg>
  `;

  const maskablePath = resolve(outputDir, 'icon-512-maskable.png');
  await sharp(Buffer.from(maskableSVG))
    .resize(512, 512, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(maskablePath);

  console.log(`✅ Generated icon-512-maskable.png (512x512) with safe zone`);

  console.log('\n✨ All icons generated successfully!');
  console.log('Next steps:');
  console.log('1. Copy fixed icons to dist/icons/ after build');
  console.log('2. Update manifest.webmanifest to use maskable icon if needed');
  console.log('3. Rebuild and test PWA');
}

generateIcons().catch(console.error);