/**
 * Main Enigma Command - Pattern Consolidation
 *
 * This command performs the core tw-enigma functionality:
 * 1. Analyzes HTML/JS files for Tailwind class patterns
 * 2. Finds frequently co-occurring class combinations
 * 3. Generates short identifiers for these patterns
 * 4. Creates CSS with @apply directives
 * 5. Rewrites files with consolidated class names
 */

import { Command } from 'commander';
import fs from 'fs/promises';
import { glob } from 'glob';
import path from 'path';

import {
  createHtmlExtractor,
  createJsExtractor,
  generateCoOccurrenceAnalysis,
  generateFrequencyMap,
  type PatternAnalysisInput,
} from '@tw-enigma/core';

interface EnigmaOptions {
  input?: string;
  output?: string;
  length?: string | number;
  minFrequency?: string | number;
  dryRun?: boolean;
  verbose?: boolean;
}

export const enigmaCommand = new Command('enigma')
  .description('Consolidate Tailwind CSS patterns into short class identifiers')
  .option('-i, --input <path>', 'Input directory to scan for files', './src')
  .option('-o, --output <path>', 'Output CSS file path', './enigma.css')
  .option('-l, --length <number>', 'Length of generated class identifiers', '1')
  .option('-m, --min-frequency <number>', 'Minimum pattern frequency threshold', '2')
  .option('--dry-run', 'Preview changes without writing files', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options: EnigmaOptions) => {
    try {
      await runEnigmaOptimization(options);
    } catch (error) {
      console.error(
        '❌ Enigma optimization failed:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

async function runEnigmaOptimization(options: EnigmaOptions): Promise<void> {
  console.log('🎯 Starting Tailwind Enigma Pattern Consolidation...\n');

  // Parse and validate options
  const inputPath = path.resolve(options.input || './src');
  const outputPath = path.resolve(options.output || './enigma.css');
  const identifierLength = Math.max(1, Math.min(26, parseInt(String(options.length || '1'), 10)));
  const minFrequency = Math.max(1, parseInt(String(options.minFrequency || '2'), 10));

  console.log('🔍 Scanning for Tailwind patterns...');
  console.log(`  Input directory: ${inputPath}`);
  console.log(`  Output CSS file: ${outputPath}`);
  console.log(`  Identifier length: ${identifierLength}`);
  console.log(`  Min frequency: ${minFrequency}\n`);

  // 1. Discover files to process
  const files = await discoverFiles(inputPath);
  console.log(`📂 Found ${files.length} files to process\n`);

  if (files.length === 0) {
    console.log('⚠️  No files found to process. Check your input path.');
    return;
  }

  // 2. Extract classes from all files
  console.log('📊 Extracting Tailwind classes...');
  const allClasses: string[] = [];
  const htmlExtractor = createHtmlExtractor();
  const jsExtractor = createJsExtractor();

  for (const file of files) {
    const fileContent = await fs.readFile(file, 'utf-8');

    if (file.endsWith('.html') || file.endsWith('.htm')) {
      const result = await htmlExtractor.extractFromString(fileContent, file);
      for (const [className] of result.classes) {
        allClasses.push(className);
      }
    } else if (
      file.endsWith('.js') ||
      file.endsWith('.jsx') ||
      file.endsWith('.ts') ||
      file.endsWith('.tsx')
    ) {
      const result = await jsExtractor.extractFromString(fileContent, file);
      for (const [className] of result.classes) {
        allClasses.push(className);
      }
    }
  }

  console.log(`  Extracted ${allClasses.length} total class usages\n`);

  // 3. Create extraction results in the correct format for pattern analysis
  console.log('🔄 Analyzing class co-occurrence patterns...');
  const htmlResults: any[] = [];
  const jsxResults: any[] = [];

  // Re-process files to get proper extraction results
  for (const file of files) {
    const fileContent = await fs.readFile(file, 'utf-8');

    if (file.endsWith('.html') || file.endsWith('.htm')) {
      const result = await htmlExtractor.extractFromString(fileContent, file);
      htmlResults.push(result);
    } else if (
      file.endsWith('.js') ||
      file.endsWith('.jsx') ||
      file.endsWith('.ts') ||
      file.endsWith('.tsx')
    ) {
      const result = await jsExtractor.extractFromString(fileContent, file);
      jsxResults.push(result);
    }
  }

  const patternInput: PatternAnalysisInput = {
    htmlResults,
    jsxResults,
  };

  // Generate frequency map first
  const frequencyMap = generateFrequencyMap(patternInput, {
    minimumFrequency: minFrequency,
    enableCoOccurrenceAnalysis: true,
  });

  // Then generate co-occurrence patterns
  const qualifyingPatterns = generateCoOccurrenceAnalysis(frequencyMap, {
    minimumFrequency: minFrequency,
    enableCoOccurrenceAnalysis: true,
  });

  console.log(`  Found ${qualifyingPatterns.length} qualifying patterns\n`);

  if (qualifyingPatterns.length === 0) {
    console.log('⚠️  No patterns found meeting the frequency threshold.');
    console.log('   Try lowering --min-frequency or using more files with repeated patterns.');
    return;
  }

  // 4. Generate short identifiers for patterns
  console.log('🎨 Generating short identifiers...');
  const patternMap = new Map<string, string>();
  const cssRules: string[] = [];

  for (let i = 0; i < qualifyingPatterns.length; i++) {
    const pattern = qualifyingPatterns[i];
    const classPattern = pattern.classes.join(' ');

    // Generate short identifier using simple base conversion
    const shortId = generateShortId(i, identifierLength);

    patternMap.set(classPattern, shortId);

    // Generate CSS rule with @apply directive
    cssRules.push(`.${shortId} { @apply ${classPattern}; }`);

    if (options.verbose) {
      console.log(`  ${classPattern} → ${shortId} (used ${pattern.frequency} times)`);
    }
  }

  console.log(`  Generated ${patternMap.size} consolidated patterns\n`);

  // 5. Generate CSS file
  if (!options.dryRun) {
    console.log('📝 Writing CSS file...');
    const cssContent = cssRules.join('\n');
    await fs.writeFile(outputPath, cssContent, 'utf-8');
    console.log(`  CSS written to: ${outputPath}\n`);
  }

  // 6. Rewrite files with consolidated patterns
  console.log('✏️  Rewriting files with consolidated patterns...');

  let filesProcessed = 0;
  let totalReplacements = 0;

  for (const file of files) {
    try {
      let fileContent = await fs.readFile(file, 'utf-8');
      let replacementCount = 0;
      let hasChanges = false;

      if (options.verbose) {
        console.log(`  🔍 Processing ${file}...`);
      }

      // Sort patterns by length (longest first) to avoid partial replacements
      const sortedPatterns = Array.from(patternMap.entries()).sort(
        (a, b) => b[0].length - a[0].length
      );

      for (const [originalPattern, shortId] of sortedPatterns) {
        const patternClasses = originalPattern.split(/\s+/).filter(Boolean);

        if (options.verbose) {
          console.log(`    Testing pattern: "${originalPattern}" → ${shortId}`);
        }

        // Create regex to match class attributes containing all pattern classes
        // This matches class="..." or className="..." where all pattern classes are present (in any order)
        const classAttrRegex = /(?:class|className)\s*=\s*["']([^"']+)["']/gi;

        fileContent = fileContent.replace(classAttrRegex, (match, classValue) => {
          const classes = classValue.split(/\s+/).filter(Boolean);

          // Check if all pattern classes are present
          const hasAllClasses = patternClasses.every((cls: string) => classes.includes(cls));

          if (hasAllClasses) {
            // Remove the original pattern classes and add the short identifier
            const remainingClasses = classes.filter((cls: string) => !patternClasses.includes(cls));
            const newClasses = [shortId, ...remainingClasses].filter(Boolean);
            const newClassValue = newClasses.join(' ');

            // Return the updated class attribute (preserve original attribute name)
            const quote = match.includes('"') ? '"' : "'";
            const attrName = match.includes('className') ? 'className' : 'class';
            hasChanges = true;
            replacementCount++;

            if (options.verbose) {
              console.log(`    ${originalPattern} → ${shortId} in ${file}`);
            }

            return `${attrName}=${quote}${newClassValue}${quote}`;
          }

          return match; // Return unchanged if pattern doesn't match
        });
      }

      // Write back the file if there were changes and not in dry run mode
      if (hasChanges && !options.dryRun) {
        await fs.writeFile(file, fileContent, 'utf-8');
        filesProcessed++;
        totalReplacements += replacementCount;

        if (options.verbose) {
          console.log(`  ✅ ${file}: ${replacementCount} replacements`);
        }
      } else if (hasChanges && options.dryRun) {
        filesProcessed++;
        totalReplacements += replacementCount;

        if (options.verbose) {
          console.log(`  👀 ${file}: ${replacementCount} replacements (dry run)`);
        }
      }
    } catch (error) {
      console.error(
        `  ❌ Error processing ${file}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // 7. Summary
  console.log('\n🎉 Pattern consolidation complete!');
  console.log(`  Files processed: ${filesProcessed}/${files.length}`);
  console.log(`  Total patterns consolidated: ${patternMap.size}`);
  console.log(`  Total replacements made: ${totalReplacements}`);

  if (options.dryRun) {
    console.log('\n⚠️  This was a dry run - no files were actually modified.');
    console.log('   Remove --dry-run to apply changes.');
  } else {
    console.log(`\n💾 CSS file saved to: ${outputPath}`);
    console.log('   Include this CSS file in your build to apply the consolidated styles.');
  }
}

async function discoverFiles(inputPath: string): Promise<string[]> {
  const patterns = [
    path.join(inputPath, '**/*.html'),
    path.join(inputPath, '**/*.htm'),
    path.join(inputPath, '**/*.js'),
    path.join(inputPath, '**/*.jsx'),
    path.join(inputPath, '**/*.ts'),
    path.join(inputPath, '**/*.tsx'),
  ];

  const allFiles: string[] = [];
  for (const pattern of patterns) {
    try {
      const files = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
      });
      allFiles.push(...files);
    } catch (error) {
      console.warn(`Warning: Could not process pattern ${pattern}:`, error);
    }
  }

  // Remove duplicates and return
  return [...new Set(allFiles)];
}

// Simple helper function to generate short class identifiers
function generateShortId(index: number, minLength: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  let num = index;

  // Convert to base-26
  do {
    result = alphabet[num % 26] + result;
    num = Math.floor(num / 26);
  } while (num > 0);

  // Pad to minimum length if needed
  while (result.length < minLength) {
    result = alphabet[0] + result;
  }

  return result;
}

// Export the action function for use as the main CLI default action
export const enigmaAction = async (options: EnigmaOptions) => {
  try {
    await runEnigmaOptimization(options);
  } catch (error) {
    console.error(
      '❌ Enigma optimization failed:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
};
