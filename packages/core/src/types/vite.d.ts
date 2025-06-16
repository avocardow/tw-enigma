declare module 'vite' {
  export interface ViteDevServer {
    middlewares: any;
    ws: any;
    hot: any;
    config: any;
  }

  export interface ResolvedConfig {
    root: string;
    build: any;
    optimizeDeps: any;
    command: 'build' | 'serve';
    mode: string;
  }

  export interface Plugin {
    name: string;
    configResolved?: (config: ResolvedConfig) => void;
    configureServer?: (server: ViteDevServer) => void;
    buildStart?: () => Promise<void> | void;
    transform?: (code: string, id: string) => Promise<any> | any;
    generateBundle?: () => Promise<void> | void;
    writeBundle?: (options: any, bundle: any) => void;
    handleHotUpdate?: (ctx: any) => void;
  }
}
