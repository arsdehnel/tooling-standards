import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TEMPLATES_DIR = path.join(__dirname, '../templates');

export async function saveTemplate(filename: string, content: string): Promise<string> {
	const filepath = path.join(TEMPLATES_DIR, filename);
	await fs.mkdir(path.dirname(filepath), { recursive: true });
	await fs.writeFile(filepath, content, 'utf-8');
	return filepath;
}

export async function readTemplate(filename: string): Promise<string | null> {
	const filepath = path.join(TEMPLATES_DIR, filename);
	try {
		const content = await fs.readFile(filepath, 'utf-8');
		return content;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}
		throw error;
	}
}

export async function templateExists(filename: string): Promise<boolean> {
	const content = await readTemplate(filename);
	return content !== null;
}
