import { getVirtualModulePageNameFromPath, getPathFromVirtualModulePageName } from './util.js';
import type { Plugin as VitePlugin } from 'vite';
import { addRollupInput } from '../add-rollup-input.js';
import { type BuildInternals } from '../internal.js';
import type { AstroBuildPlugin } from '../plugin';
import type { StaticBuildOptions } from '../types';
import { MIDDLEWARE_MODULE_ID } from './plugin-middleware.js';
import { RENDERERS_MODULE_ID } from './plugin-renderers.js';

export const ASTRO_PAGE_MODULE_ID = '@astro-page:';
export const ASTRO_PAGE_RESOLVED_MODULE_ID = '\0' + ASTRO_PAGE_MODULE_ID;

function vitePluginPages(opts: StaticBuildOptions, internals: BuildInternals): VitePlugin {
	return {
		name: '@astro/plugin-build-pages',

		options(options) {
			if (opts.settings.config.output === 'static') {
				const inputs: Set<string> = new Set();

				for (const path of Object.keys(opts.allPages)) {
					inputs.add(getVirtualModulePageNameFromPath(ASTRO_PAGE_MODULE_ID, path));
				}

				return addRollupInput(options, Array.from(inputs));
			}
		},

		resolveId(id) {
			if (id.startsWith(ASTRO_PAGE_MODULE_ID)) {
				return '\0' + id;
			}
		},

		async load(id) {
			if (id.startsWith(ASTRO_PAGE_RESOLVED_MODULE_ID)) {
				const imports: string[] = [];
				const exports: string[] = [];
				const pageName = getPathFromVirtualModulePageName(ASTRO_PAGE_RESOLVED_MODULE_ID, id);
				const pageData = internals.pagesByComponent.get(pageName);
				if (pageData) {
					const resolvedPage = await this.resolve(pageData.moduleSpecifier);
					if (resolvedPage) {
						imports.push(`const page = () => import(${JSON.stringify(pageData.moduleSpecifier)});`);
						exports.push(`export { page }`);

						imports.push(`import { renderers } from "${RENDERERS_MODULE_ID}";`);
						exports.push(`export { renderers };`);

						if (opts.settings.config.experimental.middleware) {
							imports.push(`import * as _middleware from "${MIDDLEWARE_MODULE_ID}";`);
							exports.push(`export const middleware = _middleware;`);
						}

						return `${imports.join('\n')}${exports.join('\n')}`;
					}
				}
			}
		},
	};
}

export function pluginPages(opts: StaticBuildOptions, internals: BuildInternals): AstroBuildPlugin {
	return {
		build: 'ssr',
		hooks: {
			'build:before': () => {
				return {
					vitePlugin: vitePluginPages(opts, internals),
				};
			},
		},
	};
}
