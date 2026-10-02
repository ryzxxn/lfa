import * as esbuild from "esbuild";
import * as path from "path";
import * as fs from "fs";

export interface BundleOptions {
  entryPoint: string;
  outfile: string;
  external?: string[];
}

export async function bundleFunction(options: BundleOptions): Promise<void> {
  const { entryPoint, outfile, external = [] } = options;

  const entryDir = path.dirname(entryPoint);

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    target: "es2020",
    platform: "node",
    outfile,
    external,
    sourcemap: false,
    logLevel: "info",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });

  const stats = fs.statSync(outfile);
  console.log(
    `✓ Bundled ${entryPoint} → ${outfile} (${Math.round(stats.size / 1024)}KB)`
  );

  return undefined;
}
