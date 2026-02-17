import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceSvg = resolve(root, 'assets/brand/rat-icon-master.svg');
const outputDir = resolve(root, 'public/icons');

const iconTargets = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'maskable-192.png', size: 192 },
  { name: 'maskable-512.png', size: 512 },
];

await mkdir(outputDir, { recursive: true });

const rasterized = sharp(sourceSvg, { density: 512 });

await Promise.all(
  iconTargets.map(async ({ name, size }) => {
    const outputPath = resolve(outputDir, name);
    await mkdir(dirname(outputPath), { recursive: true });
    await rasterized
      .clone()
      .resize(size, size, {
        fit: 'cover',
      })
      .png({ quality: 100, compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);
  })
);

console.log(`Generated ${iconTargets.length} icons in ${outputDir}`);
