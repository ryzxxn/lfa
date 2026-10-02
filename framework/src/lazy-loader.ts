/**
 * Lazy Module Loader
 *
 * Allows functions to reference external libraries without bundling them.
 * Useful for:
 * - Large ML libraries (torch, transformers)
 * - System libraries (numpy, pandas)
 * - Dynamically loaded modules
 *
 * Usage:
 * ```
 * import { lazyLoad } from "@firecracker-lambda/framework";
 *
 * export default defineHandler(async (payload) => {
 *   const torch = await lazyLoad("torch");
 *   // Use torch...
 * });
 * ```
 */

export interface ModuleMetadata {
  name: string;
  version?: string;
  location: "bundled" | "shared" | "external";
  preload?: boolean;
  cacheable?: boolean;
}

const moduleCache = new Map<string, any>();

export async function lazyLoad(moduleName: string): Promise<any> {
  // Check cache first
  if (moduleCache.has(moduleName)) {
    return moduleCache.get(moduleName);
  }

  try {
    // Try to require the module
    const module = require(moduleName);
    moduleCache.set(moduleName, module);
    return module;
  } catch (error) {
    throw new Error(`Failed to lazy-load module '${moduleName}': ${error}`);
  }
}

export async function lazyLoadMultiple(
  moduleNames: string[]
): Promise<Record<string, any>> {
  const modules: Record<string, any> = {};

  for (const name of moduleNames) {
    modules[name] = await lazyLoad(name);
  }

  return modules;
}

export function clearModuleCache(): void {
  moduleCache.clear();
}

export function getCachedModules(): string[] {
  return Array.from(moduleCache.keys());
}

/**
 * Declare module dependencies for the function.
 * This helps with pre-loading and optimization.
 */
export function declareExternalModules(modules: ModuleMetadata[]): void {
  modules.forEach((mod) => {
    if (mod.preload) {
      lazyLoad(mod.name).catch((error) => {
        console.warn(`Failed to preload ${mod.name}:`, error);
      });
    }
  });
}
