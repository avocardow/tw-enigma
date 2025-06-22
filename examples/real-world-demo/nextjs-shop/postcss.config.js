// TW-Enigma PostCSS Integration
const { EnhancedCSSGenerator, loadConfig } = require('@tw-enigma/core');

// Create TW-Enigma PostCSS plugin using the proper API
function createTwEnigmaPlugin(options = {}) {
  return {
    postcssPlugin: 'tw-enigma',
    async Once(root, { result }) {
      try {
        console.log('🔧 TW-Enigma: Processing CSS with EnhancedCSSGenerator...');

        // Load TW-Enigma configuration
        const config = await loadConfig().catch(() => ({
          // Default configuration if none found
          enabled: true,
          strategy: 'hybrid',
          development: {
            enableOptimization: true,
            preserveComments: true,
          },
        }));

        // Extract CSS content
        const css = root.toString();

        // Simple class frequency analysis
        const classFrequencies = new Map();
        const classMatches = css.match(/\.[a-zA-Z0-9_-]+/g) || [];

        classMatches.forEach((cls) => {
          const className = cls.slice(1); // Remove the dot
          classFrequencies.set(className, (classFrequencies.get(className) || 0) + 1);
        });

        if (classFrequencies.size > 0) {
          console.log(`🔧 TW-Enigma: Found ${classFrequencies.size} unique classes`);

          // Create frequency analyzer (simplified)
          const frequencyAnalyzer = {
            getFrequencies: () => classFrequencies,
            getTopClasses: (n) =>
              Array.from(classFrequencies.entries())
                .sort(([, a], [, b]) => b - a)
                .slice(0, n),
          };

          // Create CSS generator
          const generator = new EnhancedCSSGenerator(config, frequencyAnalyzer, true);

          // Generate enhanced CSS
          const enhancedResult = await generator.generateEnhancedCSS(classFrequencies, {
            strategy: 'mixed',
            useApplyDirective: true,
            sortingStrategy: 'frequency',
            commentLevel: 'basic',
          });

          if (enhancedResult && enhancedResult.css) {
            console.log(
              `✅ TW-Enigma: Generated optimized CSS (${enhancedResult.css.length} bytes)`
            );
            console.log(
              `✅ TW-Enigma: Created ${enhancedResult.rules?.length || 0} optimized rules`
            );

            // Replace the CSS content with optimized version
            root.removeAll();
            root.append(enhancedResult.css);
          }
        }
      } catch (error) {
        console.warn('⚠️ TW-Enigma: Error during CSS optimization:', error.message);
        // Continue with original CSS if optimization fails
      }
    },
  };
}

// Mark as PostCSS plugin
createTwEnigmaPlugin.postcss = true;

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
