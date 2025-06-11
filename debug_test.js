import { createHtmlRewriter } from './dist/src/index.js';

async function test() {
  try {
    const rewriter = createHtmlRewriter();
    
    const pattern = {
      id: 'test',
      name: 'Test',
      selector: '.button',
      attribute: 'class',
      pattern: 'btn-primary',
      replacement: 'button-main',
      priority: 1,
      enabled: true,
    };
    
    rewriter.addPattern(pattern);
    
    console.log('Patterns added:', rewriter.getPatterns().length);
    console.log('Pattern details:', JSON.stringify(rewriter.getPatterns()[0], null, 2));
    
    const html = '<div class="button btn-primary">Click me</div>';
    console.log('Input HTML:', html);
    
    const result = await rewriter.rewriteHtml(html);
    
    console.log('Success:', result.success);
    console.log('Original:', result.originalHtml);
    console.log('Modified:', result.modifiedHtml);
    console.log('Applied replacements:', result.appliedReplacements?.length || 0);
    console.log('Applied details:', JSON.stringify(result.appliedReplacements, null, 2));
    console.log('Skipped:', result.skippedReplacements?.length || 0);
    console.log('Errors:', result.metadata?.errors || []);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test(); 