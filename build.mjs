import { build } from "esbuild";

await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["obsidian"],
  outfile: "main.js",
});
