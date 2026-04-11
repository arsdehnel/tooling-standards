export interface PushContext {
	filename: string;
	owner: string;
	repo: string;
	branchName: string;
}

export interface AdditionalFile {
	path: string;
	content: string;
	reason: string;
}

export interface PushResult {
	content: string;
	additionalFiles?: AdditionalFile[];
	warnings?: string[];
}

export interface FileHandler {
	/**
	 * Process file content before pushing
	 * Can format, validate, and add additional files to push
	 */
	beforePush(content: string, context: PushContext): Promise<PushResult>;
}
