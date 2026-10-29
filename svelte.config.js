import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-node builds a standalone server (`node build`), used by the Docker image.
		adapter: adapter(),
		// Content-Security-Policy header on every page. SvelteKit adds a nonce to its own inline
		// hydration script, so no other inline script can run.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Pages use inline style="" attributes.
				'style-src': ['self', 'unsafe-inline'],
				// Vite inlines small assets (the icons) as data: URIs.
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none'],
				'base-uri': ['self'],
				'object-src': ['none']
			}
		}
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
