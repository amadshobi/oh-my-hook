import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "src", "index.tsx");
const distDir = path.join(rootDir, "dist");
const distJsPath = path.join(distDir, "tui.js");

await fs.mkdir(distDir, { recursive: true });

// Copy lib directory into dist (runtime helper modules)
await fs.cp(path.join(rootDir, "src", "lib"), path.join(distDir, "lib"), { recursive: true });

async function resolveCompiler() {
  // 1. Try standard module imports
  try {
    const babel = (await import("@babel/core")).default;
    const solidPreset = (await import("babel-preset-solid")).default;
    const typescriptPreset = (await import("@babel/preset-typescript")).default;
    return { babel, solidPreset, typescriptPreset };
  } catch {}

  // 2. Try global or common fallback locations
  const searchDirs = [];
  if (process.env.HOME) {
    searchDirs.push(
      path.join(process.env.HOME, ".npm-global/lib/node_modules/@slkiser/opencode-quota/node_modules"),
      path.join(process.env.HOME, ".npm-global/lib/node_modules"),
      path.join(process.env.HOME, ".config/opencode/node_modules")
    );
  }

  for (const base of searchDirs) {
    try {
      const bPath = pathToFileURL(path.join(base, "@babel/core/lib/index.js")).href;
      const sPath = pathToFileURL(path.join(base, "babel-preset-solid/index.js")).href;
      const tPath = pathToFileURL(path.join(base, "@babel/preset-typescript/lib/index.js")).href;
      const babel = (await import(bPath)).default;
      const solidPreset = (await import(sPath)).default;
      const typescriptPreset = (await import(tPath)).default;
      return { babel, solidPreset, typescriptPreset };
    } catch {}
  }

  return null;
}

const compiler = await resolveCompiler();

if (!compiler) {
  const exists = await fs.access(distJsPath).then(() => true).catch(() => false);
  if (exists) {
    console.log("[build:tui] Babel compiler not available in environment; using pre-built tui/dist/tui.js");
    process.exit(0);
  }
  throw new Error("Babel compiler (@babel/core, babel-preset-solid, @babel/preset-typescript) not found and no pre-built tui/dist/tui.js exists.");
}

const { babel, solidPreset, typescriptPreset } = compiler;
const source = await fs.readFile(sourcePath, "utf8");
const transformed = await babel.transformAsync(source, {
  filename: sourcePath,
  configFile: false,
  babelrc: false,
  presets: [
    [solidPreset, { moduleName: "@opentui/solid", generate: "universal" }],
    [typescriptPreset],
  ],
});

await fs.writeFile(distJsPath, `${transformed.code}\n`);
console.log("Built tui/dist/tui.js and copied dist/lib successfully!");
