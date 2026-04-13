import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBranch, createPullRequest, deleteBranch, findPRForBranch, updateFile } from "../push.js";

// Mock Octokit
vi.mock("@octokit/rest", () => {
	return {
		Octokit: vi.fn(),
	};
});

describe("GitHub Push Functions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.GH_TOKEN_TOOLING_STANDARDS = "test-token";
	});

	describe("findPRForBranch", () => {
		it("should return null when no PR exists", async () => {
			const { Octokit } = await import("@octokit/rest");
			const mockPullsList = vi.fn().mockResolvedValue({ data: [] });

			vi.mocked(Octokit).mockImplementation(
				class {
					rest = {
						pulls: {
							list: mockPullsList,
						},
					};
				} as any,
			);

			const result = await findPRForBranch("owner", "repo", "test-branch");

			expect(result).toBeNull();
			expect(mockPullsList).toHaveBeenCalledWith({
				owner: "owner",
				repo: "repo",
				head: "owner:test-branch",
				state: "all",
				per_page: 1,
				sort: "created",
				direction: "desc",
			});
		});

		it("should return open PR when one exists", async () => {
			const { Octokit } = await import("@octokit/rest");
			vi.mocked(Octokit).mockImplementation(
				class {
					rest = {
						pulls: {
							list: vi.fn().mockResolvedValue({
								data: [
									{
										number: 123,
										html_url: "https://github.com/owner/repo/pull/123",
										state: "open",
										merged_at: null,
									},
								],
							}),
						},
					};
				} as any,
			);

			const result = await findPRForBranch("owner", "repo", "test-branch");

			expect(result).toEqual({
				number: 123,
				url: "https://github.com/owner/repo/pull/123",
				state: "open",
				merged: false,
			});
		});

		it("should return merged PR when one exists", async () => {
			const { Octokit } = await import("@octokit/rest");
			vi.mocked(Octokit).mockImplementation(
				class {
					rest = {
						pulls: {
							list: vi.fn().mockResolvedValue({
								data: [
									{
										number: 456,
										html_url: "https://github.com/owner/repo/pull/456",
										state: "closed",
										merged_at: "2024-01-01T00:00:00Z",
									},
								],
							}),
						},
					};
				} as any,
			);

			const result = await findPRForBranch("owner", "repo", "test-branch");

			expect(result).toEqual({
				number: 456,
				url: "https://github.com/owner/repo/pull/456",
				state: "closed",
				merged: true,
			});
		});

		it("should return closed but not merged PR", async () => {
			const { Octokit } = await import("@octokit/rest");
			vi.mocked(Octokit).mockImplementation(
				class {
					rest = {
						pulls: {
							list: vi.fn().mockResolvedValue({
								data: [
									{
										number: 789,
										html_url: "https://github.com/owner/repo/pull/789",
										state: "closed",
										merged_at: null,
									},
								],
							}),
						},
					};
				} as any,
			);

			const result = await findPRForBranch("owner", "repo", "test-branch");

			expect(result).toEqual({
				number: 789,
				url: "https://github.com/owner/repo/pull/789",
				state: "closed",
				merged: false,
			});
		});
	});

	describe("createBranch", () => {
		it("should create a new branch from default branch", async () => {
			const { Octokit } = await import("@octokit/rest");
			const mockCreateRef = vi.fn().mockResolvedValue({});

			vi.mocked(Octokit).mockImplementation(
				class {
					rest = {
						repos: {
							get: vi.fn().mockResolvedValue({
								data: { default_branch: "main" },
							}),
						},
						git: {
							getRef: vi.fn().mockResolvedValue({
								data: { object: { sha: "abc123" } },
							}),
							createRef: mockCreateRef,
						},
					};
				} as any,
			);

			const result = await createBranch("owner", "repo", "new-branch");

			expect(result).toEqual({
				branchName: "new-branch",
				sha: "abc123",
			});
			expect(mockCreateRef).toHaveBeenCalledWith({
				owner: "owner",
				repo: "repo",
				ref: "refs/heads/new-branch",
				sha: "abc123",
			});
		});

		it("should throw error when branch already exists", async () => {
			const { Octokit } = await import("@octokit/rest");
			vi.mocked(Octokit).mockImplementation(
				class {
					rest = {
						repos: {
							get: vi.fn().mockResolvedValue({
								data: { default_branch: "main" },
							}),
						},
						git: {
							getRef: vi.fn().mockResolvedValue({
								data: { object: { sha: "abc123" } },
							}),
							createRef: vi.fn().mockRejectedValue({
								status: 422,
								response: { data: { message: "Reference already exists" } },
							}),
						},
					};
				} as any,
			);

			await expect(createBranch("owner", "repo", "existing-branch")).rejects.toThrow(
				"Branch existing-branch already exists",
			);
		});
	});

	describe("deleteBranch", () => {
		it("should delete a branch", async () => {
			const { Octokit } = await import("@octokit/rest");
			const mockDeleteRef = vi.fn().mockResolvedValue({});

			vi.mocked(Octokit).mockImplementation(
				class {
					rest = {
						git: {
							deleteRef: mockDeleteRef,
						},
					};
				} as any,
			);

			await deleteBranch("owner", "repo", "branch-to-delete");

			expect(mockDeleteRef).toHaveBeenCalledWith({
				owner: "owner",
				repo: "repo",
				ref: "heads/branch-to-delete",
			});
		});
	});

	describe("updateFile", () => {
		it("should create a new file when it does not exist", async () => {
			const { Octokit } = await import("@octokit/rest");
			const mockCreateOrUpdateFileContents = vi.fn().mockResolvedValue({
				data: {
					commit: {
						sha: "commit-sha",
						message: "test commit",
					},
				},
			});

			vi.mocked(Octokit).mockImplementation(
				class {
					rest = {
						repos: {
							getContent: vi.fn().mockRejectedValue({ status: 404 }),
							createOrUpdateFileContents: mockCreateOrUpdateFileContents,
						},
					};
				} as any,
			);

			const result = await updateFile("owner", "repo", "new-file.txt", "content", "branch", "commit message");

			expect(result).toEqual({
				commit: {
					sha: "commit-sha",
					message: "test commit",
				},
			});
			expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith({
				owner: "owner",
				repo: "repo",
				path: "new-file.txt",
				message: "commit message",
				content: Buffer.from("content").toString("base64"),
				branch: "branch",
			});
		});

		it("should update an existing file", async () => {
			const { Octokit } = await import("@octokit/rest");
			const mockCreateOrUpdateFileContents = vi.fn().mockResolvedValue({
				data: {
					commit: {
						sha: "commit-sha",
						message: "update commit",
					},
				},
			});

			vi.mocked(Octokit).mockImplementation(
				class {
					rest = {
						repos: {
							getContent: vi.fn().mockResolvedValue({
								data: {
									type: "file",
									sha: "file-sha",
								},
							}),
							createOrUpdateFileContents: mockCreateOrUpdateFileContents,
						},
					};
				} as any,
			);

			const result = await updateFile("owner", "repo", "existing-file.txt", "new content", "branch", "update");

			expect(result).toEqual({
				commit: {
					sha: "commit-sha",
					message: "update commit",
				},
			});
			expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith({
				owner: "owner",
				repo: "repo",
				path: "existing-file.txt",
				message: "update",
				content: Buffer.from("new content").toString("base64"),
				branch: "branch",
				sha: "file-sha",
			});
		});
	});

	describe("createPullRequest", () => {
		it("should create a new pull request", async () => {
			const { Octokit } = await import("@octokit/rest");
			const mockPullsCreate = vi.fn().mockResolvedValue({
				data: {
					number: 42,
					html_url: "https://github.com/owner/repo/pull/42",
					title: "Test PR",
				},
			});

			vi.mocked(Octokit).mockImplementation(
				class {
					rest = {
						repos: {
							get: vi.fn().mockResolvedValue({
								data: { default_branch: "main" },
							}),
						},
						pulls: {
							create: mockPullsCreate,
						},
					};
				} as any,
			);

			const result = await createPullRequest("owner", "repo", "feature-branch", "Test PR", "PR body");

			expect(result).toEqual({
				number: 42,
				url: "https://github.com/owner/repo/pull/42",
				title: "Test PR",
			});
			expect(mockPullsCreate).toHaveBeenCalledWith({
				owner: "owner",
				repo: "repo",
				title: "Test PR",
				head: "feature-branch",
				base: "main",
				body: "PR body",
			});
		});
	});
});
