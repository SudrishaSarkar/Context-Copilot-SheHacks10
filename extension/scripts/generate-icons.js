#!/usr/bin/env node

/**
 * Simple icon generator for ContextCopilot extension
 * Generates placeholder icons (16, 32, 48, 128px) with a purple gradient background
 * and a simple "CC" text logo
 * 
 * Usage: node scripts/generate-icons.js
 * 
 * Requires: npm install canvas (if not already installed)
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Icon sizes required by Chrome extension
const SIZES = [16, 32, 48, 128];

// Create icons directory if it doesn't exist
const iconsDir = resolve(__dirname, '../public/icons');
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

console.log('Generating icons...');

SIZES.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Create gradient background (purple theme to match extension)
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#9333ea');
  gradient.addColorStop(0.5, '#7c3aed');
  gradient.addColorStop(1, '#6d28d9');
  
  // Fill background
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Add white "CC" text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.floor(size * 0.5)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CC', size / 2, size / 2);
  
  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  const filepath = resolve(iconsDir, `${size}.png`);
  writeFileSync(filepath, buffer);
  
  console.log(`✓ Generated ${size}x${size} icon`);
});

console.log(`\nIcons generated successfully in: ${iconsDir}`);
console.log('You can now build your extension with: npm run build');
