declare module 'webpack' {
  export interface Compiler {
    hooks: {
      beforeRun: any;
      compilation: any;
      afterEmit: any;
      done: any;
      watchRun: any;
      emit: any;
    };
    options: Configuration;
    context?: string;
    webpack?: any;
  }

  export interface Configuration {
    entry?: any;
    output?: any;
    module?: any;
    plugins?: WebpackPluginInstance[];
    mode?: 'development' | 'production' | 'none';
  }

  export interface WebpackPluginInstance {
    apply(compiler: Compiler): void;
  }
}
