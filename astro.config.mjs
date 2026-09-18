import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import astrobook from 'astrobook';

import tailwindcss from '@tailwindcss/vite';
import rehypePostAssetPaths from './src/utils/rehypePostAssetPaths.mjs';

import { fileURLToPath } from 'node:url';

// https://astro.build/config
// https://www.freecodecamp.org/news/how-to-add-google-analytics-to-your-astro-website/
export default defineConfig({
	site: 'https://ifcommunity-tech.netlify.app/',
	output: 'static',
	markdown: {
		rehypePlugins: [rehypePostAssetPaths]
	},
	vite: { 
		plugins: [tailwindcss()],
		server: {
			// Multiple dev servers corrupt Astro's shared content cache during MDX updates.
			strictPort: true
		},
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url)),
			},  
		},
	},
	integrations: [
		mdx(),
		sitemap(),
		process.env.NODE_ENV === 'development'
			? astrobook({
					subpath: '/components',
					directory: 'src/stories',
					head: './src/components/astrobook/preview/CodePreview.astro',

					css: [
						'public/styles/guide/astrobook.css',
						'public/styles/guide/reset.css',
						'public/lib/highlight/highlight.min.css',
						'src/styles/myPostList.css',
						'src/styles/variable.css',
						'src/styles/pagination.css',
						'src/styles/global.css',
						'src/styles/hover.css'
					]
				})
			: null
	].filter(Boolean)
});
