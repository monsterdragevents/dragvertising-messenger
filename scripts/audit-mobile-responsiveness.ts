#!/usr/bin/env tsx
/**
 * Audit script for mobile responsiveness issues
 * 
 * Scans all .tsx files for:
 * - Missing responsive breakpoints (sm:, md:, lg:, etc.)
 * - Fixed widths without mobile alternatives
 * - Text sizes that don't scale
 * - Padding/spacing that doesn't adapt
 * - Touch targets below 44x44px
 * - Overflow issues on small screens
 * 
 * Excludes:
 * - src/pages/public/ directory
 * - node_modules
 * - .next, .cache, dist, build directories
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';

interface MobileFinding {
  file: string;
  line: number;
  content: string;
  issue: 'missing-breakpoint' | 'fixed-width' | 'text-size' | 'spacing' | 'touch-target' | 'overflow';
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

const EXCLUDE_DIRS = [
  'node_modules',
  '.next',
  '.cache',
  'dist',
  'build',
  '.git',
  'public',
];

const EXCLUDE_PATHS = [
  'src/pages/public',
];

const findings: MobileFinding[] = [];

/**
 * Check if path should be excluded
 */
function shouldExclude(filePath: string): boolean {
  for (const excludePath of EXCLUDE_PATHS) {
    if (filePath.includes(excludePath)) {
      return true;
    }
  }
  
  const parts = filePath.split('/');
  for (const part of parts) {
    if (EXCLUDE_DIRS.includes(part)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check for mobile responsiveness issues
 */
function checkMobileIssues(line: string, lineNum: number, filePath: string): void {
  // Check for fixed widths without mobile alternatives
  const fixedWidthPattern = /\b(w-\[?\d+\]?|width:\s*\d+px)\b/;
  const hasMobileWidth = /\b(sm:|md:|lg:|xl:|2xl:).*w-/;
  
  if (fixedWidthPattern.test(line) && !hasMobileWidth.test(line) && line.includes('className')) {
    findings.push({
      file: relative(process.cwd(), filePath),
      line: lineNum,
      content: line.trim(),
      issue: 'fixed-width',
      severity: 'medium',
      suggestion: 'Add responsive width classes (e.g., w-full sm:w-auto)',
    });
  }
  
  // Check for text sizes that don't scale
  const textSizePattern = /\b(text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl))\b/;
  const hasResponsiveText = /\b(sm:|md:|lg:|xl:|2xl:).*text-/;
  
  if (textSizePattern.test(line) && !hasResponsiveText.test(line) && line.includes('className')) {
    // Only flag if it's a small text size that might be too small on mobile
    if (/\btext-(xs|sm)\b/.test(line)) {
      findings.push({
        file: relative(process.cwd(), filePath),
        line: lineNum,
        content: line.trim(),
        issue: 'text-size',
        severity: 'low',
        suggestion: 'Consider responsive text sizing (e.g., text-sm sm:text-base)',
      });
    }
  }
  
  // Check for padding/spacing that doesn't adapt
  const spacingPattern = /\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-(\d+|\[?\d+px\]?)\b/;
  const hasResponsiveSpacing = /\b(sm:|md:|lg:|xl:|2xl:).*(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-/;
  
  // Only flag large spacing values that might need mobile adjustment
  if (spacingPattern.test(line) && !hasResponsiveSpacing.test(line) && line.includes('className')) {
    const largeSpacing = /\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-(1[2-9]|[2-9]\d+)\b/;
    if (largeSpacing.test(line)) {
      findings.push({
        file: relative(process.cwd(), filePath),
        line: lineNum,
        content: line.trim(),
        issue: 'spacing',
        severity: 'low',
        suggestion: 'Consider responsive spacing (e.g., p-4 sm:p-6)',
      });
    }
  }
  
  // Check for small touch targets (h- or w- less than 11, which is 44px)
  const sizePattern = /\b(h|w)-(\d+)\b/;
  const sizeMatch = line.match(sizePattern);
  if (sizeMatch && line.includes('className')) {
    const size = parseInt(sizeMatch[2]);
    // Tailwind size 11 = 44px (minimum touch target)
    if (size < 11 && (line.includes('button') || line.includes('Button') || line.includes('click') || line.includes('onClick'))) {
      findings.push({
        file: relative(process.cwd(), filePath),
        line: lineNum,
        content: line.trim(),
        issue: 'touch-target',
        severity: 'high',
        suggestion: `Touch target too small (${size * 4}px). Minimum should be 44px (h-11 w-11)`,
      });
    }
  }
  
  // Check for overflow issues (horizontal scroll, fixed heights)
  if (line.includes('overflow-x-auto') || line.includes('overflow-x-scroll')) {
    // Check if there's a max-width constraint
    if (!line.includes('max-w-') && !line.includes('w-full')) {
      findings.push({
        file: relative(process.cwd(), filePath),
        line: lineNum,
        content: line.trim(),
        issue: 'overflow',
        severity: 'medium',
        suggestion: 'Consider adding max-width or container constraints for mobile',
      });
    }
  }
  
  // Check for modals/dialogs without mobile-friendly sizing
  if ((line.includes('Dialog') || line.includes('Modal') || line.includes('Sheet')) && 
      line.includes('className') && 
      !line.includes('w-full') && 
      !line.includes('max-w-') &&
      !line.includes('sm:')) {
    findings.push({
      file: relative(process.cwd(), filePath),
      line: lineNum,
      content: line.trim(),
      issue: 'missing-breakpoint',
      severity: 'high',
      suggestion: 'Modal/dialog should have responsive width (w-full sm:max-w-lg)',
    });
  }
}

/**
 * Scan file for mobile responsiveness issues
 */
async function scanFile(filePath: string): Promise<void> {
  if (shouldExclude(filePath)) {
    return;
  }
  
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      checkMobileIssues(line, index + 1, filePath);
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
function generateReport(bySeverity: { high: MobileFinding[]; medium: MobileFinding[]; low: MobileFinding[] }): void {
  console.log('\n=== Mobile Responsiveness Audit Report ===\n');
  console.log(`Total findings: ${findings.length}\n`);
  
  // Group by issue type
  const byIssue = new Map<string, MobileFinding[]>();
  findings.forEach(finding => {
    if (!byIssue.has(finding.issue)) {
      byIssue.set(finding.issue, []);
    }
    byIssue.get(finding.issue)!.push(finding);
  });
  
  // Print high severity findings first
  if (bySeverity.high.length > 0) {
    console.log(`\n🔴 HIGH SEVERITY (${bySeverity.high.length} findings)`);
    console.log('═'.repeat(80));
    bySeverity.high.forEach(finding => {
      console.log(`\n📄 ${finding.file}:${finding.line}`);
      console.log(`   Issue: ${finding.issue}`);
      console.log(`   ${finding.content.substring(0, 100)}${finding.content.length > 100 ? '...' : ''}`);
      console.log(`   → ${finding.suggestion}`);
    });
  }
  
  // Print medium severity
  if (bySeverity.medium.length > 0) {
    console.log(`\n🟡 MEDIUM SEVERITY (${bySeverity.medium.length} findings)`);
    console.log('═'.repeat(80));
    bySeverity.medium.forEach(finding => {
      console.log(`\n📄 ${finding.file}:${finding.line}`);
      console.log(`   Issue: ${finding.issue}`);
      console.log(`   ${finding.content.substring(0, 100)}${finding.content.length > 100 ? '...' : ''}`);
      console.log(`   → ${finding.suggestion}`);
    });
  }
  
  // Print low severity summary
  if (bySeverity.low.length > 0) {
    console.log(`\n🟢 LOW SEVERITY (${bySeverity.low.length} findings - see full report for details)`);
  }
  
  // Summary by issue type
  console.log('\n=== Summary by Issue Type ===');
  byIssue.forEach((findings, issue) => {
    const highCount = findings.filter(f => f.severity === 'high').length;
    const mediumCount = findings.filter(f => f.severity === 'medium').length;
    const lowCount = findings.filter(f => f.severity === 'low').length;
    console.log(`  ${issue}: ${findings.length} (${highCount} high, ${mediumCount} medium, ${lowCount} low)`);
  });
  
  console.log('\n=== Mobile Responsiveness Checklist ===');
  console.log('✓ Minimum 44x44px touch targets (h-11 w-11)');
  console.log('✓ Responsive text sizing (text-sm sm:text-base)');
  console.log('✓ Responsive spacing (p-4 sm:p-6)');
  console.log('✓ Mobile-friendly modals (w-full sm:max-w-lg)');
  console.log('✓ Viewport-aware positioning');
  console.log('✓ Graceful overflow handling');
  console.log('\n');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const startDir = process.argv[2] || 'src';
  console.log(`Scanning ${startDir} for mobile responsiveness issues...\n`);
  console.log('Excluding:', EXCLUDE_PATHS.join(', '), '\n');
  
  await scanDirectory(startDir);
  
  // Calculate bySeverity after scanning
  const bySeverity = {
    high: findings.filter(f => f.severity === 'high'),
    medium: findings.filter(f => f.severity === 'medium'),
    low: findings.filter(f => f.severity === 'low'),
  };
  
  generateReport(bySeverity);
  
  // Exit with error code if high severity findings exist
  if (bySeverity.high.length > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
