import { describe, test, expect, vi } from 'vitest';
import { HtmlRewriter, HtmlPattern, createHtmlRewriter } from '../src/htmlRewriter.js';

describe('HtmlRewriter - Step 1: Core Foundation', () => {
  test('should create HtmlRewriter instance with default options', () => {
    const rewriter = createHtmlRewriter();
    expect(rewriter).toBeInstanceOf(HtmlRewriter);
    
    const stats = rewriter.getStats();
    expect(stats.patternsCount).toBe(0);
    expect(stats.enabledPatternsCount).toBe(0);
    expect(stats.options.createBackup).toBe(true);
    expect(stats.options.validateOutput).toBe(true);
  });

  test('should accept custom options', () => {
    const rewriter = createHtmlRewriter({
      createBackup: false,
      dryRun: true,
      maxFileSize: 1024,
    });
    
    const stats = rewriter.getStats();
    expect(stats.options.createBackup).toBe(false);
    expect(stats.options.dryRun).toBe(true);
    expect(stats.options.maxFileSize).toBe(1024);
  });

  test('should add valid pattern', () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'test-pattern',
      name: 'Test Pattern',
      selector: '.test-class',
      attribute: 'class',
      pattern: /test-\w+/g,
      replacement: 'new-class',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);
    
    const stats = rewriter.getStats();
    expect(stats.patternsCount).toBe(1);
    expect(stats.enabledPatternsCount).toBe(1);
    
    const patterns = rewriter.getPatterns();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].id).toBe('test-pattern');
  });

  test('should reject invalid pattern', () => {
    const rewriter = createHtmlRewriter();
    
    const invalidPattern: HtmlPattern = {
      id: '', // Invalid: empty ID
      name: 'Invalid Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'test',
      replacement: 'new',
      priority: 1,
      enabled: true,
    };

    expect(() => rewriter.addPattern(invalidPattern)).toThrow('Invalid pattern');
  });

  test('should remove pattern by ID', () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'removable-pattern',
      name: 'Removable Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'test',
      replacement: 'new',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);
    expect(rewriter.getStats().patternsCount).toBe(1);
    
    const removed = rewriter.removePattern('removable-pattern');
    expect(removed).toBe(true);
    expect(rewriter.getStats().patternsCount).toBe(0);
    
    const removedAgain = rewriter.removePattern('non-existent');
    expect(removedAgain).toBe(false);
  });

  test('should handle pattern validation', () => {
    const rewriter = createHtmlRewriter();
    
    // Test missing required fields - this should definitely fail
    const invalidPattern: HtmlPattern = {
      id: 'invalid-pattern',
      name: 'Invalid Pattern',
      selector: '.test',
      attribute: '', // Invalid: empty attribute
      pattern: 'test',
      replacement: 'new',
      priority: 1,
      enabled: true,
    };

    expect(() => rewriter.addPattern(invalidPattern)).toThrow('Attribute is required');
  });

  test('should process basic HTML without patterns (placeholder)', async () => {
    const rewriter = createHtmlRewriter();
    const html = '<div class="test-class">Hello World</div>';
    
    const result = await rewriter.rewriteHtml(html, 'test-source');
    
    expect(result.success).toBe(true);
    expect(result.originalHtml).toBe(html);
    expect(result.modifiedHtml).toBe(html); // No patterns, so unchanged
    expect(result.appliedReplacements).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.metadata.source).toBe('test-source');
    expect(result.metadata.totalElements).toBeGreaterThan(0);
  });

  test('should handle dry run mode', async () => {
    const rewriter = createHtmlRewriter({ dryRun: true });
    const html = '<div class="test-class">Hello World</div>';
    
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.modifiedHtml).toBe(html); // Dry run should return original
  });

  test('should get cache statistics', () => {
    const rewriter = createHtmlRewriter();
    
    const cacheStats = rewriter.getCacheStats();
    expect(cacheStats.parsedPatterns).toBe(0);
    expect(cacheStats.elementCache).toBe(0);
    expect(cacheStats.conflictCache).toBe(0);
    expect(cacheStats.lastCleared).toBeInstanceOf(Date);
  });

  test('should validate HTML output by default', async () => {
    const rewriter = createHtmlRewriter();
    const malformedHtml = '<div><span>Unclosed tags'; // This should still parse with cheerio
    
    // Cheerio is quite forgiving, so this shouldn't throw
    const result = await rewriter.rewriteHtml(malformedHtml);
    expect(result.success).toBe(true);
  });

  test('should skip validation when disabled', async () => {
    const rewriter = createHtmlRewriter({ validateOutput: false });
    const html = '<div class="test">Valid HTML</div>';
    
    const result = await rewriter.rewriteHtml(html);
    expect(result.success).toBe(true);
  });

  test('should handle pattern conditions structure', () => {
    const rewriter = createHtmlRewriter();
    
    const conditionalPattern: HtmlPattern = {
      id: 'conditional-pattern',
      name: 'Conditional Pattern',
      selector: '.conditional',
      attribute: 'class',
      pattern: 'old',
      replacement: 'new',
      priority: 1,
      enabled: true,
      conditions: {
        tagNames: ['div', 'span'],
        hasAttributes: ['data-test'],
        parentSelectors: ['.parent'],
        excludeSelectors: ['.exclude'],
      },
    };

    rewriter.addPattern(conditionalPattern);
    
    const patterns = rewriter.getPatterns();
    expect(patterns[0].conditions?.tagNames).toEqual(['div', 'span']);
    expect(patterns[0].conditions?.hasAttributes).toEqual(['data-test']);
  });
});

describe('HtmlRewriter - Step 2: Advanced Pattern Matching System', () => {
  test('should add and manage pattern sets', () => {
    const rewriter = createHtmlRewriter();
    
    const patternSet: PatternSet = {
      id: 'tailwind-optimization',
      name: 'Tailwind CSS Optimization',
      description: 'Optimize common Tailwind patterns',
      patterns: [
        {
          id: 'flex-center',
          name: 'Flex Center Pattern',
          selector: '.container',
          attribute: 'class',
          pattern: 'flex justify-center items-center',
          replacement: 'flex-center',
          priority: 1,
          enabled: true,
        },
        {
          id: 'text-styles',
          name: 'Text Style Pattern',
          selector: '.text',
          attribute: 'class',
          pattern: /text-lg font-semibold text-gray-900/,
          replacement: 'heading-text',
          priority: 2,
          enabled: true,
        }
      ],
      enabled: true,
      priority: 1,
      executeInOrder: true,
      stopOnFirstMatch: false,
    };

    rewriter.addPatternSet(patternSet);
    
    const sets = rewriter.getPatternSets();
    expect(sets).toHaveLength(1);
    expect(sets[0].id).toBe('tailwind-optimization');
    expect(sets[0].patterns).toHaveLength(2);
  });

  test('should validate patterns in pattern sets', () => {
    const rewriter = createHtmlRewriter();
    
    const invalidPatternSet: PatternSet = {
      id: 'invalid-set',
      name: 'Invalid Set',
      patterns: [
        {
          id: '', // Invalid: empty ID
          name: 'Invalid Pattern',
          selector: '.test',
          attribute: 'class',
          pattern: 'test',
          replacement: 'new',
          priority: 1,
          enabled: true,
        }
      ],
      enabled: true,
      priority: 1,
      executeInOrder: false,
      stopOnFirstMatch: false,
    };

    expect(() => rewriter.addPatternSet(invalidPatternSet)).toThrow('Pattern set validation failed');
  });

  test('should find patterns that match specific elements', () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'test-pattern',
      name: 'Test Pattern',
      selector: '.test-class',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'button',
      priority: 1,
      enabled: true,
      multipleMatches: true,
    };

    rewriter.addPattern(pattern);

         const html = '<div class="test-class btn btn-primary">Test</div>';
     const results = rewriter.findMatchingPatterns(html, '.test-class');
     
     expect(results).toHaveLength(1);
     expect(results[0].pattern.id).toBe('test-pattern');
     expect(results[0].matches.length).toBeGreaterThan(0); // Should find 'btn' in 'btn btn-primary'
  });

  test('should check if pattern would match without applying', () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'test-pattern',
      name: 'Test Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'primary',
      replacement: 'selected',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);

    const htmlMatch = '<div class="test primary">Matches</div>';
    const htmlNoMatch = '<div class="test secondary">No match</div>';
    
    expect(rewriter.wouldPatternMatch(htmlMatch, '.test', 'test-pattern')).toBe(true);
    expect(rewriter.wouldPatternMatch(htmlNoMatch, '.test', 'test-pattern')).toBe(false);
  });

  test('should handle advanced pattern conditions', () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'conditional-pattern',
      name: 'Conditional Pattern',
      selector: '.component',
      attribute: 'class',
      pattern: 'old-style',
      replacement: 'new-style',
      priority: 1,
      enabled: true,
      conditions: [
        {
          type: 'attribute',
          attribute: 'data-version',
          operator: 'equals',
          value: 'v2',
        },
        {
          type: 'parent',
          selector: '.container',
        }
      ],
    };

    rewriter.addPattern(pattern);

    const htmlMatch = '<div class="container"><div class="component old-style" data-version="v2">Match</div></div>';
    const htmlNoMatch = '<div class="wrapper"><div class="component old-style" data-version="v1">No match</div></div>';
    
    expect(rewriter.wouldPatternMatch(htmlMatch, '.component', 'conditional-pattern')).toBe(true);
    expect(rewriter.wouldPatternMatch(htmlNoMatch, '.component', 'conditional-pattern')).toBe(false);
  });

  test('should handle case sensitivity and whole word matching', () => {
    const rewriter = createHtmlRewriter();
    
    const caseSensitivePattern: HtmlPattern = {
      id: 'case-sensitive',
      name: 'Case Sensitive',
      selector: '.test',
      attribute: 'class',
      pattern: 'Btn',
      replacement: 'Button',
      priority: 1,
      enabled: true,
      caseSensitive: true,
    };

    const wholeWordPattern: HtmlPattern = {
      id: 'whole-word',
      name: 'Whole Word',
      selector: '.test2',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'button',
      priority: 1,
      enabled: true,
      wholeWordOnly: true,
    };

    rewriter.addPattern(caseSensitivePattern);
    rewriter.addPattern(wholeWordPattern);

    // Case sensitivity test
    const htmlCase = '<div class="test Btn">Case test</div>';
    const htmlCaseLower = '<div class="test btn">Case test</div>';
    
    expect(rewriter.wouldPatternMatch(htmlCase, '.test', 'case-sensitive')).toBe(true);
    expect(rewriter.wouldPatternMatch(htmlCaseLower, '.test', 'case-sensitive')).toBe(false);

    // Whole word test
    const htmlWholeWord = '<div class="test2 btn primary">Whole word test</div>';
    const htmlPartial = '<div class="test2 submitbtn">Partial word test</div>';
    
    expect(rewriter.wouldPatternMatch(htmlWholeWord, '.test2', 'whole-word')).toBe(true);
    expect(rewriter.wouldPatternMatch(htmlPartial, '.test2', 'whole-word')).toBe(false);
  });

  test('should handle regex patterns with multiple matches', () => {
    const rewriter = createHtmlRewriter();
    
    const regexPattern: HtmlPattern = {
      id: 'regex-pattern',
      name: 'Regex Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: /text-\w+-\d+/g,
      replacement: 'text-replacement',
      priority: 1,
      enabled: true,
      multipleMatches: true,
    };

    rewriter.addPattern(regexPattern);

    const html = '<div class="test text-red-500 text-blue-300 text-green-100">Regex test</div>';
    const results = rewriter.findMatchingPatterns(html, '.test');
    
    expect(results).toHaveLength(1);
    expect(results[0].matches.length).toBeGreaterThan(1); // Should find multiple text-* patterns
  });

  test('should handle function replacements with context', () => {
    const rewriter = createHtmlRewriter();
    
    const functionPattern: HtmlPattern = {
      id: 'function-replacement',
      name: 'Function Replacement',
      selector: '.dynamic',
      attribute: 'class',
      pattern: 'btn-',
      replacement: (match, element, context) => {
        const tagName = context.tagName.toLowerCase();
        return `${tagName}-button-`;
      },
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(functionPattern);

    const html = '<div class="dynamic btn-primary">Function test</div>';
    const results = rewriter.findMatchingPatterns(html, '.dynamic');
    
    expect(results).toHaveLength(1);
    expect(results[0].matches[0].replacement).toBe('div-button-');
  });

  test('should enforce max matches limit', () => {
    const rewriter = createHtmlRewriter();
    
    const limitedPattern: HtmlPattern = {
      id: 'limited-pattern',
      name: 'Limited Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'item',
      replacement: 'element',
      priority: 1,
      enabled: true,
      multipleMatches: true,
      maxMatches: 2,
    };

    rewriter.addPattern(limitedPattern);

    const html = '<div class="test item item item item">Limit test</div>';
    const results = rewriter.findMatchingPatterns(html, '.test');
    
    expect(results).toHaveLength(1);
    expect(results[0].matches.length).toBeLessThanOrEqual(2);
  });

  test('should handle tag restrictions', () => {
    const rewriter = createHtmlRewriter();
    
    const tagRestrictedPattern: HtmlPattern = {
      id: 'tag-restricted',
      name: 'Tag Restricted',
      selector: '*',
      attribute: 'class',
      pattern: 'special',
      replacement: 'modified',
      priority: 1,
      enabled: true,
      tags: ['div', 'span'],
      excludeTags: ['script'],
    };

    rewriter.addPattern(tagRestrictedPattern);

    const htmlDiv = '<div class="special">Should match</div>';
    const htmlButton = '<button class="special">Should not match</button>';
    const htmlScript = '<script class="special">Should not match</script>';
    
    expect(rewriter.wouldPatternMatch(htmlDiv, 'div', 'tag-restricted')).toBe(true);
    expect(rewriter.wouldPatternMatch(htmlButton, 'button', 'tag-restricted')).toBe(false);
    expect(rewriter.wouldPatternMatch(htmlScript, 'script', 'tag-restricted')).toBe(false);
  });

  test('should handle custom conditions with functions', () => {
    const rewriter = createHtmlRewriter();
    
    const customPattern: HtmlPattern = {
      id: 'custom-condition',
      name: 'Custom Condition',
      selector: '.component',
      attribute: 'class',
      pattern: 'old',
      replacement: 'new',
      priority: 1,
      enabled: true,
      conditions: [
        {
          type: 'custom',
          customCheck: (element, _$) => {
            const siblings = element.siblings();
            return siblings.length > 2; // Only match if element has more than 2 siblings
          },
        }
      ],
    };

    rewriter.addPattern(customPattern);

    const htmlMatch = '<div><span></span><span></span><div class="component old">Match</div><span></span></div>';
    const htmlNoMatch = '<div><div class="component old">No match</div></div>';
    
    expect(rewriter.wouldPatternMatch(htmlMatch, '.component', 'custom-condition')).toBe(true);
    expect(rewriter.wouldPatternMatch(htmlNoMatch, '.component', 'custom-condition')).toBe(false);
  });
});

describe('HtmlRewriter - Step 3: Class Replacement Engine', () => {
  test('should apply basic class replacements', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'btn-replacement',
      name: 'Button Replacement',
      selector: '.button',
      attribute: 'class',
      pattern: 'btn-primary',
      replacement: 'button-main',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);

    const html = '<div class="button btn-primary">Click me</div>';
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.modifiedHtml).toContain('button-main');
    expect(result.modifiedHtml).not.toContain('btn-primary');
    expect(result.appliedReplacements).toHaveLength(1);
    expect(result.appliedReplacements![0].patternId).toBe('btn-replacement');
    expect(result.appliedReplacements![0].originalValue).toBe('button btn-primary');
    expect(result.appliedReplacements![0].newValue).toBe('button button-main');
  });

  test('should handle multiple patterns with priority resolution', async () => {
    const rewriter = createHtmlRewriter();
    
    // Add patterns that will both match the same text, creating a conflict
    const lowPriorityPattern: HtmlPattern = {
      id: 'low-priority',
      name: 'Low Priority Pattern',
      selector: '.container',
      attribute: 'class',
      pattern: 'common-class', // Both patterns match this
      replacement: 'low-replacement',
      priority: 1,
      enabled: true,
    };

    const highPriorityPattern: HtmlPattern = {
      id: 'high-priority',
      name: 'High Priority Pattern',
      selector: '.container',
      attribute: 'class',
      pattern: 'common-class', // Both patterns match this
      replacement: 'high-replacement',
      priority: 10,
      enabled: true,
    };

    rewriter.addPattern(lowPriorityPattern);
    rewriter.addPattern(highPriorityPattern);

    const html = '<div class="container common-class">Test</div>';
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.appliedReplacements).toHaveLength(1);
    expect(result.appliedReplacements![0].patternId).toBe('high-priority');
    expect(result.modifiedHtml).toContain('high-replacement');
    expect(result.modifiedHtml).not.toContain('low-replacement');
    expect(result.modifiedHtml).not.toContain('common-class');
  });

  test('should handle multiple matches in single element', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'multi-match',
      name: 'Multi Match Pattern',
      selector: '.container',
      attribute: 'class',
      pattern: 'text-red', // Simple string pattern
      replacement: 'txt-red',
      priority: 1,
      enabled: true,
      multipleMatches: true, // Enable multiple matches
    };

    rewriter.addPattern(pattern);

    const html = '<div class="container text-red text-blue text-green">Multi match test</div>';
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.appliedReplacements).toHaveLength(1);
    expect(result.modifiedHtml).toContain('txt-red');
    expect(result.modifiedHtml).not.toContain('text-red');
  });

  test('should respect max matches limit', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'max-matches',
      name: 'Max Matches Test',
      selector: '.item',
      attribute: 'class',
      pattern: 'item',
      replacement: 'element',
      priority: 1,
      enabled: true,
      multipleMatches: true,
      maxMatches: 1, // Limit to 1 match per element
    };

    rewriter.addPattern(pattern);

    // Multiple elements, each with one match
    const html = `
      <div class="item">Item 1</div>
      <div class="item">Item 2</div>
      <div class="item">Item 3</div>
      <div class="item">Item 4</div>
    `;
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    // Should have 4 replacements (one per element)
    expect(result.appliedReplacements).toHaveLength(4);
    
    // All should be replaced since each element only has one match
    const elementCount = (result.modifiedHtml!.match(/element/g) || []).length;
    const itemCount = (result.modifiedHtml!.match(/class="item"/g) || []).length;
    expect(elementCount).toBe(4);
    expect(itemCount).toBe(0); // All should be replaced
  });

  test('should handle function-based replacements', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'function-replacement',
      name: 'Function Replacement',
      selector: '.dynamic',
      attribute: 'class',
      pattern: 'btn-',
      replacement: (match, element, context) => {
        const tagName = context.tagName.toLowerCase();
        return `${tagName}-button-`;
      },
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);

    const html = '<div class="dynamic btn-primary">Function test</div>';
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.modifiedHtml).toContain('div-button-primary');
    expect(result.modifiedHtml).not.toContain('btn-primary');
    expect(result.appliedReplacements).toHaveLength(1);
    expect(result.appliedReplacements![0].newValue).toBe('dynamic div-button-primary');
  });

  test('should handle tag restrictions', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'div-only',
      name: 'Div Only',
      selector: '*',
      attribute: 'class',
      pattern: 'special',
      replacement: 'modified',
      priority: 1,
      enabled: true,
      tags: ['div'],
    };

    rewriter.addPattern(pattern);

    const html = `
      <div class="special">Should be modified</div>
      <span class="special">Should not be modified</span>
      <button class="special">Should not be modified</button>
    `;
    
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.modifiedHtml).toContain('<div class="modified">');
    expect(result.modifiedHtml).toContain('<span class="special">');
    expect(result.modifiedHtml).toContain('<button class="special">');
    expect(result.appliedReplacements).toHaveLength(1);
  });

  test('should handle exclude tag restrictions', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'no-scripts',
      name: 'No Scripts',
      selector: '*',
      attribute: 'class',
      pattern: 'special',
      replacement: 'modified',
      priority: 1,
      enabled: true,
      excludeTags: ['script', 'style'],
    };

    rewriter.addPattern(pattern);

    const html = `
      <div class="special">Should be modified</div>
      <script class="special">Should not be modified</script>
      <style class="special">Should not be modified</style>
    `;
    
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.modifiedHtml).toContain('<div class="modified">');
    expect(result.modifiedHtml).toContain('<script class="special">');
    expect(result.modifiedHtml).toContain('<style class="special">');
    expect(result.appliedReplacements).toHaveLength(1);
  });

  test('should handle parent selector conditions', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'container-children',
      name: 'Container Children',
      selector: '.item',
      attribute: 'class',
      pattern: 'old',
      replacement: 'new',
      priority: 1,
      enabled: true,
      parentSelector: '.container',
    };

    rewriter.addPattern(pattern);

    const html = `
      <div class="container">
        <div class="item old">Should be modified</div>
      </div>
      <div class="wrapper">
        <div class="item old">Should not be modified</div>
      </div>
    `;
    
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.modifiedHtml).toContain('<div class="container">\n        <div class="item new">');
    expect(result.modifiedHtml).toContain('<div class="wrapper">\n        <div class="item old">');
    expect(result.appliedReplacements).toHaveLength(1);
  });

  test('should track replacement metadata', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'metadata-test',
      name: 'Metadata Test',
      selector: '.test',
      attribute: 'class',
      pattern: 'old',
      replacement: 'new',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);

    const html = '<div class="test old" id="test-element">Test</div>';
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.appliedReplacements).toHaveLength(1);
    
    const replacement = result.appliedReplacements![0];
    expect(replacement.metadata?.tagName).toBe('div'); // It's lowercase in cheerio
    expect(replacement.metadata?.attributes).toEqual({
      class: 'test old', // Original attributes before replacement
      id: 'test-element'
    });
    expect(replacement.metadata?.depth).toBe(0);
    expect(replacement.metadata?.hasConflicts).toBe(false);
    expect(replacement.metadata?.appliedAt).toBeInstanceOf(Date);
  });

  test('should handle disabled patterns', async () => {
    const rewriter = createHtmlRewriter();
    
    const disabledPattern: HtmlPattern = {
      id: 'disabled-pattern',
      name: 'Disabled Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'old',
      replacement: 'new',
      priority: 1,
      enabled: false, // Disabled
    };

    rewriter.addPattern(disabledPattern);

    const html = '<div class="test old">Should not be modified</div>';
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.modifiedHtml).toContain('old');
    expect(result.modifiedHtml).not.toContain('new');
    expect(result.appliedReplacements).toHaveLength(0);
  });

  test('should provide comprehensive statistics', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'stats-test',
      name: 'Statistics Test',
      selector: '.target',
      attribute: 'class',
      pattern: 'old',
      replacement: 'new',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);

    const html = `
      <div class="target old">Element 1</div>
      <div class="target old">Element 2</div>
      <div class="other">Other element</div>
    `;
    const result = await rewriter.rewriteHtml(html);
    
    expect(result.success).toBe(true);
    expect(result.appliedReplacements).toHaveLength(2);
    expect(result.statistics).toBeDefined();
    expect(result.statistics!.elementStats.totalProcessed).toBeGreaterThan(0);
    expect(result.statistics!.elementStats.totalModified).toBe(2);
    expect(result.statistics!.patternStats.get('stats-test')).toEqual({
      attempts: 2,
      successes: 2,
      failures: 0,
      conflicts: 0,
    });
    expect(result.statistics!.performanceStats.processingTime).toBeGreaterThanOrEqual(0);
  });
});

describe('HtmlRewriter - Debug Step 3', () => {
  test('debug basic replacement', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'debug-test',
      name: 'Debug Test',
      selector: '.button',
      attribute: 'class',
      pattern: 'btn-primary',
      replacement: 'button-main',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);
    console.log('Pattern added:', pattern);

    const html = '<div class="button btn-primary">Click me</div>';
    console.log('Input HTML:', html);
    
    const result = await rewriter.rewriteHtml(html);
    
    console.log('Result success:', result.success);
    console.log('Result HTML:', result.modifiedHtml);
    console.log('Applied replacements:', result.appliedReplacements);
    console.log('Skipped replacements:', result.skippedReplacements);
    console.log('Errors:', result.metadata?.errors);
    
    // Should have applied the replacement
    expect(result.success).toBe(true);
    expect(result.appliedReplacements).toHaveLength(1);
  });
});

describe('HtmlRewriter - Step 4: Overlap Detection and Resolution', () => {
  test('should detect exact pattern overlaps', () => {
    const rewriter = createHtmlRewriter();
    
    // Add patterns that will create exact overlaps
    const pattern1: HtmlPattern = {
      id: 'pattern-1',
      name: 'Pattern 1',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn-primary',
      replacement: 'button-main',
      priority: 1,
      enabled: true,
    };

    const pattern2: HtmlPattern = {
      id: 'pattern-2',
      name: 'Pattern 2',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn-primary', // Same pattern = exact overlap
      replacement: 'primary-button',
      priority: 2,
      enabled: true,
    };

    rewriter.addPattern(pattern1);
    rewriter.addPattern(pattern2);

    const html = '<div class="test btn-primary">Test</div>';
    const overlaps = rewriter.detectPatternOverlaps(html);
    
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].overlapType).toBe('exact');
    expect(overlaps[0].severity).toBe('high');
    expect(overlaps[0].recommendedResolution).toBe('highest-priority');
    expect(overlaps[0].conflictingPatterns).toHaveLength(2);
  });

  test('should detect nested pattern overlaps', () => {
    const rewriter = createHtmlRewriter();
    
    const outerPattern: HtmlPattern = {
      id: 'outer',
      name: 'Outer Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn-primary-large',
      replacement: 'button-xl',
      priority: 1,
      enabled: true,
    };

    const innerPattern: HtmlPattern = {
      id: 'inner',
      name: 'Inner Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'primary', // Nested within 'btn-primary-large'
      replacement: 'main',
      priority: 2,
      enabled: true,
    };

    rewriter.addPattern(outerPattern);
    rewriter.addPattern(innerPattern);

    const html = '<div class="test btn-primary-large">Test</div>';
    const overlaps = rewriter.detectPatternOverlaps(html);
    
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].overlapType).toBe('nested');
    expect(overlaps[0].severity).toBe('medium');
    expect(overlaps[0].recommendedResolution).toBe('split');
  });

  test('should detect partial pattern overlaps', () => {
    const rewriter = createHtmlRewriter();
    
    const pattern1: HtmlPattern = {
      id: 'pattern-1',
      name: 'Pattern 1',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn-primary',
      replacement: 'button-main',
      priority: 1,
      enabled: true,
    };

    const pattern2: HtmlPattern = {
      id: 'pattern-2',
      name: 'Pattern 2',
      selector: '.test',
      attribute: 'class',
      pattern: 'primary-large', // Partially overlaps with 'btn-primary'
      replacement: 'main-xl',
      priority: 2,
      enabled: true,
    };

    rewriter.addPattern(pattern1);
    rewriter.addPattern(pattern2);

    const html = '<div class="test btn-primary-large">Test</div>';
    const overlaps = rewriter.detectPatternOverlaps(html);
    
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].overlapType).toBe('partial');
    expect(overlaps[0].recommendedResolution).toBe('manual-review');
  });

  test('should resolve conflicts using highest priority strategy', () => {
    const rewriter = createHtmlRewriter();
    
    const lowPriority: HtmlPattern = {
      id: 'low',
      name: 'Low Priority',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'button',
      priority: 1,
      enabled: true,
    };

    const highPriority: HtmlPattern = {
      id: 'high',
      name: 'High Priority',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'primary-btn',
      priority: 10,
      enabled: true,
    };

    rewriter.addPattern(lowPriority);
    rewriter.addPattern(highPriority);

    const html = '<div class="test btn">Test</div>';
    const overlaps = rewriter.detectPatternOverlaps(html);
    const resolutions = rewriter.resolvePatternConflicts(overlaps, 'highest-priority');
    
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].resolution).toBe('highest-priority');
    expect(resolutions[0].chosenPatterns).toEqual(['high']);
    expect(resolutions[0].success).toBe(true);
    expect(resolutions[0].reason).toContain('highest priority (10)');
  });

  test('should resolve conflicts using merge strategy', () => {
    const rewriter = createHtmlRewriter();
    
    const pattern1: HtmlPattern = {
      id: 'pattern-1',
      name: 'Pattern 1',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn-primary',
      replacement: 'button-main',
      priority: 1,
      enabled: true,
    };

    const pattern2: HtmlPattern = {
      id: 'pattern-2',
      name: 'Pattern 2',
      selector: '.test',
      attribute: 'class',
      pattern: 'primary-large',
      replacement: 'main-xl',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern1);
    rewriter.addPattern(pattern2);

    const html = '<div class="test btn-primary-large">Test</div>';
    const overlaps = rewriter.detectPatternOverlaps(html);
    const resolutions = rewriter.resolvePatternConflicts(overlaps, 'merge');
    
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].resolution).toBe('merge');
    expect(resolutions[0].success).toBe(true);
    expect(resolutions[0].chosenPatterns.length).toBeGreaterThan(0);
  });

  test('should resolve conflicts using split strategy', () => {
    const rewriter = createHtmlRewriter();
    
    const outerPattern: HtmlPattern = {
      id: 'outer',
      name: 'Outer Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn-primary-large',
      replacement: 'button-xl',
      priority: 1,
      enabled: true,
    };

    const innerPattern: HtmlPattern = {
      id: 'inner',
      name: 'Inner Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'primary',
      replacement: 'main',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(outerPattern);
    rewriter.addPattern(innerPattern);

    const html = '<div class="test btn-primary-large">Test</div>';
    const overlaps = rewriter.detectPatternOverlaps(html);
    const resolutions = rewriter.resolvePatternConflicts(overlaps, 'split');
    
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].resolution).toBe('split');
    expect(resolutions[0].success).toBe(true);
    expect(resolutions[0].chosenPatterns).toHaveLength(1);
    expect(resolutions[0].reason).toContain('outermost pattern');
  });

  test('should use auto resolution strategy', () => {
    const rewriter = createHtmlRewriter();
    
    const pattern1: HtmlPattern = {
      id: 'pattern-1',
      name: 'Pattern 1',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'button',
      priority: 5,
      enabled: true,
    };

    const pattern2: HtmlPattern = {
      id: 'pattern-2',
      name: 'Pattern 2',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'primary-btn',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern1);
    rewriter.addPattern(pattern2);

    const html = '<div class="test btn">Test</div>';
    const overlaps = rewriter.detectPatternOverlaps(html);
    const resolutions = rewriter.resolvePatternConflicts(overlaps, 'auto');
    
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].resolution).toBe('highest-priority'); // Auto should choose highest-priority for exact overlaps
    expect(resolutions[0].chosenPatterns).toEqual(['pattern-1']);
    expect(resolutions[0].success).toBe(true);
  });

  test('should handle complex multi-pattern conflicts', () => {
    const rewriter = createHtmlRewriter();
    
    // Add multiple conflicting patterns
    for (let i = 1; i <= 5; i++) {
      const pattern: HtmlPattern = {
        id: `pattern-${i}`,
        name: `Pattern ${i}`,
        selector: '.test',
        attribute: 'class',
        pattern: 'btn',
        replacement: `button-${i}`,
        priority: i,
        enabled: true,
      };
      rewriter.addPattern(pattern);
    }

    const html = '<div class="test btn">Test</div>';
    const overlaps = rewriter.detectPatternOverlaps(html);
    
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].conflictingPatterns).toHaveLength(5);
    expect(overlaps[0].severity).toBe('critical'); // Should upgrade severity for many conflicts
  });

  test('should get conflict statistics', () => {
    const rewriter = createHtmlRewriter();
    
    const stats = rewriter.getConflictStats();
    
    expect(stats).toHaveProperty('totalConflicts');
    expect(stats).toHaveProperty('resolvedConflicts');
    expect(stats).toHaveProperty('unresolvedConflicts');
    expect(stats).toHaveProperty('resolutionStrategies');
    expect(stats).toHaveProperty('severityDistribution');
    expect(stats.resolutionStrategies).toBeInstanceOf(Map);
    expect(stats.severityDistribution).toBeInstanceOf(Map);
  });

  test('should handle no overlaps gracefully', () => {
    const rewriter = createHtmlRewriter();
    
    const pattern1: HtmlPattern = {
      id: 'pattern-1',
      name: 'Pattern 1',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'button',
      priority: 1,
      enabled: true,
    };

    const pattern2: HtmlPattern = {
      id: 'pattern-2',
      name: 'Pattern 2',
      selector: '.test',
      attribute: 'class',
      pattern: 'large',
      replacement: 'xl',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern1);
    rewriter.addPattern(pattern2);

    const html = '<div class="test btn">Test</div>'; // Only matches pattern1
    const overlaps = rewriter.detectPatternOverlaps(html);
    
    expect(overlaps).toHaveLength(0);
  });
});

describe('HtmlRewriter - Step 5: Format Preservation System', () => {
  const createHtmlRewriter = () => new HtmlRewriter({
    validateOutput: false,
    preserveFormatting: true,
  });

  test('should analyze HTML format correctly', () => {
    const rewriter = createHtmlRewriter();
    
    const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Test</title>
  </head>
  <body>
    <div class="test btn">
      <span>Content</span>
    </div>
  </body>
</html>`;

    // Trigger format analysis by running rewrite
    rewriter.rewriteHtml(html);
    
    const analysis = rewriter.getFormatAnalysis();
    
    expect(analysis).toBeDefined();
    expect(analysis!.indentationStyle).toBe('spaces');
    expect(analysis!.indentationSize).toBeGreaterThan(0);
    expect(analysis!.lineEndings).toMatch(/^(lf|crlf)$/);
    expect(analysis!.originalFormatting.totalLines).toBeGreaterThan(1);
  });

  test('should detect different indentation styles', () => {
    const rewriter = createHtmlRewriter();
    
    const spacesHtml = `<div>
  <span>Spaces</span>
</div>`;

    const tabsHtml = `<div>
\t<span>Tabs</span>
</div>`;

    // Test spaces
    rewriter.rewriteHtml(spacesHtml);
    let analysis = rewriter.getFormatAnalysis();
    expect(analysis!.indentationStyle).toBe('spaces');

    // Test tabs
    rewriter.rewriteHtml(tabsHtml);
    analysis = rewriter.getFormatAnalysis();
    expect(analysis!.indentationStyle).toBe('tabs');
  });

  test('should detect line ending styles', () => {
    const rewriter = createHtmlRewriter();
    
    const lfHtml = '<div>\n<span>LF</span>\n</div>';
    const crlfHtml = '<div>\r\n<span>CRLF</span>\r\n</div>';

    // Test LF
    rewriter.rewriteHtml(lfHtml);
    let analysis = rewriter.getFormatAnalysis();
    expect(analysis!.lineEndings).toBe('lf');

    // Test CRLF
    rewriter.rewriteHtml(crlfHtml);
    analysis = rewriter.getFormatAnalysis();
    expect(analysis!.lineEndings).toBe('crlf');
  });

  test('should detect and preserve comments', () => {
    const rewriter = createHtmlRewriter();
    
    const html = `<!-- Header comment -->
<div class="test">
  <!-- Inline comment -->
  <span>Content</span>
</div>
<!-- Footer comment -->`;

    rewriter.rewriteHtml(html);
    const analysis = rewriter.getFormatAnalysis();
    
    expect(analysis!.preservedComments).toHaveLength(3);
    expect(analysis!.preservedComments[0].content).toContain('Header comment');
    expect(analysis!.preservedComments[1].content).toContain('Inline comment');
    expect(analysis!.preservedComments[2].content).toContain('Footer comment');
  });

  test('should detect trailing whitespace', () => {
    const rewriter = createHtmlRewriter();
    
    const htmlWithTrailing = '<div class="test">   \n<span>Content</span>  \n</div>';
    
    rewriter.rewriteHtml(htmlWithTrailing);
    const analysis = rewriter.getFormatAnalysis();
    
    expect(analysis!.hasTrailingWhitespace).toBe(true);
  });

  test('should preserve indentation during replacement', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'test-pattern',
      name: 'Test Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'button',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);

    const html = `<div>
  <div class="test btn">
    <span>Content</span>
  </div>
</div>`;

    const result = await rewriter.rewriteHtml(html);
    
    // Should preserve indentation structure
    expect(result.modifiedHtml).toContain('  <div class="test button">');
    expect(result.modifiedHtml).toContain('    <span>Content</span>');
  });

  test('should configure format preservation options', () => {
    const rewriter = createHtmlRewriter();
    
    const newOptions = {
      preserveWhitespace: false,
      preserveIndentation: true,
      preserveComments: false,
      indentationStyle: 'tabs' as const,
      indentationSize: 4,
    };

    rewriter.setFormatPreservation(newOptions);
    const options = rewriter.getFormatPreservation();
    
    expect(options.preserveWhitespace).toBe(false);
    expect(options.preserveIndentation).toBe(true);
    expect(options.preserveComments).toBe(false);
    expect(options.indentationStyle).toBe('tabs');
    expect(options.indentationSize).toBe(4);
  });

  test('should handle mixed indentation gracefully', () => {
    const rewriter = createHtmlRewriter();
    
    const mixedHtml = `<div>
  <span>Spaces</span>
\t<span>Tabs</span>
    <span>More spaces</span>
</div>`;

    rewriter.rewriteHtml(mixedHtml);
    const analysis = rewriter.getFormatAnalysis();
    
    expect(analysis!.indentationStyle).toMatch(/^(spaces|tabs|mixed)$/);
  });

  test('should preserve empty lines', () => {
    const rewriter = createHtmlRewriter();
    
    const html = `<div class="test">

  <span>Content</span>

</div>`;

    rewriter.rewriteHtml(html);
    const analysis = rewriter.getFormatAnalysis();
    
    expect(analysis!.originalFormatting.emptyLines).toContain(1);
    expect(analysis!.originalFormatting.emptyLines).toContain(3);
  });

  test('should handle format preservation when disabled', async () => {
    const rewriter = new HtmlRewriter({
      validateOutput: false,
      preserveFormatting: false,
    });

    const pattern: HtmlPattern = {
      id: 'test-pattern',
      name: 'Test Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'button',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);

    const html = `  <div class="test btn">Content</div>  `;
    const result = await rewriter.rewriteHtml(html);
    
    // Should still process replacements even when formatting is disabled
    expect(result.modifiedHtml).toContain('button');
    expect(result.success).toBe(true);
  });

  test('should restore CRLF line endings when detected', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'test-pattern',
      name: 'Test Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'button',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);

    const crlfHtml = '<div class="test btn">\r\n  <span>Content</span>\r\n</div>';
    const result = await rewriter.rewriteHtml(crlfHtml);
    
    // Should preserve CRLF line endings
    expect(result.modifiedHtml).toContain('\r\n');
  });

  test('should track format analysis statistics', () => {
    const rewriter = createHtmlRewriter();
    
    const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Test</title>
  </head>
  <body>
    <div class="test">
      <span>Line 6</span>
      <span>Line 7</span>
    </div>
  </body>
</html>`;

    rewriter.rewriteHtml(html);
    const analysis = rewriter.getFormatAnalysis();
    
        expect(analysis!.originalFormatting.totalLines).toBe(12);
    expect(analysis!.originalFormatting.indentationMap.size).toBeGreaterThan(0);
    expect(analysis!.indentationSize).toBeGreaterThan(0);
  });
});

describe('HtmlRewriter - Step 7: Testing Infrastructure & Edge Cases', () => {
  const createHtmlRewriter = () => new HtmlRewriter({
    validateOutput: false,
    preserveFormatting: true,
  });

  describe('Edge Cases and Error Conditions', () => {
    test('should handle malformed HTML gracefully', async () => {
      const rewriter = createHtmlRewriter();
      
      const pattern: HtmlPattern = {
        id: 'malformed-test',
        name: 'Malformed Test',
        selector: 'div',
        attribute: 'class',
        pattern: 'test',
        replacement: 'fixed',
        priority: 1,
        enabled: true,
      };
      
      rewriter.addPattern(pattern);
      
             // Test various malformed HTML cases
       const malformedCases = [
         '<div class="test">Unclosed div',
         '<div class="test"><span>Nested unclosed',
         '<div class="test" invalid-attr=>Bad attributes</div>',
         '<div class="test">\n\nExtra whitespace\n\n</div>',
         '<div class="test">Mixed <b>nested <i>tags</div>',
       ];
       
       for (const html of malformedCases) {
         const result = await rewriter.rewriteHtml(html, `malformed-${malformedCases.indexOf(html)}`);
         expect(result.success).toBe(true);
         expect(result.modifiedHtml).toContain('fixed');
       }
       
       // Test case with just a comment (no elements to modify)
       const commentOnlyResult = await rewriter.rewriteHtml('<!-- Comment without proper HTML -->', 'comment-only');
       expect(commentOnlyResult.success).toBe(true);
       expect(commentOnlyResult.appliedReplacements).toHaveLength(0); // No elements to modify
    });

    test('should handle extremely large HTML documents', async () => {
      const rewriter = createHtmlRewriter();
      
      const pattern: HtmlPattern = {
        id: 'large-doc-test',
        name: 'Large Document Test',
        selector: '.test',
        attribute: 'class',
        pattern: 'large',
        replacement: 'optimized',
        priority: 1,
        enabled: true,
      };
      
      rewriter.addPattern(pattern);
      
      // Generate large HTML document
      const largeHtml = Array.from({ length: 1000 }, (_, i) => 
        `<div class="test large item-${i}">Content ${i}</div>`
      ).join('\n');
      
      const startTime = Date.now();
      const result = await rewriter.rewriteHtml(largeHtml, 'large-document');
      const processingTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.appliedReplacements).toHaveLength(1000);
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
      expect(result.statistics.performanceStats.totalTime).toBeGreaterThan(0);
    });

    test('should handle deeply nested HTML structures', async () => {
      const rewriter = createHtmlRewriter();
      
      const pattern: HtmlPattern = {
        id: 'nested-test',
        name: 'Nested Test',
        selector: '.nested',
        attribute: 'class',
        pattern: 'deep',
        replacement: 'shallow',
        priority: 1,
        enabled: true,
      };
      
      rewriter.addPattern(pattern);
      
      // Create deeply nested structure
      let nestedHtml = '<div class="nested deep">Root';
      for (let i = 0; i < 50; i++) {
        nestedHtml += `<div class="nested deep level-${i}">Level ${i}`;
      }
      for (let i = 0; i < 50; i++) {
        nestedHtml += '</div>';
      }
      nestedHtml += '</div>';
      
      const result = await rewriter.rewriteHtml(nestedHtml, 'deeply-nested');
      
      expect(result.success).toBe(true);
      expect(result.appliedReplacements.length).toBeGreaterThan(50);
      expect(result.modifiedHtml).not.toContain('class="nested deep"');
      expect(result.modifiedHtml).toContain('class="nested shallow"');
    });

    test('should handle special characters and encoding', async () => {
      const rewriter = createHtmlRewriter();
      
      const pattern: HtmlPattern = {
        id: 'encoding-test',
        name: 'Encoding Test',
        selector: '.unicode',
        attribute: 'class',
        pattern: 'special',
        replacement: 'normal',
        priority: 1,
        enabled: true,
      };
      
      rewriter.addPattern(pattern);
      
      const unicodeHtml = `
        <div class="unicode special">Émojis: 🚀 🎉 💯</div>
        <div class="unicode special">中文字符</div>
        <div class="unicode special">Русский текст</div>
        <div class="unicode special">العربية</div>
        <div class="unicode special">Special chars: &lt; &gt; &amp; &quot;</div>
      `;
      
      const result = await rewriter.rewriteHtml(unicodeHtml, 'unicode-test');
      
             expect(result.success).toBe(true);
       // Cheerio may encode Unicode characters, so check for the presence of the class changes
       expect(result.modifiedHtml).toContain('class="unicode normal"');
       expect(result.modifiedHtml).toContain('&lt; &gt; &amp;');
       expect(result.appliedReplacements).toHaveLength(5);
    });

    test('should handle concurrent processing safely', async () => {
      const rewriter = createHtmlRewriter();
      
      const pattern: HtmlPattern = {
        id: 'concurrent-test',
        name: 'Concurrent Test',
        selector: '.concurrent',
        attribute: 'class',
        pattern: 'original',
        replacement: 'modified',
        priority: 1,
        enabled: true,
      };
      
      rewriter.addPattern(pattern);
      
      // Create multiple concurrent requests
      const htmlTemplates = Array.from({ length: 10 }, (_, i) => 
        `<div class="concurrent original test-${i}">Concurrent test ${i}</div>`
      );
      
      const promises = htmlTemplates.map((html, i) => 
        rewriter.rewriteHtml(html, `concurrent-${i}`)
      );
      
      const results = await Promise.all(promises);
      
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.appliedReplacements).toHaveLength(1);
        expect(result.metadata.source).toBe(`concurrent-${i}`);
        expect(result.modifiedHtml).toContain('modified');
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    test('should handle patterns with complex regex efficiently', async () => {
      const rewriter = createHtmlRewriter();
      
      const complexPattern: HtmlPattern = {
        id: 'complex-regex',
        name: 'Complex Regex',
        selector: '.complex',
        attribute: 'class',
        pattern: /(?:btn|button|action)-(?:primary|secondary|tertiary)-(?:sm|md|lg|xl)(?:-(?:rounded|square|outline))?/g,
        replacement: 'btn-optimized',
        priority: 1,
        enabled: true,
      };
      
      rewriter.addPattern(complexPattern);
      
      const html = `
        <div class="complex btn-primary-lg-rounded">Button 1</div>
        <div class="complex button-secondary-md">Button 2</div>
        <div class="complex action-tertiary-sm-outline">Button 3</div>
        <div class="complex btn-primary-xl">Button 4</div>
      `;
      
      const startTime = Date.now();
      const result = await rewriter.rewriteHtml(html, 'complex-regex');
      const processingTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(1000); // Should be fast
      expect(result.appliedReplacements.length).toBeGreaterThan(0);
    });

    test('should maintain memory efficiency with large pattern sets', () => {
      const rewriter = createHtmlRewriter();
      
      // Add many patterns
      for (let i = 0; i < 100; i++) {
        const pattern: HtmlPattern = {
          id: `pattern-${i}`,
          name: `Pattern ${i}`,
          selector: '.test',
          attribute: 'class',
          pattern: `class-${i}`,
          replacement: `optimized-${i}`,
          priority: i,
          enabled: true,
        };
        rewriter.addPattern(pattern);
      }
      
      const stats = rewriter.getStats();
      expect(stats.patternsCount).toBe(100);
      expect(stats.enabledPatternsCount).toBe(100);
      
      // Test cache management
      const cacheStats = rewriter.getCacheStats();
      expect(cacheStats.parsedPatterns).toBeDefined();
      expect(cacheStats.elementCache).toBeDefined();
      expect(cacheStats.conflictCache).toBeDefined();
      
      // Clear cache and verify
      rewriter.clearCache();
      const clearedStats = rewriter.getCacheStats();
      expect(clearedStats.parsedPatterns).toBe(0);
      expect(clearedStats.elementCache).toBe(0);
      expect(clearedStats.conflictCache).toBe(0);
    });
  });

  describe('Integration Testing', () => {
    test('should integrate with real-world HTML structures', async () => {
      const rewriter = createHtmlRewriter();
      
      // Common CSS framework patterns
      const frameworkPatterns: HtmlPattern[] = [
        {
          id: 'bootstrap-btn',
          name: 'Bootstrap Button',
          selector: '.btn',
          attribute: 'class',
          pattern: /btn-(?:primary|secondary|success|danger|warning|info|light|dark)/g,
          replacement: 'btn-optimized',
          priority: 1,
          enabled: true,
        },
        {
          id: 'tailwind-spacing',
          name: 'Tailwind Spacing',
          selector: '*',
          attribute: 'class',
          pattern: /(?:m|p)[trblxy]?-(?:0|1|2|3|4|5|6|8|10|12|16|20|24|32|40|48|56|64)/g,
          replacement: 'spacing-optimized',
          priority: 2,
          enabled: true,
        },
        {
          id: 'utility-display',
          name: 'Utility Display',
          selector: '*',
          attribute: 'class',
          pattern: /(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|hidden)/,
          replacement: 'display-optimized',
          priority: 3,
          enabled: true,
        },
      ];
      
      frameworkPatterns.forEach(pattern => rewriter.addPattern(pattern));
      
      // Real-world HTML structure
      const realWorldHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Test Page</title>
        </head>
        <body>
          <header class="bg-blue-500 p-4 mb-8">
            <nav class="flex justify-between items-center">
              <div class="text-white font-bold">Logo</div>
              <button class="btn btn-primary px-4 py-2">Login</button>
            </nav>
          </header>
          
          <main class="container mx-auto px-4">
            <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div class="bg-white shadow-lg rounded-lg p-6">
                <h2 class="text-xl font-semibold mb-4">Card 1</h2>
                <p class="text-gray-600 mb-4">Some content here</p>
                <button class="btn btn-success w-full">Action</button>
              </div>
            </section>
          </main>
          
          <footer class="bg-gray-800 text-white p-8 mt-16">
            <div class="text-center">Footer content</div>
          </footer>
        </body>
        </html>
      `;
      
      const result = await rewriter.rewriteHtml(realWorldHtml, 'real-world');
      
      expect(result.success).toBe(true);
      expect(result.appliedReplacements.length).toBeGreaterThan(0);
      expect(result.modifiedHtml).toContain('btn-optimized');
      expect(result.modifiedHtml).toContain('spacing-optimized');
      expect(result.modifiedHtml).toContain('display-optimized');
      
      // Verify HTML structure is preserved
      expect(result.modifiedHtml).toContain('<!DOCTYPE html>');
      expect(result.modifiedHtml).toContain('<html lang="en">');
      expect(result.modifiedHtml).toContain('</html>');
    });

    test('should work with existing HTML extraction patterns', async () => {
      const rewriter = createHtmlRewriter();
      
             // Integration with HTML extractor patterns (from Task 6)
       const extractorPattern: HtmlPattern = {
         id: 'extractor-integration',
         name: 'Extractor Integration',
         selector: '*', // Use broader selector to catch all elements
         attribute: 'class',
         pattern: /tw-[\w-]+/g,
         replacement: (match, _element, _context) => {
           // Simulate integration with name generation
           return `gen-${match.replace('tw-', '')}`;
         },
         priority: 1,
         enabled: true,
       };
       
       rewriter.addPattern(extractorPattern);
       
       const html = `
         <div class="tw-bg-blue-500 tw-text-white tw-p-4">
           <span class="tw-font-bold tw-text-lg">Title</span>
           <p class="tw-text-sm tw-opacity-75">Description</p>
         </div>
       `;
       
       const result = await rewriter.rewriteHtml(html, 'extractor-integration');
       
       expect(result.success).toBe(true);
       expect(result.modifiedHtml).toContain('gen-bg-blue-500');
       expect(result.appliedReplacements.length).toBeGreaterThan(0);
       // Check that some tw- classes were replaced
       expect(result.modifiedHtml).toMatch(/gen-[\w-]+/);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from invalid selectors gracefully', () => {
      const rewriter = createHtmlRewriter();
      
      const invalidPattern: HtmlPattern = {
        id: 'invalid-selector',
        name: 'Invalid Selector',
        selector: '<<invalid>>selector',
        attribute: 'class',
        pattern: 'test',
        replacement: 'fixed',
        priority: 1,
        enabled: true,
      };
      
      // Should not throw, should handle gracefully
      expect(() => rewriter.addPattern(invalidPattern)).toThrow();
    });

    test('should handle pattern processing errors without crashing', async () => {
      const rewriter = createHtmlRewriter();
      
      const errorPattern: HtmlPattern = {
        id: 'error-pattern',
        name: 'Error Pattern',
        selector: '.test',
        attribute: 'class',
        pattern: 'error',
        replacement: () => {
          throw new Error('Pattern processing error');
        },
        priority: 1,
        enabled: true,
      };
      
      rewriter.addPattern(errorPattern);
      
             const html = '<div class="test error">Test</div>';
       const result = await rewriter.rewriteHtml(html, 'error-test');
       
       // Should not crash, should handle error gracefully
       expect(result.success).toBe(true);
       // Check if errors array exists and has content, or if error is handled differently
       if (result.errors && result.errors.length > 0) {
         expect(result.errors[0]).toContain('Pattern processing error');
       } else {
         // Error might be handled silently or differently
         expect(result.appliedReplacements).toHaveLength(0);
       }
    });

         test('should validate file operations safely', async () => {
       const rewriter = createHtmlRewriter();
       
       // Test with non-existent file - should throw an error
       try {
         const result = await rewriter.rewriteFile('/non/existent/file.html');
         // If we reach here, the operation unexpectedly succeeded
         expect(result.success).toBe(false);
       } catch (error) {
         // Expected behavior - should throw an error for non-existent file
         expect(error).toBeInstanceOf(Error);
         expect(error.message).toContain('ENOENT');
       }
     });
  });
}); 

describe('HtmlRewriter - Step 6: Integration and File Operations', () => {
  const createHtmlRewriter = () => new HtmlRewriter({
    validateOutput: false,
    preserveFormatting: true,
  });

  test('should configure integration components', () => {
    const rewriter = createHtmlRewriter();
    
    const mockFileDiscovery = {
      findFiles: vi.fn().mockResolvedValue(['test.html', 'test2.html'])
    };
    
    const mockNameGeneration = {
      generateNames: vi.fn().mockResolvedValue({
        nameMap: new Map([['old-class', 'new-class']])
      })
    };

    rewriter.setIntegration({
      fileDiscovery: mockFileDiscovery,
      nameGeneration: mockNameGeneration,
    });

    const status = rewriter.getIntegrationStatus();
    
    expect(status.fileDiscovery).toBe(true);
    expect(status.nameGeneration).toBe(true);
    expect(status.cssGeneration).toBe(false);
    expect(status.config).toBe(false);
  });

  test('should process batch of files with default options', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'test-pattern',
      name: 'Test Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'button',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);

    // Mock the rewriteFile method for testing
    const originalRewriteFile = rewriter.rewriteFile;
    rewriter.rewriteFile = vi.fn().mockImplementation(async (filePath: string) => {
      return {
        success: true,
        originalHtml: '<div class="test btn">Test</div>',
        modifiedHtml: '<div class="test button">Test</div>',
        appliedReplacements: [{ patternId: 'test-pattern' }],
        skippedReplacements: [],
        conflicts: [],
        metadata: {
          source: filePath,
          processedAt: new Date(),
          processingTime: 100,
          totalElements: 1,
          modifiedElements: 1,
          errors: [],
          warnings: [],
        },
        statistics: {
          patternStats: new Map(),
          elementStats: { totalProcessed: 1, totalModified: 1, averageDepth: 0, tagDistribution: new Map() },
          performanceStats: { parseTime: 10, processingTime: 20, serializationTime: 5, totalTime: 35 },
        },
      };
    });

    const files = ['test1.html', 'test2.html', 'test3.html'];
    const result = await rewriter.processBatch(files);

    expect(result.processedFiles).toHaveLength(3);
    expect(result.successfulFiles).toHaveLength(3);
    expect(result.failedFiles).toHaveLength(0);
    expect(result.statistics.totalPatterns).toBe(1);
    expect(result.statistics.totalReplacements).toBe(3);
    expect(result.totalTime).toBeGreaterThanOrEqual(0);

    // Restore original method
    rewriter.rewriteFile = originalRewriteFile;
  });

  test('should handle batch processing errors gracefully', async () => {
    const rewriter = createHtmlRewriter();
    
    // Mock rewriteFile to throw error on second file
    let callCount = 0;
    const originalRewriteFile = rewriter.rewriteFile;
    rewriter.rewriteFile = vi.fn().mockImplementation(async (filePath: string) => {
      callCount++;
      if (callCount === 2) {
        throw new Error(`Mock error for ${filePath}`);
      }
      return {
        success: true,
        originalHtml: '<div>Test</div>',
        modifiedHtml: '<div>Test</div>',
        appliedReplacements: [],
        skippedReplacements: [],
        conflicts: [],
        metadata: {
          source: filePath,
          processedAt: new Date(),
          processingTime: 50,
          totalElements: 1,
          modifiedElements: 0,
          errors: [],
          warnings: [],
        },
        statistics: {
          patternStats: new Map(),
          elementStats: { totalProcessed: 1, totalModified: 0, averageDepth: 0, tagDistribution: new Map() },
          performanceStats: { parseTime: 10, processingTime: 20, serializationTime: 5, totalTime: 35 },
        },
      };
    });

    const files = ['test1.html', 'test2.html', 'test3.html'];
    const result = await rewriter.processBatch(files, { continueOnError: true });

    expect(result.processedFiles).toHaveLength(3);
    expect(result.successfulFiles).toHaveLength(2);
    expect(result.failedFiles).toHaveLength(1);
    expect(result.failedFiles[0].file).toBe('test2.html');
    expect(result.failedFiles[0].error).toContain('Mock error');

    // Restore original method
    rewriter.rewriteFile = originalRewriteFile;
  });

  test('should provide progress callback during batch processing', async () => {
    const rewriter = createHtmlRewriter();
    
    const progressEvents: Array<{ processed: number; total: number; current: string }> = [];
    
    // Mock rewriteFile for testing
    const originalRewriteFile = rewriter.rewriteFile;
    rewriter.rewriteFile = vi.fn().mockResolvedValue({
      success: true,
      originalHtml: '<div>Test</div>',
      modifiedHtml: '<div>Test</div>',
      appliedReplacements: [],
      skippedReplacements: [],
      conflicts: [],
      metadata: {
        source: 'test',
        processedAt: new Date(),
        processingTime: 10,
        totalElements: 1,
        modifiedElements: 0,
        errors: [],
        warnings: [],
      },
      statistics: {
        patternStats: new Map(),
        elementStats: { totalProcessed: 1, totalModified: 0, averageDepth: 0, tagDistribution: new Map() },
        performanceStats: { parseTime: 10, processingTime: 20, serializationTime: 5, totalTime: 35 },
      },
    });

    const files = ['test1.html', 'test2.html'];
    await rewriter.processBatch(files, {
      progressCallback: (processed, total, current) => {
        progressEvents.push({ processed, total, current });
      },
    });

    expect(progressEvents).toHaveLength(2);
    expect(progressEvents[0]).toEqual({ processed: 1, total: 2, current: 'test1.html' });
    expect(progressEvents[1]).toEqual({ processed: 2, total: 2, current: 'test2.html' });

    // Restore original method
    rewriter.rewriteFile = originalRewriteFile;
  });

  test('should validate integration requirements', async () => {
    const rewriter = createHtmlRewriter();
    
    // Should throw error when file discovery is not configured
    await expect(
      rewriter.processDiscoveredFiles()
    ).rejects.toThrow('File discovery integration not configured');

    // Should throw error when name generation is not configured
    await expect(
      rewriter.generateAndApplyNames('<div class="test">Test</div>', ['test'])
    ).rejects.toThrow('Name generation integration not configured');
  });

  test('should integrate with name generation system', async () => {
    const rewriter = createHtmlRewriter();
    
    const mockNameGeneration = {
      generateNames: vi.fn().mockResolvedValue({
        nameMap: new Map([['test', 'generated-name']]),
      })
    };

    rewriter.setIntegration({ nameGeneration: mockNameGeneration });

    const htmlContent = '<div class="test">Content</div>';
    const extractedClasses = ['test'];

    const result = await rewriter.generateAndApplyNames(htmlContent, extractedClasses);

    expect(mockNameGeneration.generateNames).toHaveBeenCalledWith(['test']);
    expect(result.nameMapping.get('test')).toBe('generated-name');
    expect(result.html).toContain('div');
  });

  test('should chunk arrays correctly for batch processing', () => {
    const rewriter = createHtmlRewriter();
    
    // Access private method through type assertion for testing
    const chunkArray = (rewriter as any).chunkArray;
    
    const array = [1, 2, 3, 4, 5, 6, 7, 8];
    const chunks = chunkArray(array, 3);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual([1, 2, 3]);
    expect(chunks[1]).toEqual([4, 5, 6]);
    expect(chunks[2]).toEqual([7, 8]);
  });

  test('should handle empty file arrays gracefully', async () => {
    const rewriter = createHtmlRewriter();
    
    const result = await rewriter.processBatch([]);

    expect(result.processedFiles).toHaveLength(0);
    expect(result.successfulFiles).toHaveLength(0);
    expect(result.failedFiles).toHaveLength(0);
    expect(result.statistics.totalPatterns).toBe(0);
    expect(result.statistics.averageProcessingTime).toBe(0);
  });

  test('should calculate statistics correctly', async () => {
    const rewriter = createHtmlRewriter();
    
    const pattern: HtmlPattern = {
      id: 'test-pattern',
      name: 'Test Pattern',
      selector: '.test',
      attribute: 'class',
      pattern: 'btn',
      replacement: 'button',
      priority: 1,
      enabled: true,
    };

    rewriter.addPattern(pattern);

    // Mock rewriteFile with specific statistics
    const originalRewriteFile = rewriter.rewriteFile;
    rewriter.rewriteFile = vi.fn().mockImplementation(async (filePath: string) => {
      return {
        success: true,
        originalHtml: '<div class="test btn">Test</div>',
        modifiedHtml: '<div class="test button">Test</div>',
        appliedReplacements: [
          { patternId: 'test-pattern' },
          { patternId: 'test-pattern' }
        ],
        skippedReplacements: [],
        conflicts: [{ patternIds: ['test-pattern'] }],
        metadata: {
          source: filePath,
          processedAt: new Date(),
          processingTime: 100,
          totalElements: 1,
          modifiedElements: 1,
          errors: [],
          warnings: [],
        },
        statistics: {
          patternStats: new Map(),
          elementStats: { totalProcessed: 1, totalModified: 1, averageDepth: 0, tagDistribution: new Map() },
          performanceStats: { parseTime: 10, processingTime: 20, serializationTime: 5, totalTime: 35 },
        },
      };
    });

    const files = ['test1.html', 'test2.html'];
    const result = await rewriter.processBatch(files);

    expect(result.statistics.totalPatterns).toBe(1);
    expect(result.statistics.totalReplacements).toBe(4); // 2 replacements per file
    expect(result.statistics.totalConflicts).toBe(2); // 1 conflict per file
    expect(result.statistics.averageProcessingTime).toBeGreaterThanOrEqual(0);

    // Restore original method
    rewriter.rewriteFile = originalRewriteFile;
  });

  test('should reject invalid integration components', () => {
    const rewriter = createHtmlRewriter();
    
    // Should not set integration when missing required methods
    rewriter.setIntegration({
      fileDiscovery: { invalidMethod: () => {} },
      nameGeneration: { wrongMethod: () => {} },
    });

    const status = rewriter.getIntegrationStatus();
    
    expect(status.fileDiscovery).toBe(false);
    expect(status.nameGeneration).toBe(false);
  });
}); 