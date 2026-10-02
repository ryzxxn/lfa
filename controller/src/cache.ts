import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";

export interface CacheEntry {
  hash: string;
  bundlePath: string;
  sourceFile: string;
  timestamp: number;
  size: number;
}

export class BundleCache {
  private cacheDir: string;
  private indexPath: string;
  private index: Map<string, CacheEntry> = new Map();

  constructor(cacheDir?: string) {
    this.cacheDir =
      cacheDir || path.join(os.homedir(), ".firecracker-lambda-cache");
    this.indexPath = path.join(this.cacheDir, "index.json");

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    this.loadIndex();
  }

  private loadIndex(): void {
    if (fs.existsSync(this.indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.indexPath, "utf-8"));
        this.index = new Map(Object.entries(data));
      } catch (error) {
        console.warn("Failed to load cache index, starting fresh");
      }
    }
  }

  private saveIndex(): void {
    const data = Object.fromEntries(this.index);
    fs.writeFileSync(this.indexPath, JSON.stringify(data, null, 2));
  }

  private hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath, "utf-8");
    return crypto
      .createHash("sha256")
      .update(content)
      .digest("hex")
      .slice(0, 16);
  }

  get(sourceFile: string): CacheEntry | null {
    const key = path.resolve(sourceFile);

    const cached = this.index.get(key);
    if (!cached) return null;

    // Verify source hasn't changed
    const currentHash = this.hashFile(sourceFile);
    if (currentHash !== cached.hash) {
      this.invalidate(sourceFile);
      return null;
    }

    // Verify bundle still exists
    if (!fs.existsSync(cached.bundlePath)) {
      this.invalidate(sourceFile);
      return null;
    }

    return cached;
  }

  set(sourceFile: string, bundlePath: string): CacheEntry {
    const key = path.resolve(sourceFile);
    const hash = this.hashFile(sourceFile);
    const size = fs.statSync(bundlePath).size;

    const entry: CacheEntry = {
      hash,
      bundlePath,
      sourceFile: key,
      timestamp: Date.now(),
      size,
    };

    this.index.set(key, entry);
    this.saveIndex();

    return entry;
  }

  invalidate(sourceFile: string): void {
    const key = path.resolve(sourceFile);
    this.index.delete(key);
    this.saveIndex();
  }

  clear(): void {
    this.index.clear();
    if (fs.existsSync(this.cacheDir)) {
      fs.rmSync(this.cacheDir, { recursive: true });
    }
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  getCacheStats(): {
    entries: number;
    totalSize: number;
    cacheDir: string;
  } {
    let totalSize = 0;
    this.index.forEach((entry) => {
      totalSize += entry.size;
    });

    return {
      entries: this.index.size,
      totalSize,
      cacheDir: this.cacheDir,
    };
  }

  listCached(): CacheEntry[] {
    return Array.from(this.index.values());
  }
}
