import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
	auth: process.env.GH_TOKEN_TOOLING_STANDARDS,
	baseUrl: 'https://api.github.com',
});

// const { data: tree } = await octokit.rest.git.getTree({
//   owner: "arsdehnel",
//   repo: "arsdehnel-dot-com",
//   tree_sha: 'main'
// });

// octokit.rest.git.getTree({
//   owner,
//   repo,
//   tree_sha,
// });

const query = `repo:arsdehnel/arsdehnel-dot-com+biome`;

const { data: items } = await octokit.rest.search.code({
	q: query,
});

console.log('items', items);

// const response = await octokit.rest.repos..list({
//   owner: "arsdehnel",
//   repo: "arsdehnel-dot-com",
// });
