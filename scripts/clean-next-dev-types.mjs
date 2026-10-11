import { rmSync } from "node:fs";
import { join } from "node:path";

// Next.js 16 can leave stale development route types that make a later
// production typecheck fail, even when the application compiles correctly.
// Remove only generated dev types; do not touch source code or production types.
const generatedDevTypes = join(process.cwd(), ".next", "dev", "types");

try {
  rmSync(generatedDevTypes, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
} catch (error) {
  console.error(
    "No se pudieron limpiar los tipos de desarrollo de Next.js. Detén 'next dev' y vuelve a intentarlo.",
  );
  throw error;
}
