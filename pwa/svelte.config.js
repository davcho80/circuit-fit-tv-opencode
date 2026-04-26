import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      fallback: '200.html', // SPA mode — toutes les routes non-trouvées renvoient 200.html
    }),
    alias: {
      $api: 'src/lib/api',
    },
  },
};

export default config;
