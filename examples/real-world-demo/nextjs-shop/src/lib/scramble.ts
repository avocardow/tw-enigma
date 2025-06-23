import {
  ScrambleEngine,
  initializeAccessibleScrambling,
  type ClassRegistry,
} from '@tw-enigma/scramble';

export function initScramble() {
  // Only run on the client side
  if (typeof window === 'undefined') {
    return;
  }

  const isDev = process.env.NODE_ENV === 'development';

  const defaultConfig = {
    enabled: process.env.SCRAMBLE_ENABLED === 'true' || !isDev,
    protectForms: true,
    protectData: true,
    idleTimeout: isDev ? 3000 : 5000,
    scrambleDelay: isDev ? 50 : 100,
    securityLevel: (isDev ? 'low' : 'medium') as 'low' | 'medium' | 'high',
    preserveSourceMaps: isDev,
    enableObfuscation: !isDev,
    scrambleClassNames: !isDev,
    scrambleVariables: !isDev,
  };

  if (!defaultConfig.enabled) {
    if (isDev) {
      console.log('🔒 TW-Enigma Scramble: DISABLED (development mode)');
    }
    return;
  }

  const initialize = async () => {
    try {
      console.log('🔒 TW-Enigma Scramble initializing...');

      const scrambleEngine = new ScrambleEngine({
        securityLevel: defaultConfig.securityLevel,
        preserveSourceMaps: defaultConfig.preserveSourceMaps,
        enableObfuscation: defaultConfig.enableObfuscation,
        scrambleClassNames: defaultConfig.scrambleClassNames,
        scrambleVariables: defaultConfig.scrambleVariables,
      });

      let registry: ClassRegistry = {};
      if (defaultConfig.scrambleClassNames) {
        const scrambleResult = await initializeAccessibleScrambling(undefined, {
          respectReducedMotion: true,
          scrambleInterval: defaultConfig.scrambleDelay,
          enablePerformanceMonitoring: isDev,
        } as any);

        if (scrambleResult.initialized && scrambleResult.controller) {
          registry = scrambleResult.registry || {};
          console.log('✅ Runtime scrambling initialized');
        } else {
          console.log('⚠️  Runtime scrambling not initialized:', scrambleResult.reason);
        }
      } else {
        console.log('⚠️  Class scrambling disabled - runtime scrambling skipped');
      }
    } catch (error) {
      console.error('Failed to initialize Scramble:', error);
    }
  };

  initialize();
}
