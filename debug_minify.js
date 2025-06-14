const mockMinifiableCss = `
/* Remove this comment */
.test {
  color: red;
  color: blue; /* duplicate */
}

.test {
  background: white;
}

.empty-rule {
  /* nothing here */
}

.calc-test {
  width: calc(100px + 50px);
  height: calc(10px);
}

.color-test {
  color: #ff0000;
  background: rgb(255, 255, 255);
  border: #aabbcc;
}
`;

const mockCssContent = `
/* Main styles */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 1rem 0;
}

.nav-item {
  display: inline-block;
  margin-right: 2rem;
  color: #4a5568;
}

.nav-item:hover {
  color: #2d3748;
}

@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
  
  .nav-item {
    display: block;
    margin: 0.5rem 0;
  }
}
`;

function minifyContent(css) {
  let processed = css;

  // Remove comments
  processed = processed.replace(/\/\*(?![!])[\s\S]*?\*\//g, '');

  // Remove empty rules
  processed = processed.replace(/[^{}]*\{\s*\}/g, '');

  // Normalize colors
  processed = processed.replace(/#([a-f0-9])\1([a-f0-9])\2([a-f0-9])\3/gi, '#$1$2$3');

  // Optimize calc() expressions
  processed = processed
    .replace(/calc\((\d+)px\)/g, '$1px')
    .replace(/calc\((\d+)px\s*\+\s*(\d+)px\)/g, (match, a, b) => `${parseInt(a) + parseInt(b)}px`);

  // Basic minification - remove unnecessary whitespace
  processed = processed
    .replace(/\s+/g, ' ')
    .replace(/;\s*}/g, '}')
    .replace(/\s*{\s*/g, '{')
    .replace(/;\s*/g, ';')
    .trim();

  return processed;
}

console.log('=== mockMinifiableCss ===');
console.log('Original length:', mockMinifiableCss.length);
const minifiedMockMinifiableCss = minifyContent(mockMinifiableCss);
console.log('Minified length:', minifiedMockMinifiableCss.length);
console.log('Size reduction:', mockMinifiableCss.length - minifiedMockMinifiableCss.length);

console.log('\n=== mockCssContent ===');
console.log('Original length:', mockCssContent.length);
const minifiedMockCssContent = minifyContent(mockCssContent);
console.log('Minified length:', minifiedMockCssContent.length);
console.log('Size reduction:', mockCssContent.length - minifiedMockCssContent.length);

console.log('\n=== Comparison ===');
console.log('mockMinifiableCss original:', mockMinifiableCss.length);
console.log('mockCssContent minified:', minifiedMockCssContent.length);
console.log('Is mockCssContent minified smaller than mockMinifiableCss original?', 
  minifiedMockCssContent.length < mockMinifiableCss.length); 