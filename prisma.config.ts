import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

// Prisma skips automatic .env loading when this config file exists,
// so load it here. Variables already set in the environment win.
try {
    loadEnvFile(".env");
} catch {
    // No .env file (e.g. inside Docker, where DATABASE_URL comes from the environment).
}

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        seed: "tsx prisma/seed.ts"
    }
});