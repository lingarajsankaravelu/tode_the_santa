import { defineConfig } from 'vite';

// The game had no Vite config at all until it needed deploying: the defaults
// are right for a single-page game served from the root of a dev server, and
// adding a file to restate them would have been noise.
//
// Deploying to GitHub Pages is what breaks the defaults. Pages serves a
// project site under the repository name -- https://<user>.github.io/<repo>/
// -- so the bundle is not at the root of its origin, and every absolute URL
// the build emits points one level too high.
export default defineConfig(({ command }) => ({
  // Relative, not '/tode_the_santa/'.
  //
  // Hardcoding the repository name works and is what the Pages docs suggest,
  // but it is a second place the repo is named: this project has already been
  // renamed once, and the failure mode is a silent one -- the rename does not
  // break the build, it breaks the deployed page, and only for whoever opens
  // it. A relative base is resolved by the browser against the page's own URL,
  // so the same bundle is correct at the domain root, under a repository name,
  // or behind a custom domain, and a rename needs no code change.
  //
  // Build only. Vite's dev server has no such prefix, and a relative base is
  // meaningless to it, so dev keeps the plain root and `BASE_URL` stays '/'
  // while developing -- see src/assets.js, which joins runtime asset paths
  // onto it.
  base: command === 'build' ? './' : '/',
}));
