import { Octokit } from "@octokit/rest";

interface GitHubErrorDetail {
	message?: string;
	resource?: string;
	code?: string;
	field?: string;
}

/**
 * Extract a human-readable message from an Octokit error, including any
 * validation details from the response body's `errors` array.
 */
function githubErrorMessage(error: unknown): string {
	const e = error as {
		message?: string;
		response?: { data?: { message?: string; errors?: GitHubErrorDetail[] } };
	};
	const base = e.response?.data?.message || e.message || "Unknown GitHub error";
	const details = e.response?.data?.errors
		?.map(err => err.message || [err.resource, err.field, err.code].filter(Boolean).join("/"))
		.filter(Boolean);
	return details?.length ? `${base}: ${details.join("; ")}` : base;
}

export interface CreateBranchResult {
	branchName: string;
	sha: string;
}

export interface UpdateFileResult {
	commit: {
		sha: string;
		message: string;
	};
}

export interface CreatePRResult {
	number: number;
	url: string;
	title: string;
}

export interface ExistingPR {
	number: number;
	url: string;
	state: "open" | "closed";
	merged: boolean;
}

/**
 * Creates a new branch from the default branch
 */
export async function createBranch(owner: string, repo: string, branchName: string): Promise<CreateBranchResult> {
	const octokit = new Octokit({
		auth: process.env.GH_TOKEN_TOOLING_STANDARDS,
		baseUrl: "https://api.github.com",
	});

	// Get the default branch
	const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
	const defaultBranch = repoData.default_branch;

	// Get the SHA of the default branch
	const { data: refData } = await octokit.rest.git.getRef({
		owner,
		repo,
		ref: `heads/${defaultBranch}`,
	});

	const sha = refData.object.sha;

	// Create the new branch
	try {
		await octokit.rest.git.createRef({
			owner,
			repo,
			ref: `refs/heads/${branchName}`,
			sha,
		});
	} catch (error) {
		const e = error as { status?: number; response?: { data?: { message?: string } } };
		if (e.status === 422) {
			if (e.response?.data?.message === "Reference already exists") {
				throw new Error(`Branch ${branchName} already exists`);
			}
			throw new Error(githubErrorMessage(error));
		}
		throw error;
	}

	return { branchName, sha };
}

/**
 * Updates or creates a file on a branch
 */
export async function updateFile(
	owner: string,
	repo: string,
	path: string,
	content: string,
	branch: string,
	message: string,
): Promise<UpdateFileResult> {
	const octokit = new Octokit({
		auth: process.env.GH_TOKEN_TOOLING_STANDARDS,
		baseUrl: "https://api.github.com",
	});

	// Check if file exists to get its SHA (needed for updates)
	let fileSha: string | undefined;
	try {
		const { data } = await octokit.rest.repos.getContent({
			owner,
			repo,
			path,
			ref: branch,
		});

		if ("sha" in data && data.type === "file") {
			fileSha = data.sha;
		}
	} catch (error) {
		// File doesn't exist, that's fine - we'll create it
		if ((error as { status?: number }).status !== 404) {
			throw error;
		}
	}

	// Create or update the file
	const { data } = await octokit.rest.repos.createOrUpdateFileContents({
		owner,
		repo,
		path,
		message,
		content: Buffer.from(content).toString("base64"),
		branch,
		...(fileSha && { sha: fileSha }),
	});

	return {
		commit: {
			sha: data.commit.sha || "",
			message: data.commit.message || "",
		},
	};
}

/**
 * Check if a PR exists for a branch
 */
export async function findPRForBranch(owner: string, repo: string, branchName: string): Promise<ExistingPR | null> {
	const octokit = new Octokit({
		auth: process.env.GH_TOKEN_TOOLING_STANDARDS,
		baseUrl: "https://api.github.com",
	});

	// Search for PRs with this head branch (both open and closed)
	const { data } = await octokit.rest.pulls.list({
		owner,
		repo,
		head: `${owner}:${branchName}`,
		state: "all",
		per_page: 1,
		sort: "created",
		direction: "desc",
	});

	if (data.length === 0) {
		return null;
	}

	const pr = data[0];
	return {
		number: pr.number,
		url: pr.html_url,
		state: pr.state as "open" | "closed",
		merged: pr.merged_at !== null,
	};
}

/**
 * Delete a branch
 */
export async function deleteBranch(owner: string, repo: string, branchName: string): Promise<void> {
	const octokit = new Octokit({
		auth: process.env.GH_TOKEN_TOOLING_STANDARDS,
		baseUrl: "https://api.github.com",
	});

	try {
		await octokit.rest.git.deleteRef({
			owner,
			repo,
			ref: `heads/${branchName}`,
		});
	} catch (error) {
		throw new Error(githubErrorMessage(error));
	}
}

/**
 * Creates a pull request
 */
export async function createPullRequest(
	owner: string,
	repo: string,
	head: string,
	title: string,
	body: string,
): Promise<CreatePRResult> {
	const octokit = new Octokit({
		auth: process.env.GH_TOKEN_TOOLING_STANDARDS,
		baseUrl: "https://api.github.com",
	});

	// Get the default branch
	const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
	const defaultBranch = repoData.default_branch;

	const { data } = await octokit.rest.pulls.create({
		owner,
		repo,
		title,
		head,
		base: defaultBranch,
		body,
	});

	return {
		number: data.number,
		url: data.html_url,
		title: data.title,
	};
}
