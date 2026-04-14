import type { FileHandler } from "./base-handler.js";
import { BiomeHandler } from "./biome-handler.js";
import { CommitlintHandler } from "./commitlint-handler.js";
import { PrettierHandler } from "./prettier-handler.js";
import { SemanticReleaseHandler } from "./semantic-release-handler.js";

const handlers = new Map<string, FileHandler>();

// Register file handlers
handlers.set("biome.json", new BiomeHandler());
handlers.set("commitlint.config.js", new CommitlintHandler());
handlers.set("prettier.config.js", new PrettierHandler());
handlers.set("release.config.js", new SemanticReleaseHandler());

/**
 * Get handler for a specific file, if one exists
 */
export function getHandler(filename: string): FileHandler | null {
	return handlers.get(filename) || null;
}

/**
 * Check if a file has a custom handler
 */
export function hasHandler(filename: string): boolean {
	return handlers.has(filename);
}
