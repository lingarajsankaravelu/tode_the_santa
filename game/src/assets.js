// Where the game's files actually live at runtime.
//
// Every model, sample and image is fetched by URL while the game is running,
// not imported -- so the bundler never sees these paths and never rewrites
// them. That is fine while the game is served from the root of a domain, where
// a leading-slash path like `/models/tode.glb` is correct. It stops being fine
// on GitHub Pages, which serves the whole site under the repository name:
// the page is at /tode_the_santa/ and `/models/tode.glb` resolves to
// tode_the_santa-less nonsense at the domain root, so every load 404s and the
// game comes up as a black screen with a working HUD.
//
// Vite hands the deploy-time prefix to the running code as `BASE_URL`, which
// is `/` in dev and `./` in a build (see vite.config.js for why relative).
// Joining here rather than at each call site means the fourteen asset paths
// stay plain relative strings -- `models/tode.glb` -- and only one line in the
// codebase knows about hosting at all.
const BASE = import.meta.env.BASE_URL;

/**
 * Resolves a path inside `public/` against wherever the game is deployed.
 *
 * Takes the path as it sits in `public/` with no leading slash
 * (`models/tode.glb`, `sfx/catch.wav`), and tolerates a leading slash anyway
 * so a stray one is not a silent 404.
 */
export function asset(path) {
  return BASE + String(path).replace(/^\/+/, '');
}
