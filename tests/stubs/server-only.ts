/**
 * Test stub for the `server-only` package.
 *
 * The real module throws on import so that a bundler fails the build when
 * server code leaks into a client bundle. Vitest runs in Node, where that
 * guard has nothing to protect and would only prevent the tests from importing
 * the services they exist to verify. `next build` still enforces the real one.
 */
export {};
