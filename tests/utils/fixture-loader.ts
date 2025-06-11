import { readFile, readdir, stat } from 'fs/promises';
import { join, resolve, relative, extname, basename } from 'path';
import { existsSync } from 'fs';

export interface FixtureProject {
  name: string;
  framework: 'react' | 'nextjs' | 'vite';
  complexity: 'simple' | 'complex' | 'edge-cases';
  path: string;
  files: FixtureFile[];
  packageJson?: any;
  configFiles: ConfigFile[];
}

export interface FixtureFile {
  path: string;
  relativePath: string;
  content: string;
  extension: string;
  size: number;
  type: 'component' | 'style' | 'config' | 'test' | 'other';
}

export interface ConfigFile {
  name: string;
  path: string;
  content: string;
  type: 'package.json' | 'tailwind.config.js' | 'vite.config.ts' | 'next.config.js' | 'tsconfig.json' | 'other';
}

export interface LoadFixtureOptions {
  includeNodeModules?: boolean;
  maxFileSize?: number;
  excludePatterns?: string[];
  includeExtensions?: string[];
}

export class FixtureLoader {
  private fixturesRoot: string;
  private cache = new Map<string, FixtureProject>();

  constructor(fixturesRoot: string = join(process.cwd(), 'tests/fixtures')) {
    this.fixturesRoot = resolve(fixturesRoot);
  }

  /**
   * Load all available fixture projects
   */
  async loadAllFixtures(options: LoadFixtureOptions = {}): Promise<FixtureProject[]> {
    const frameworks = await this.getAvailableFrameworks();
    const projects: FixtureProject[] = [];

    for (const framework of frameworks) {
      const complexities = await this.getAvailableComplexities(framework);
      
      for (const complexity of complexities) {
        try {
          const project = await this.loadFixture(framework, complexity, options);
          projects.push(project);
        } catch (error) {
          console.warn(`Failed to load fixture ${framework}/${complexity}:`, error);
        }
      }
    }

    return projects;
  }

  /**
   * Load a specific fixture project
   */
  async loadFixture(
    framework: 'react' | 'nextjs' | 'vite',
    complexity: 'simple' | 'complex' | 'edge-cases',
    options: LoadFixtureOptions = {}
  ): Promise<FixtureProject> {
    const cacheKey = `${framework}-${complexity}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const projectPath = join(this.fixturesRoot, framework, complexity);
    
    if (!existsSync(projectPath)) {
      throw new Error(`Fixture not found: ${framework}/${complexity}`);
    }

    const project: FixtureProject = {
      name: `${framework}-${complexity}`,
      framework,
      complexity,
      path: projectPath,
      files: [],
      configFiles: []
    };

    // Load package.json if it exists
    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageContent = await readFile(packageJsonPath, 'utf-8');
        project.packageJson = JSON.parse(packageContent);
      } catch (error) {
        console.warn(`Failed to parse package.json for ${cacheKey}:`, error);
      }
    }

    // Load all files
    project.files = await this.loadProjectFiles(projectPath, options);
    project.configFiles = await this.loadConfigFiles(projectPath);

    this.cache.set(cacheKey, project);
    return project;
  }

  /**
   * Get available frameworks
   */
  async getAvailableFrameworks(): Promise<('react' | 'nextjs' | 'vite')[]> {
    try {
      const items = await readdir(this.fixturesRoot, { withFileTypes: true });
      return items
        .filter(item => item.isDirectory())
        .map(item => item.name)
        .filter(name => ['react', 'nextjs', 'vite'].includes(name)) as ('react' | 'nextjs' | 'vite')[];
    } catch (error) {
      console.warn('Failed to read fixtures directory:', error);
      return [];
    }
  }

  /**
   * Get available complexities for a framework
   */
  async getAvailableComplexities(framework: string): Promise<('simple' | 'complex' | 'edge-cases')[]> {
    try {
      const frameworkPath = join(this.fixturesRoot, framework);
      const items = await readdir(frameworkPath, { withFileTypes: true });
      return items
        .filter(item => item.isDirectory())
        .map(item => item.name)
        .filter(name => ['simple', 'complex', 'edge-cases'].includes(name)) as ('simple' | 'complex' | 'edge-cases')[];
    } catch (error) {
      console.warn(`Failed to read complexities for ${framework}:`, error);
      return [];
    }
  }

  /**
   * Load all files in a project directory
   */
  private async loadProjectFiles(
    projectPath: string,
    options: LoadFixtureOptions
  ): Promise<FixtureFile[]> {
    const files: FixtureFile[] = [];
    const {
      includeNodeModules = false,
      maxFileSize = 5 * 1024 * 1024, // 5MB default
      excludePatterns = ['node_modules', 'dist', 'build', '.git', '.next'],
      includeExtensions = ['.tsx', '.ts', '.jsx', '.js', '.vue', '.html', '.css', '.json', '.md']
    } = options;

    const walk = async (currentPath: string): Promise<void> => {
      const items = await readdir(currentPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = join(currentPath, item.name);
        const relativePath = relative(projectPath, fullPath);

        // Skip excluded patterns
        if (!includeNodeModules && excludePatterns.some(pattern => relativePath.includes(pattern))) {
          continue;
        }

        if (item.isDirectory()) {
          await walk(fullPath);
        } else if (item.isFile()) {
          const ext = extname(item.name);
          
          // Skip files with unsupported extensions
          if (includeExtensions.length > 0 && !includeExtensions.includes(ext)) {
            continue;
          }

          try {
            const fileStat = await stat(fullPath);
            
            // Skip files that are too large
            if (fileStat.size > maxFileSize) {
              console.warn(`Skipping large file: ${relativePath} (${fileStat.size} bytes)`);
              continue;
            }

            const content = await readFile(fullPath, 'utf-8');
            
            files.push({
              path: fullPath,
              relativePath,
              content,
              extension: ext,
              size: fileStat.size,
              type: this.getFileType(ext, item.name)
            });
          } catch (error) {
            console.warn(`Failed to read file ${relativePath}:`, error);
          }
        }
      }
    };

    await walk(projectPath);
    return files;
  }

  /**
   * Load configuration files
   */
  private async loadConfigFiles(projectPath: string): Promise<ConfigFile[]> {
    const configFiles: ConfigFile[] = [];
    const configFilePatterns = [
      'package.json',
      'tailwind.config.js',
      'tailwind.config.ts',
      'vite.config.js',
      'vite.config.ts',
      'next.config.js',
      'next.config.ts',
      'tsconfig.json',
      'babel.config.js',
      'webpack.config.js'
    ];

    for (const pattern of configFilePatterns) {
      const configPath = join(projectPath, pattern);
      
      if (existsSync(configPath)) {
        try {
          const content = await readFile(configPath, 'utf-8');
          configFiles.push({
            name: pattern,
            path: configPath,
            content,
            type: this.getConfigType(pattern)
          });
        } catch (error) {
          console.warn(`Failed to read config file ${pattern}:`, error);
        }
      }
    }

    return configFiles;
  }

  /**
   * Determine file type based on extension and name
   */
  private getFileType(extension: string, filename: string): FixtureFile['type'] {
    if (['.test.', '.spec.'].some(pattern => filename.includes(pattern))) {
      return 'test';
    }
    
    if (['.tsx', '.ts', '.jsx', '.js', '.vue'].includes(extension)) {
      return 'component';
    }
    
    if (['.css', '.scss', '.sass', '.less'].includes(extension)) {
      return 'style';
    }
    
    if (['package.json', 'tsconfig.json'].includes(filename) || filename.includes('config')) {
      return 'config';
    }
    
    return 'other';
  }

  /**
   * Determine config file type
   */
  private getConfigType(filename: string): ConfigFile['type'] {
    if (filename === 'package.json') return 'package.json';
    if (filename.includes('tailwind.config')) return 'tailwind.config.js';
    if (filename.includes('vite.config')) return 'vite.config.ts';
    if (filename.includes('next.config')) return 'next.config.js';
    if (filename === 'tsconfig.json') return 'tsconfig.json';
    return 'other';
  }

  /**
   * Get fixture statistics
   */
  getFixtureStats(project: FixtureProject): {
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
    filesByExtension: Record<string, number>;
    averageFileSize: number;
  } {
    const stats = {
      totalFiles: project.files.length,
      totalSize: project.files.reduce((sum, file) => sum + file.size, 0),
      filesByType: {} as Record<string, number>,
      filesByExtension: {} as Record<string, number>,
      averageFileSize: 0
    };

    for (const file of project.files) {
      stats.filesByType[file.type] = (stats.filesByType[file.type] || 0) + 1;
      stats.filesByExtension[file.extension] = (stats.filesByExtension[file.extension] || 0) + 1;
    }

    stats.averageFileSize = stats.totalFiles > 0 ? stats.totalSize / stats.totalFiles : 0;

    return stats;
  }

  /**
   * Filter files by criteria
   */
  filterFiles(
    project: FixtureProject,
    criteria: {
      type?: FixtureFile['type'];
      extension?: string;
      maxSize?: number;
      minSize?: number;
      namePattern?: RegExp;
    }
  ): FixtureFile[] {
    return project.files.filter(file => {
      if (criteria.type && file.type !== criteria.type) return false;
      if (criteria.extension && file.extension !== criteria.extension) return false;
      if (criteria.maxSize && file.size > criteria.maxSize) return false;
      if (criteria.minSize && file.size < criteria.minSize) return false;
      if (criteria.namePattern && !criteria.namePattern.test(basename(file.path))) return false;
      return true;
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
} 