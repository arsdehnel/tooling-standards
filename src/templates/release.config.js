export default {
	branches: ["main"],
	plugins: [
		[
			"@semantic-release/commit-analyzer",
			{
				preset: "conventionalcommits",
			},
		],
		[
			"@semantic-release/release-notes-generator",
			{
				preset: "conventionalcommits",
			},
		],
		"@semantic-release/changelog",
		[
			"@semantic-release/npm",
			{
				npmPublish: false,
			},
		],
		[
			"@semantic-release/git",
			{
				assets: ["package.json", "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "CHANGELOG.md"],
			},
		],
		"@semantic-release/github",
	],
};
