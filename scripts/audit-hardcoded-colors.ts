#!/usr/bin/env tsx
/**
 * Audit script for hardcoded colors in the codebase
 * 
 * Scans all .tsx files for:
 * - Hex colors (#...)
 * - Non-design-system Tailwind colors (purple-600, pink-500, etc.)
 * 
 * Excludes:
 * - src/pages/public/ directory
 * - node_modules
 * - .next, .cache, dist, build directories
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';

interface ColorFinding {
  file: string;
  line: number;
  content: string;
  type: 'hex' | 'tailwind-color' | 'gradient';
  suggested: string;
}

const EXCLUDE_DIRS = [
  'node_modules',
  '.next',
  '.cache',
  'dist',
  'build',
  '.git',
  'public', // Exclude public pages directory
];

const EXCLUDE_PATHS = [
  'src/pages/public', // Explicitly exclude public pages
];

// Design system color tokens
const DESIGN_SYSTEM_COLORS = [
  'dv-pink',
  'dv-purple',
  'dv-orange',
  'dv-golden',
  'dv-warmOrange',
  'dv-green',
  'dv-yellow',
  'dv-blue',
  'dv-red',
];

// Non-design-system Tailwind colors to flag
const NON_DS_COLORS = [
  'purple-',
  'pink-',
  'green-',
  'yellow-',
  'blue-',
  'red-',
  'orange-',
  'amber-',
  'emerald-',
  'teal-',
  'cyan-',
  'indigo-',
  'violet-',
  'fuchsia-',
];

const findings: ColorFinding[] = [];

/**
 * Check if path should be excluded
 */
function shouldExclude(filePath: string): boolean {
  // Check exclude paths
  for (const excludePath of EXCLUDE_PATHS) {
    if (filePath.includes(excludePath)) {
      return true;
    }
  }
  
  // Check exclude dirs
  const parts = filePath.split('/');
  for (const part of parts) {
    if (EXCLUDE_DIRS.includes(part)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get suggested replacement for a color
 */
function getSuggestedReplacement(color: string, type: 'hex' | 'tailwind-color' | 'gradient'): string {
  // Hex colors
  if (type === 'hex') {
    if (color === '#FD0290') {
      return 'dv-pink-500';
    }
    if (color === '#DC2626') {
      return 'dv-red-600';
    }
    if (color === '#FFA726') {
      return 'dv-golden-500';
    }
    if (color === '#FF6B35') {
      return 'dv-warmOrange-500';
    }
    return `dv-* (check DESIGN_TOKENS.json)`;
  }
  
  // Tailwind colors
  if (type === 'tailwind-color') {
    if (color.includes('purple-')) {
      return color.replace('purple-', 'dv-purple-');
    }
    if (color.includes('pink-')) {
      return color.replace('pink-', 'dv-pink-');
    }
    if (color.includes('green-')) {
      return color.replace('green-', 'dv-green-');
    }
    if (color.includes('yellow-')) {
      return color.replace('yellow-', 'dv-yellow-');
    }
    if (color.includes('blue-')) {
      return color.replace('blue-', 'dv-blue-');
    }
    if (color.includes('red-')) {
      return color.replace('red-', 'dv-red-');
    }
    return `dv-* (check DESIGN_TOKENS.json)`;
  }
  
  // Gradients
  if (type === 'gradient') {
    return 'Use gradients.primary or design system gradient';
  }
  
  return 'Check DESIGN_TOKENS.json';
}

/**
 * Scan file for hardcoded colors
 */
async function scanFile(filePath: string): Promise<void> {
  if (shouldExclude(filePath)) {
    return;
  }
  
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Check for hex colors (#...)
      const hexPattern = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
      let match;
      while ((match = hexPattern.exec(line)) !== null) {
        const hex = match[0];
        // Skip common CSS colors and design system references
        if (!['#000', '#fff', '#ffffff', '#000000'].includes(hex.toLowerCase())) {
          findings.push({
            file: relative(process.cwd(), filePath),
            line: lineNum,
            content: line.trim(),
            type: 'hex',
            suggested: getSuggestedReplacement(hex, 'hex'),
          });
        }
      }
      
      // Check for non-design-system Tailwind colors
      for (const color of NON_DS_COLORS) {
        const pattern = new RegExp(`\\b(bg|text|border|ring|outline|from|to|via)-${color}\\d+`, 'g');
        let colorMatch;
        while ((colorMatch = pattern.exec(line)) !== null) {
          const fullColor = colorMatch[0];
          // Check if it's already a design system color
          const isDesignSystem = DESIGN_SYSTEM_COLORS.some(dsColor => 
            fullColor.includes(`dv-${color.replace('-', '')}`)
          );
          
          if (!isDesignSystem) {
            findings.push({
              file: relative(process.cwd(), filePath),
              line: lineNum,
              content: line.trim(),
              type: 'tailwind-color',
              suggested: getSuggestedReplacement(fullColor, 'tailwind-color'),
            });
          }
        }
      }
      
      // Check for gradients with non-design-system colors
      const gradientPattern = /(from|to|via)-(purple|pink|green|yellow|blue|red|orange)-\d+/g;
      let gradientMatch;
      while ((gradientMatch = gradientPattern.exec(line)) !== null) {
        const gradient = gradientMatch[0];
        if (!gradient.includes('dv-')) {
          findings.push({
            file: relative(process.cwd(), filePath),
            line: lineNum,
            content: line.trim(),
            type: 'gradient',
            suggested: getSuggestedReplacement(gradient, 'gradient'),
          });
        }
      }
    });
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error);
  }
}

/**
 * Recursively scan directory
 */
async function scanDirectory(dir: string): Promise<void> {
  try {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      
      if (shouldExclude(fullPath)) {
        continue;
      }
      
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (stats.isFile() && (entry.endsWith('.tsx') || entry.endsWith('.ts'))) {
        await scanFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
}

/**
 * Generate report
 */
function generateReport(): void {
  console.log('\n=== Hardcoded Colors Audit Report ===\n');
  console.log(`Total findings: ${findings.length}\n`);
  
  // Group by file
  const byFile = new Map<string, ColorFinding[]>();
  findings.forEach(finding => {
    if (!byFile.has(finding.file)) {
      byFile.set(finding.file, []);
    }
    byFile.get(finding.file)!.push(finding);
  });
  
  // Sort by file name
  const sortedFiles = Array.from(byFile.entries()).sort((a, b) => 
    a[0].localeCompare(b[0])
  );
  
  // Print findings
  sortedFiles.forEach(([file, fileFindings]) => {
    console.log(`\n📄 ${file} (${fileFindings.length} finding${fileFindings.length > 1 ? 's' : ''})`);
    console.log('─'.repeat(80));
    
    fileFindings.forEach(finding => {
      console.log(`  Line ${finding.line.toString().padStart(4)}: [${finding.type}]`);
      console.log(`    ${finding.content.substring(0, 100)}${finding.content.length > 100 ? '...' : ''}`);
      console.log(`    → Replace with: ${finding.suggested}`);
      console.log('');
    });
  });
  
  // Summary by type
  const byType = new Map<string, number>();
  findings.forEach(finding => {
    byType.set(finding.type, (byType.get(finding.type) || 0) + 1);
  });
  
  console.log('\n=== Summary by Type ===');
  byType.forEach((count, type) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log('\n=== Next Steps ===');
  console.log('1. Review findings above');
  console.log('2. Replace hardcoded colors with design tokens');
  console.log('3. See COLOR_MIGRATION_MAP.md for migration patterns');
  console.log('4. Verify mobile responsiveness after replacements\n');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const startDir = process.argv[2] || 'src';
  console.log(`Scanning ${startDir} for hardcoded colors...\n`);
  console.log('Excluding:', EXCLUDE_PATHS.join(', '), '\n');
  
  await scanDirectory(startDir);
  generateReport();
  
  // Exit with error code if findings exist
  if (findings.length > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
