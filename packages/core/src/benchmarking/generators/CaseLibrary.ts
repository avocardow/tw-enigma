import { join } from 'path';
import { promises as fs } from 'fs';
import { createLogger } from '../../utils/logger';
import { BenchmarkCase, BenchmarkConfig } from '../types';
import { SyntheticCaseGenerator, SyntheticCaseConfig, SYNTHETIC_PRESETS } from './SyntheticCaseGenerator';

const logger = createLogger('CaseLibrary');

/**
 * Library metadata for a benchmark case
 */
export interface CaseLibraryEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  estimatedDuration: number; // in milliseconds
  author?: string;
  version: string;
  created: Date;
  updated: Date;
  config: SyntheticCaseConfig;
  usage: {
    runCount: number;
    lastRun?: Date;
    avgDuration?: number;
    successRate: number;
  };
}

/**
 * Case library search filters
 */
export interface CaseLibraryFilters {
  category?: string;
  tags?: string[];
  difficulty?: string[];
  maxDuration?: number;
  workloadType?: string;
  concurrency?: boolean;
}

/**
 * Case library search result
 */
export interface CaseLibrarySearchResult {
  entries: CaseLibraryEntry[];
  totalCount: number;
  filteredCount: number;
  facets: {
    categories: Record<string, number>;
    tags: Record<string, number>;
    difficulties: Record<string, number>;
    workloadTypes: Record<string, number>;
  };
}

/**
 * Built-in case categories and their descriptions
 */
export const CASE_CATEGORIES = {
  'performance': {
    name: 'Performance Testing',
    description: 'Cases focused on performance characteristics and optimization ratios',
    icon: '⚡',
  },
  'stress': {
    name: 'Stress Testing', 
    description: 'High-load cases designed to test system limits',
    icon: '🔥',
  },
  'memory': {
    name: 'Memory Testing',
    description: 'Cases that test memory usage patterns and efficiency',
    icon: '🧠',
  },
  'concurrency': {
    name: 'Concurrency Testing',
    description: 'Cases that test concurrent processing capabilities',
    icon: '⚙️',
  },
  'io': {
    name: 'I/O Testing',
    description: 'Cases focused on file system and network I/O operations',
    icon: '💾',
  },
  'edge-cases': {
    name: 'Edge Cases',
    description: 'Unusual scenarios and boundary conditions',
    icon: '🎯',
  },
  'regression': {
    name: 'Regression Testing',
    description: 'Cases designed to catch performance regressions',
    icon: '🛡️',
  },
  'baseline': {
    name: 'Baseline Testing',
    description: 'Standard benchmark cases for establishing baselines',
    icon: '📊',
  },
} as const;

/**
 * Library for managing reusable benchmark cases
 */
export class CaseLibrary {
  private libraryPath: string;
  private entries: Map<string, CaseLibraryEntry> = new Map();
  private initialized = false;

  constructor(libraryPath: string = './benchmark-library') {
    this.libraryPath = libraryPath;
    
    logger.debug('CaseLibrary initialized', { libraryPath });
  }

  /**
   * Initialize the case library
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.ensureLibraryDirectory();
      await this.loadLibraryEntries();
      await this.populateBuiltInCases();
      
      this.initialized = true;
      
      logger.info('Case library initialized', {
        entriesCount: this.entries.size,
        libraryPath: this.libraryPath,
      });
    } catch (error) {
      logger.error('Failed to initialize case library', { error });
      throw error;
    }
  }

  /**
   * Search for benchmark cases
   */
  async search(
    query?: string,
    filters: CaseLibraryFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<CaseLibrarySearchResult> {
    await this.ensureInitialized();

    let filteredEntries = Array.from(this.entries.values());

    // Apply text search
    if (query && query.trim()) {
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
      filteredEntries = filteredEntries.filter(entry => {
        const searchableText = [
          entry.name,
          entry.description,
          entry.category,
          ...entry.tags,
        ].join(' ').toLowerCase();
        
        return searchTerms.every(term => searchableText.includes(term));
      });
    }

    // Apply filters
    if (filters.category) {
      filteredEntries = filteredEntries.filter(entry => entry.category === filters.category);
    }

    if (filters.tags && filters.tags.length > 0) {
      filteredEntries = filteredEntries.filter(entry =>
        filters.tags!.every(tag => entry.tags.includes(tag))
      );
    }

    if (filters.difficulty && filters.difficulty.length > 0) {
      filteredEntries = filteredEntries.filter(entry => 
        filters.difficulty!.includes(entry.difficulty)
      );
    }

    if (filters.maxDuration) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.estimatedDuration <= filters.maxDuration!
      );
    }

    if (filters.workloadType) {
      filteredEntries = filteredEntries.filter(entry =>
        entry.config.workload.type === filters.workloadType
      );
    }

    if (filters.concurrency !== undefined) {
      filteredEntries = filteredEntries.filter(entry =>
        entry.config.concurrency.enabled === filters.concurrency
      );
    }

    // Sort by relevance (usage count, then update date)
    filteredEntries.sort((a, b) => {
      const scoreA = a.usage.runCount + (a.updated.getTime() / 1000000);
      const scoreB = b.usage.runCount + (b.updated.getTime() / 1000000);
      return scoreB - scoreA;
    });

    // Calculate facets
    const facets = this.calculateFacets(filteredEntries);

    // Apply pagination
    const paginatedEntries = filteredEntries.slice(offset, offset + limit);

    return {
      entries: paginatedEntries,
      totalCount: this.entries.size,
      filteredCount: filteredEntries.length,
      facets,
    };
  }

  /**
   * Get a specific case by ID
   */
  async getCase(id: string): Promise<CaseLibraryEntry | null> {
    await this.ensureInitialized();
    return this.entries.get(id) || null;
  }

  /**
   * Generate a benchmark case from library entry
   */
  async generateBenchmarkCase(id: string): Promise<BenchmarkCase> {
    const entry = await this.getCase(id);
    if (!entry) {
      throw new Error(`Case not found: ${id}`);
    }

    try {
      const generator = new SyntheticCaseGenerator(entry.config);
      const benchmarkCase = await generator.generateCase();

      // Update usage statistics
      await this.updateUsageStats(id);

      logger.info('Generated benchmark case from library', {
        id: entry.id,
        name: entry.name,
        category: entry.category,
      });

      return benchmarkCase;
    } catch (error) {
      logger.error('Failed to generate benchmark case from library', { error, id });
      throw error;
    }
  }

  /**
   * Add a new case to the library
   */
  async addCase(
    config: SyntheticCaseConfig,
    metadata: {
      category: string;
      tags?: string[];
      difficulty?: 'easy' | 'medium' | 'hard' | 'extreme';
      author?: string;
    }
  ): Promise<string> {
    await this.ensureInitialized();

    const id = this.generateCaseId(config.name);
    const now = new Date();

    const entry: CaseLibraryEntry = {
      id,
      name: config.name,
      description: config.description || '',
      category: metadata.category,
      tags: metadata.tags || [],
      difficulty: metadata.difficulty || 'medium',
      estimatedDuration: config.performance.expectedDuration,
      author: metadata.author,
      version: '1.0.0',
      created: now,
      updated: now,
      config,
      usage: {
        runCount: 0,
        successRate: 0,
      },
    };

    this.entries.set(id, entry);
    await this.saveCaseEntry(entry);

    logger.info('Added new case to library', {
      id,
      name: entry.name,
      category: entry.category,
    });

    return id;
  }

  /**
   * Update an existing case
   */
  async updateCase(
    id: string,
    updates: Partial<Pick<CaseLibraryEntry, 'name' | 'description' | 'category' | 'tags' | 'difficulty' | 'config'>>
  ): Promise<void> {
    await this.ensureInitialized();

    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Case not found: ${id}`);
    }

    // Update entry
    Object.assign(entry, updates, { updated: new Date() });
    
    // Increment version
    const [major, minor, patch] = entry.version.split('.').map(Number);
    entry.version = `${major}.${minor}.${patch + 1}`;

    this.entries.set(id, entry);
    await this.saveCaseEntry(entry);

    logger.info('Updated case in library', { id, updates: Object.keys(updates) });
  }

  /**
   * Remove a case from the library
   */
  async removeCase(id: string): Promise<boolean> {
    await this.ensureInitialized();

    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }

    this.entries.delete(id);
    
    try {
      const entryPath = join(this.libraryPath, 'cases', `${id}.json`);
      await fs.unlink(entryPath);
    } catch (error) {
      logger.warn('Failed to delete case file', { error, id });
    }

    logger.info('Removed case from library', { id, name: entry.name });
    return true;
  }

  /**
   * Get cases by category
   */
  async getCasesByCategory(category: string): Promise<CaseLibraryEntry[]> {
    const result = await this.search('', { category });
    return result.entries;
  }

  /**
   * Get cases by tags
   */
  async getCasesByTags(tags: string[]): Promise<CaseLibraryEntry[]> {
    const result = await this.search('', { tags });
    return result.entries;
  }

  /**
   * Get popular cases (most used)
   */
  async getPopularCases(limit: number = 10): Promise<CaseLibraryEntry[]> {
    await this.ensureInitialized();

    return Array.from(this.entries.values())
      .sort((a, b) => b.usage.runCount - a.usage.runCount)
      .slice(0, limit);
  }

  /**
   * Get recent cases (recently added or updated)
   */
  async getRecentCases(limit: number = 10): Promise<CaseLibraryEntry[]> {
    await this.ensureInitialized();

    return Array.from(this.entries.values())
      .sort((a, b) => b.updated.getTime() - a.updated.getTime())
      .slice(0, limit);
  }

  /**
   * Export library to JSON
   */
  async exportLibrary(): Promise<any> {
    await this.ensureInitialized();

    return {
      meta: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        entriesCount: this.entries.size,
      },
      categories: CASE_CATEGORIES,
      entries: Array.from(this.entries.values()),
    };
  }

  /**
   * Import library from JSON
   */
  async importLibrary(data: any, merge: boolean = false): Promise<void> {
    if (!merge) {
      this.entries.clear();
    }

    const entries = data.entries || [];
    
    for (const entryData of entries) {
      const entry: CaseLibraryEntry = {
        ...entryData,
        created: new Date(entryData.created),
        updated: new Date(entryData.updated),
      };

      this.entries.set(entry.id, entry);
      await this.saveCaseEntry(entry);
    }

    logger.info('Imported library', {
      imported: entries.length,
      merge,
      totalEntries: this.entries.size,
    });
  }

  /**
   * Ensure library is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Ensure library directory exists
   */
  private async ensureLibraryDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.libraryPath, { recursive: true });
      await fs.mkdir(join(this.libraryPath, 'cases'), { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Load library entries from disk
   */
  private async loadLibraryEntries(): Promise<void> {
    try {
      const casesDir = join(this.libraryPath, 'cases');
      const files = await fs.readdir(casesDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = join(casesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const entryData = JSON.parse(content);
          
          const entry: CaseLibraryEntry = {
            ...entryData,
            created: new Date(entryData.created),
            updated: new Date(entryData.updated),
          };

          this.entries.set(entry.id, entry);
        } catch (error) {
          logger.warn('Failed to load case entry', { error, file });
        }
      }

      logger.debug('Loaded library entries from disk', { count: this.entries.size });
    } catch (error) {
      logger.debug('No existing library entries found', { error: error.message });
    }
  }

  /**
   * Populate built-in cases if library is empty
   */
  private async populateBuiltInCases(): Promise<void> {
    if (this.entries.size > 0) {
      return; // Library already has cases
    }

    logger.info('Populating library with built-in cases');

    // Create cases from presets
    for (const [presetName, presetConfig] of Object.entries(SYNTHETIC_PRESETS)) {
      const config: SyntheticCaseConfig = {
        name: `builtin-${presetName}`,
        description: `Built-in ${presetName} benchmark case`,
        ...presetConfig,
      } as SyntheticCaseConfig;

      // Determine category and difficulty based on preset
      let category = 'baseline';
      let difficulty: 'easy' | 'medium' | 'hard' | 'extreme' = 'medium';
      let tags = ['builtin', presetName];

      if (presetName.includes('stress')) {
        category = 'stress';
        difficulty = 'extreme';
        tags.push('high-load');
      } else if (presetName.includes('memory')) {
        category = 'memory';
        difficulty = 'hard';
        tags.push('memory-intensive');
      } else if (presetName.includes('quick') || presetName.includes('dev')) {
        category = 'performance';
        difficulty = 'easy';
        tags.push('development');
      } else if (presetName.includes('io')) {
        category = 'io';
        difficulty = 'hard';
        tags.push('io-intensive');
      }

      await this.addCase(config, {
        category,
        difficulty,
        tags,
        author: 'TW-Enigma',
      });
    }

    logger.info('Populated library with built-in cases', { count: this.entries.size });
  }

  /**
   * Save case entry to disk
   */
  private async saveCaseEntry(entry: CaseLibraryEntry): Promise<void> {
    try {
      const entryPath = join(this.libraryPath, 'cases', `${entry.id}.json`);
      await fs.writeFile(entryPath, JSON.stringify(entry, null, 2));
    } catch (error) {
      logger.error('Failed to save case entry', { error, id: entry.id });
      throw error;
    }
  }

  /**
   * Update usage statistics for a case
   */
  private async updateUsageStats(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;

    entry.usage.runCount++;
    entry.usage.lastRun = new Date();

    this.entries.set(id, entry);
    await this.saveCaseEntry(entry);
  }

  /**
   * Generate unique case ID
   */
  private generateCaseId(name: string): string {
    const baseId = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let id = baseId;
    let counter = 1;

    while (this.entries.has(id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }

    return id;
  }

  /**
   * Calculate search facets
   */
  private calculateFacets(entries: CaseLibraryEntry[]): any {
    const facets = {
      categories: {} as Record<string, number>,
      tags: {} as Record<string, number>,
      difficulties: {} as Record<string, number>,
      workloadTypes: {} as Record<string, number>,
    };

    for (const entry of entries) {
      // Categories
      facets.categories[entry.category] = (facets.categories[entry.category] || 0) + 1;

      // Tags
      for (const tag of entry.tags) {
        facets.tags[tag] = (facets.tags[tag] || 0) + 1;
      }

      // Difficulties
      facets.difficulties[entry.difficulty] = (facets.difficulties[entry.difficulty] || 0) + 1;

      // Workload types
      const workloadType = entry.config.workload.type;
      facets.workloadTypes[workloadType] = (facets.workloadTypes[workloadType] || 0) + 1;
    }

    return facets;
  }
}