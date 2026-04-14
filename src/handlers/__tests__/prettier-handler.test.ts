import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrettierHandler } from "../prettier-handler.js";

vi.mock("../../github/fetch.js");
vi.mock("../../utils/format.js");
vi.mock("../../utils/format-prettier.js");
vi.mock("../../utils/lockfile.js");
vi.mock("../../utils/npm-registry.js");

describe("PrettierHandler", () => {
	let handler: PrettierHandler;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new PrettierHandler();
	});

	it("should return formatted content when all deps already exist", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");

		const configContent = `export default { plugins: ["prettier-plugin-packagejson"] };\n`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({
				devDependencies: {
					prettier: "^3.0.0",
					"prettier-plugin-packagejson": "^2.0.0",
				},
			}),
			sha: "sha",
			path: "package.json",
			size: 100,
		});

		const result = await handler.beforePush(configContent, {
			filename: "prettier.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result).toEqual({ content: configContent });
		expect(result.additionalFiles).toBeUndefined();
	});

	it("should add prettier and prettier-plugin-packagejson when missing", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { formatWithPrettier } = await import("../../utils/format-prettier.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default { plugins: ["prettier-plugin-packagejson"] };\n`;

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
			filename: "prettier.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result.additionalFiles).toHaveLength(1);
		expect(result.additionalFiles![0].path).toBe("package.json");

		const updatedPkg = JSON.parse(result.additionalFiles![0].content);
		expect(updatedPkg.devDependencies["prettier"]).toBe("^99.0.0");
		expect(updatedPkg.devDependencies["prettier-plugin-packagejson"]).toBe("^99.0.0");
	});

	it("should only add the dep that is missing", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { formatWithPrettier } = await import("../../utils/format-prettier.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default { plugins: ["prettier-plugin-packagejson"] };\n`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({ devDependencies: { prettier: "^3.0.0" } }),
			sha: "sha",
			path: "package.json",
			size: 100,
		});
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(fetchLatestNpmVersion).mockResolvedValue("^3.0.0");

		const result = await handler.beforePush(configContent, {
			filename: "prettier.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		const updatedPkg = JSON.parse(result.additionalFiles![0].content);
		expect(updatedPkg.devDependencies["prettier"]).toBe("^3.0.0"); // existing, untouched
		expect(updatedPkg.devDependencies["prettier-plugin-packagejson"]).toBe("^3.0.0"); // added
		expect(fetchLatestNpmVersion).toHaveBeenCalledTimes(1);
		expect(fetchLatestNpmVersion).toHaveBeenCalledWith("prettier-plugin-packagejson");
	});

	it("should not add dep if already in dependencies (not devDependencies)", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { formatWithPrettier } = await import("../../utils/format-prettier.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default { plugins: ["prettier-plugin-packagejson"] };\n`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({
				dependencies: { prettier: "^3.0.0" },
				devDependencies: {},
			}),
			sha: "sha",
			path: "package.json",
			size: 100,
		});
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(fetchLatestNpmVersion).mockResolvedValue("^3.0.0");

		const result = await handler.beforePush(configContent, {
			filename: "prettier.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		const updatedPkg = JSON.parse(result.additionalFiles![0].content);
		expect(updatedPkg.devDependencies["prettier"]).toBeUndefined();
		expect(updatedPkg.devDependencies["prettier-plugin-packagejson"]).toBe("^3.0.0");
	});

	it("should return warning when package.json cannot be fetched", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");

		const configContent = `export default { plugins: ["prettier-plugin-packagejson"] };\n`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockRejectedValue(new Error("Not found"));

		const result = await handler.beforePush(configContent, {
			filename: "prettier.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result).toEqual({
			content: configContent,
			warnings: ["Could not fetch package.json - prettier dependencies will not be updated"],
		});
	});

	it("should warn when npm registry fetch fails", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default { plugins: ["prettier-plugin-packagejson"] };\n`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({ devDependencies: {} }),
			sha: "sha",
			path: "package.json",
			size: 100,
		});
		vi.mocked(fetchLatestNpmVersion).mockRejectedValue(new Error("Registry unavailable"));

		const result = await handler.beforePush(configContent, {
			filename: "prettier.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("Could not fetch latest version")]));
	});

	it("should update pnpm lockfile when adding dependencies", async () => {
		const { formatWithBiome } = await import("../../utils/format.js");
		const { fetchFile } = await import("../../github/fetch.js");
		const { formatWithPrettier } = await import("../../utils/format-prettier.js");
		const { generateLockfile, detectPackageManager } = await import("../../utils/lockfile.js");
		const { fetchLatestNpmVersion } = await import("../../utils/npm-registry.js");

		const configContent = `export default { plugins: ["prettier-plugin-packagejson"] };\n`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(detectPackageManager).mockReturnValue("pnpm");
		vi.mocked(generateLockfile).mockResolvedValue("lockfileVersion: 9.0\n# updated lockfile");
		vi.mocked(fetchLatestNpmVersion).mockResolvedValue("^3.0.0");

		vi.mocked(fetchFile).mockImplementation(async (owner, repo, path) => {
			if (path === "package.json") {
				return { content: JSON.stringify({ devDependencies: {} }), sha: "sha", path, size: 100 };
			}
			if (path === "pnpm-lock.yaml") {
				return { content: "lockfileVersion: 9.0\nold content", sha: "sha", path, size: 50 };
			}
			throw new Error("File not found");
		});

		const result = await handler.beforePush(configContent, {
			filename: "prettier.config.js",
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

		const configContent = `export default { plugins: ["prettier-plugin-packagejson"] };\n`;

		vi.mocked(formatWithBiome).mockResolvedValue(configContent);
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(fetchLatestNpmVersion).mockResolvedValue("^3.0.0");

		vi.mocked(fetchFile).mockImplementation(async (owner, repo, path) => {
			if (path === "package.json") {
				return { content: JSON.stringify({ devDependencies: {} }), sha: "sha", path, size: 100 };
			}
			throw new Error("File not found");
		});

		const result = await handler.beforePush(configContent, {
			filename: "prettier.config.js",
			owner: "owner",
			repo: "repo",
			branchName: "branch",
		});

		expect(result.additionalFiles).toHaveLength(1);
		expect(result.additionalFiles![0].path).toBe("package.json");
		expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("No lockfile found")]));
	});
});
