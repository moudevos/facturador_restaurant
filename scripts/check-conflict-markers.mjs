import { execFileSync } from "node:child_process";

let output = "";
try {
  output = execFileSync(
    "git",
    ["grep", "-nE", "^(<<<<<<< |=======|>>>>>>> )", "--", "."],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (error) {
  if (error && typeof error === "object" && "status" in error && error.status === 1) {
    process.exit(0);
  }
  throw error;
}

if (output.trim()) {
  console.error("Se encontraron marcadores de conflicto sin resolver:");
  console.error(output.trim());
  process.exit(1);
}
