import { Octokit } from '@octokit/rest';

export async function fetchFile(owner, repo, path, ref = 'main') {
	const octokit = new Octokit({
		auth: process.env.GH_TOKEN_TOOLING_STANDARDS,
		baseUrl: 'https://api.github.com',
	});

	// First verify the repository exists
	try {
		await octokit.rest.repos.get({ owner, repo });
	} catch (error) {
		if (error.status === 404) {
			throw new Error(`Repository not found: ${owner}/${repo}`);
		}
		throw error;
	}

	try {
		const { data } = await octokit.rest.repos.getContent({
			owner,
			repo,
			path,
			ref,
		});

		if (data.type !== 'file') {
			throw new Error(`${path} is not a file`);
		}

		// Decode base64 content
		const content = Buffer.from(data.content, 'base64').toString('utf-8');

		return {
			content,
			sha: data.sha,
			path: data.path,
			size: data.size,
		};
	} catch (error) {
		if (error.status === 404) {
			throw new Error(`File not found: ${path} in ${owner}/${repo}`);
		}
		throw error;
	}
}
