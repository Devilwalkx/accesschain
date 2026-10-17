import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runDemo } from "../src/demo.js";

const { markdown } = runDemo();
const target = fileURLToPath(new URL("../../../docs/DEMO.md", import.meta.url));
writeFileSync(target, markdown + "\n");
console.log(`Wrote ${target}`);
