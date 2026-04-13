import { beforeEach, describe, expect, it, vi } from "vitest";
import { SemanticReleaseHandler } from "../semantic-release-handler.js";

// Mock dependencies
vi.mock("../../github/fetch.js");
vi.mock("../../utils/format.js");
vi.mock("../../utils/format-prettier.js");
vi.mock("../../utils/lockfile.js");
vi.mock("../../utils/npm-registry.js");

describe("SemanticReleaseHandler", () => {
	let handler: SemanticReleaseHandler;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new SemanticReleaseHandler();
	});

	it("should return formatted content when no plugins are found", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const configContent = 'export default { branches: ["main"] }';
		const formattedContent = 'export default { branches: ["main"] };\n';

		vi.mocked(formatWithBiome).mockResolvedValue(formattedContent);

		const result = await handler.beforePush(configContent, {
			filename: "release.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(formatWithBiome).toHaveBeenCalledWith(configContent, "release.config.js");
		expect(result).toEqual({ content: formattedContent });
	});

	it("should add missing dependencies at latest version", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { formatWithPrettier } = await import("../../utils/format-prettier.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default {
	branches: ['main'],
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		"@semantic-release/npm"
	]
}`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({ devDependencies: {} }),
			sha: "sha",
			path: "package.json",
			size: 100,
		});
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(fetchLatestNpmVersion).mockResolvedValue("^99.0.0");

		const result = await handler.beforePush(configContent, {
			filename: "release.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result.additionalFiles).toHaveLength(1);
		expect(result.additionalFiles![0].path).toBe("package.json");

		const updatedPkg = JSON.parse(result.additionalFiles![0].content);
		expect(updatedPkg.devDependencies["semantic-release"]).toBe("^99.0.0");
		expect(updatedPkg.devDependencies["@semantic-release/commit-analyzer"]).toBe("^99.0.0");
		expect(updatedPkg.devDependencies["@semantic-release/release-notes-generator"]).toBe("^99.0.0");
		expect(updatedPkg.devDependencies["@semantic-release/npm"]).toBe("^99.0.0");
	});

	it("should not modify dependencies that already exist", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");

		const configContent = `export default {
	plugins: ["@semantic-release/npm"]
}`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({
				devDependencies: {
					"semantic-release": "^25.0.0",
					"@semantic-release/npm": "^13.0.0",
				},
			}),
			sha: "sha",
			path: "package.json",
			size: 100,
		});

		const result = await handler.beforePush(configContent, {
			filename: "release.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result.additionalFiles).toBeUndefined();
	});

	it("should add conventionalcommits dependency when preset is used", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { formatWithPrettier } = await import("../../utils/format-prettier.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default {
	plugins: [
		["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }]
	]
}`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({ devDependencies: {} }),
			sha: "sha",
			path: "package.json",
			size: 100,
		});
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(fetchLatestNpmVersion).mockResolvedValue("^8.0.0");

		const result = await handler.beforePush(configContent, {
			filename: "release.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		const updatedPkg = JSON.parse(result.additionalFiles![0].content);
		expect(updatedPkg.devDependencies["conventional-changelog-conventionalcommits"]).toBe("^8.0.0");
	});

	it("should return warning when package.json cannot be fetched", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");

		const configContent = `export default {
	plugins: ["@semantic-release/npm"]
}`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockRejectedValue(new Error("Not found"));

		const result = await handler.beforePush(configContent, {
			filename: "release.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result).toEqual({
			content: configContent,
			warnings: ["Could not fetch package.json - semantic-release dependencies will not be updated"],
		});
	});

	it("should warn when npm registry fetch fails for a dependency", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default {
	plugins: ["@semantic-release/npm"]
}`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({ devDependencies: {} }),
			sha: "sha",
			path: "package.json",
			size: 100,
		});
		vi.mocked(fetchLatestNpmVersion).mockRejectedValue(new Error("Registry unavailable"));

		const result = await handler.beforePush(configContent, {
			filename: "release.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("Could not fetch latest version")]));
	});

	it("should create devDependencies if not present in package.json", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { formatWithPrettier } = await import("../../utils/format-prettier.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default {
	plugins: ["@semantic-release/npm"]
}`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({ name: "test-package", version: "1.0.0" }),
			sha: "sha",
			path: "package.json",
			size: 100,
		});
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(fetchLatestNpmVersion).mockResolvedValue("^25.0.0");

		const result = await handler.beforePush(configContent, {
			filename: "release.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		const updatedPkg = JSON.parse(result.additionalFiles![0].content);
		expect(updatedPkg.devDependencies).toBeDefined();
		expect(updatedPkg.devDependencies["semantic-release"]).toBe("^25.0.0");
	});

	it("should update pnpm lockfile when adding dependencies", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { formatWithPrettier } = await import("../../utils/format-prettier.js");
		const { generateLockfile, detectPackageManager } = await import("../../utils/lockfile.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default {
	plugins: ["@semantic-release/npm"]
}`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(detectPackageManager).mockReturnValue("pnpm");
		vi.mocked(generateLockfile).mockResolvedValue("lockfileVersion: 9.0\n# updated lockfile");
		vi.mocked(fetchLatestNpmVersion).mockResolvedValue("^25.0.0");

		const existingLockfileContent = "lockfileVersion: 9.0\nold content";

		vi.mocked(fetchFile).mockImplementation(async (owner, repo, path) => {
			if (path === "package.json") {
				return { content: JSON.stringify({ devDependencies: {} }), sha: "sha", path, size: 100 };
			}
			if (path === "pnpm-lock.yaml") {
				return { content: existingLockfileContent, sha: "sha", path, size: 50 };
			}
			throw new Error("File not found");
		});

		const result = await handler.beforePush(configContent, {
			filename: "release.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result.additionalFiles).toHaveLength(2);
		expect(result.additionalFiles![0].path).toBe("package.json");
		expect(result.additionalFiles![1].path).toBe("pnpm-lock.yaml");
	});

	it("should warn when no lockfile is found", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { formatWithPrettier } = await import("../../utils/format-prettier.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default {
	plugins: ["@semantic-release/npm"]
}`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(fetchLatestNpmVersion).mockResolvedValue("^25.0.0");

		vi.mocked(fetchFile).mockImplementation(async (owner, repo, path) => {
			if (path === "package.json") {
				return { content: JSON.stringify({ devDependencies: {} }), sha: "sha", path, size: 100 };
			}
			throw new Error("File not found");
		});

		const result = await handler.beforePush(configContent, {
			filename: "release.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result.additionalFiles).toHaveLength(1);
		expect(result.additionalFiles![0].path).toBe("package.json");
		expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("No lockfile found")]));
	});
});
