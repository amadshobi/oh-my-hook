import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "src", "index.tsx");
const distDir = path.join(rootDir, "dist");
const distJsPath = path.join(distDir, "tui.js");

await fs.mkdir(distDir, { recursive: true });

// Copy lib directory into dist
await fs.cp(path.join(rootDir, "src", "lib"), path.join(distDir, "lib"), { recursive: true });

const babelPath = pathToFileURL("/home/shobixlinuxdev/.npm-global/lib/node_modules/@slkiser/opencode-quota/node_modules/@babel/core/lib/index.js").href;
const solidPresetPath = pathToFileURL("/home/shobixlinuxdev/.npm-global/lib/node_modules/@slkiser/opencode-quota/node_modules/babel-preset-solid/index.js").href;
const tsPresetPath = pathToFileURL("/home/shobixlinuxdev/.npm-global/lib/node_modules/@slkiser/opencode-quota/node_modules/@babel/preset-typescript/lib/index.js").href;

const babel = (await import(babelPath)).default;
const solidPreset = (await import(solidPresetPath)).default;
const typescriptPreset = (await import(tsPresetPath)).default;

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
