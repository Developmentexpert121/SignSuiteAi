import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve relative to the bundle location (__dirname), NOT process.cwd().
// In production the api-server is started from the monorepo root
// (`node ./artifacts/api-server/dist/index.mjs`), so cwd is the repo root and
// `cwd()/public/uploads` would point at a non-existent dir → every upload 404s.
// __dirname is the dist/ dir, so ../public/uploads is stable in dev and prod.
export const UPLOADS_DIR = path.resolve(__dirname, "../public/uploads");
