declare module '@tw-enigma/scramble' {
  export function scramble(element: HTMLElement, options?: any): void;
  export function unscramble(element: HTMLElement): void;
  export function configure(options: any): void;
  export function buildClassRegistry(options?: any): Map<string, string>;
  export function discoverTwEnigmaSelectors(options?: any): string[];
}
