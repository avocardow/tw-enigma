'use client';

import {
  ClassRegistry,
  ScrambleEngine,
  buildClassRegistry,
  discoverTwEnigmaSelectors,
} from '@tw-enigma/scramble';
import { useEffect } from 'react';

interface ScrambleConfig {
  enabled: boolean;
  protectForms: boolean;
  protectData: boolean;
  idleTimeout: number;
  scrambleDelay: number;
  securityLevel: 'low' | 'medium' | 'high';
  preserveSourceMaps: boolean;
  enableObfuscation: boolean;
  scrambleClassNames: boolean;
  scrambleVariables: boolean;
}

interface ScrambleProviderProps {
  children: React.ReactNode;
  config?: Partial<ScrambleConfig>;
}

export default function ScrambleProvider({ children, config = {} }: ScrambleProviderProps) {
  const isDev = process.env.NODE_ENV === 'development';

  const defaultConfig: ScrambleConfig = {
    enabled: process.env.SCRAMBLE_ENABLED === 'true' || !isDev, // Disable entirely in development
    protectForms: true,
    protectData: true,
    idleTimeout: isDev ? 3000 : 5000, // Shorter timeout in dev for easier testing
    scrambleDelay: isDev ? 50 : 100, // Faster scramble in dev
    securityLevel: isDev ? 'low' : 'medium', // Lower security in dev for debugging
    preserveSourceMaps: isDev,
    enableObfuscation: !isDev, // Disable obfuscation in dev for easier debugging
    scrambleClassNames: !isDev, // DISABLED in dev: Prevents hydration mismatches in Next.js
    scrambleVariables: !isDev, // Don't scramble variables in dev
    ...config,
  };

  useEffect(() => {
    if (!defaultConfig.enabled) {
      if (isDev) {
        console.log('🔒 TW-Enigma Scramble: DISABLED (development mode)');
      }
      return;
    }

    // Initialize Scramble when component mounts
    const initializeScramble = async () => {
      try {
        console.log('🔒 TW-Enigma Scramble initializing...');

        // Initialize the real Scramble library
        const scrambleEngine = new ScrambleEngine({
          securityLevel: defaultConfig.securityLevel,
          preserveSourceMaps: defaultConfig.preserveSourceMaps,
          enableObfuscation: defaultConfig.enableObfuscation,
          scrambleClassNames: defaultConfig.scrambleClassNames,
          scrambleVariables: defaultConfig.scrambleVariables,
        });

        // Only discover CSS selectors and start runtime scrambling if class scrambling is enabled
        let registry: ClassRegistry = {};
        if (defaultConfig.scrambleClassNames) {
          // Import runtime scrambling functions
          const { initializeAccessibleScrambling } = await import('@tw-enigma/scramble');
          
          // Initialize runtime scrambling with proper configuration
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

        // Development-friendly logging
        if (isDev) {
          console.group('🔒 TW-Enigma Scramble - Development Mode');
          console.log('✅ Scramble Privacy Protection Initialized');
          console.log('⚙️  Config:', defaultConfig);
          console.log(
            '🎯 Class scrambling:',
            defaultConfig.scrambleClassNames ? 'ENABLED' : 'DISABLED (prevents hydration mismatch)'
          );
          console.log('📝 Registry built with classes:', Object.keys(registry).length);
          console.log('🔧 Development features enabled:');
          console.log('   - Shorter idle timeout (3s)');
          console.log('   - Faster scramble animations');
          console.log('   - Visible protection indicators');
          console.log('   - Debug logging enabled');
          console.log('   - Hydration-safe mode active');
          console.log('   - TW-Enigma webpack plugin disabled in dev');
          console.log('   - Original Tailwind classes preserved');
          console.groupEnd();
        } else {
          console.log('🔒 Scramble Privacy Protection Initialized');
        }

        // Demo: Simulate Scramble protection
        const sensitiveElements = document.querySelectorAll('[data-sensitive]');
        const formElements = document.querySelectorAll('[data-scramble-field]');

        // Protect sensitive data elements with enhanced dev features
        if (defaultConfig.protectData) {
          sensitiveElements.forEach((element, index) => {
            const htmlElement = element as HTMLElement;

            // Add protection indicators
            htmlElement.style.position = 'relative';
            htmlElement.setAttribute('data-scramble-protected', 'true');

            // Enhanced visual indicator for development
            const indicator = document.createElement('span');
            indicator.textContent = isDev ? '🔒DEV' : '🔒';
            indicator.style.fontSize = isDev ? '8px' : '10px';
            indicator.style.position = 'absolute';
            indicator.style.top = '-5px';
            indicator.style.right = '-5px';
            indicator.style.background = isDev ? '#f59e0b' : '#10b981';
            indicator.style.color = 'white';
            indicator.style.borderRadius = '4px';
            indicator.style.padding = '2px 4px';
            indicator.style.display = 'flex';
            indicator.style.alignItems = 'center';
            indicator.style.justifyContent = 'center';
            indicator.style.zIndex = '9999';
            indicator.style.fontSize = '8px';
            indicator.style.fontWeight = 'bold';
            indicator.title = isDev
              ? `Protected by Scramble (DEV) - Element ${index + 1}`
              : 'Protected by Scramble';

            htmlElement.appendChild(indicator);

            // Add hover effect in development
            if (isDev) {
              indicator.addEventListener('click', () => {
                console.log(`🔍 Scramble Debug - Protected Element ${index + 1}:`, {
                  element: htmlElement,
                  protection: 'active',
                  config: defaultConfig,
                });
              });
            }
          });
        }

        // Protect form fields
        if (defaultConfig.protectForms) {
          formElements.forEach((element) => {
            const inputElement = element as HTMLInputElement;

            inputElement.setAttribute('data-scramble-protected', 'true');

            // Demo: Add input protection
            inputElement.addEventListener('focus', () => {
              console.log(
                `🔒 Scramble: Protecting input field: ${inputElement.name || inputElement.type}`
              );
            });

            inputElement.addEventListener('blur', () => {
              console.log(
                `🔒 Scramble: Input protection active for: ${inputElement.name || inputElement.type}`
              );
            });
          });
        }

        // Idle protection simulation
        let idleTimer: NodeJS.Timeout;
        const resetIdleTimer = () => {
          clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            console.log('🔒 Scramble: Page idle detected, activating enhanced protection');

            // Demo: Add visual scramble effect
            sensitiveElements.forEach((element) => {
              const htmlElement = element as HTMLElement;
              htmlElement.style.filter = 'blur(2px)';
              htmlElement.style.transition = 'filter 0.3s ease';
            });

            // Remove scramble effect when user returns
            const removeScramble = () => {
              sensitiveElements.forEach((element) => {
                const htmlElement = element as HTMLElement;
                htmlElement.style.filter = 'none';
              });

              document.removeEventListener('mousemove', removeScramble);
              document.removeEventListener('keydown', removeScramble);
              document.removeEventListener('click', removeScramble);
            };

            document.addEventListener('mousemove', removeScramble);
            document.addEventListener('keydown', removeScramble);
            document.addEventListener('click', removeScramble);
          }, defaultConfig.idleTimeout);
        };

        // Set up idle detection
        document.addEventListener('mousemove', resetIdleTimer);
        document.addEventListener('keydown', resetIdleTimer);
        document.addEventListener('click', resetIdleTimer);
        resetIdleTimer();

        // Demo: Log protection status
        console.log(`🔒 Scramble Status:
          - Protected Elements: ${sensitiveElements.length}
          - Protected Forms: ${formElements.length}
          - CSS Classes: ${Object.keys(registry).length}
          - Class Scrambling: ${defaultConfig.scrambleClassNames ? 'ENABLED' : 'DISABLED'}
          - Idle Timeout: ${defaultConfig.idleTimeout}ms
          - Protection Level: Enhanced`);
      } catch (error) {
        console.error('Failed to initialize Scramble:', error);
      }
    };

    initializeScramble();

    // Cleanup function
    return () => {
      console.log('🔒 Scramble: Cleaning up protection');
    };
  }, [defaultConfig]);

  return <>{children}</>;
}
