import path from 'node:path';
import type { LanguagePlugin } from '@volar/language-core';
import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin.js';
import { addAstroTypes } from './astro-types.js';
import type { CollectionConfig } from './frontmatter.js';
import { getFrontmatterLanguagePlugin } from './frontmatter.js';
import { getLanguagePlugin } from './language.js';

/**
 * Check whether the project rooted at `dir` is an Astro project by looking for
 * `astro` in the nearest `package.json` deps, or for an `astro.config.*` file.
 * Mirrors the language server's `getAstroInstall()` guard.
 */
function isAstroProject(tsModule: typeof import('typescript'), dir: string): boolean {
	const packageJsonPath = path.join(dir, 'package.json');
	if (tsModule.sys.fileExists(packageJsonPath)) {
		try {
			const content = tsModule.sys.readFile(packageJsonPath);
			if (content) {
				const pkg = JSON.parse(content);
				const deps = new Set([
					...Object.keys(pkg.dependencies ?? {}),
					...Object.keys(pkg.devDependencies ?? {}),
					...Object.keys(pkg.peerDependencies ?? {}),
				]);
				if (deps.has('astro')) {
					return true;
				}
			}
		} catch {}
	}

	// Fall back to checking for an astro.config.* file in the project root
	const configExtensions = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
	return configExtensions.some((ext) =>
		tsModule.sys.fileExists(path.join(dir, `astro.config${ext}`)),
	);
}

export = createLanguageServicePlugin((ts, info) => {
	let collectionConfig = undefined;
	const currentDir = info.project.getCurrentDirectory();

	// Only inject Astro ambient types into projects that actually use Astro.
	// The plugin is registered globally and runs for every tsserver project;
	// without this guard, hoisted monorepos expose `astro` (and its transitive
	// `@types/node`) to sibling projects that have nothing to do with Astro.
	if (isAstroProject(ts, currentDir)) {
		// Make "Go To References" from `.ts` files aware of usages inside `.astro` files
		// by injecting the Astro ambient types so type chains like `Astro.locals.*` resolve.
		// (`.astro` files themselves already enter the program via Volar's external files.)
		addAstroTypes(ts, info.languageServiceHost, [
			currentDir,
			...info.languageServiceHost.getScriptFileNames().map((fileName) => path.dirname(fileName)),
		]);
	}

	try {
		const fileContent = ts.sys.readFile(currentDir + '/.astro/collections/collections.json');
		if (fileContent) {
			collectionConfig = {
				folder: currentDir,
				config: JSON.parse(fileContent) as CollectionConfig['config'],
			};
		}
	} catch (err) {
		// If the file doesn't exist, we don't really care, but if it's something else, we want to know
		if (err && (err as any).code !== 'ENOENT') console.error(err);
	}

	let languagePlugins: LanguagePlugin<string>[] = [getLanguagePlugin()];

	if (collectionConfig) {
		languagePlugins.push(getFrontmatterLanguagePlugin([collectionConfig]));
	}

	return {
		languagePlugins,
	};
});
