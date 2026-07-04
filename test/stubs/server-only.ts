// Empty stub: in Next.js RSC builds `server-only` resolves to an empty module
// via the `react-server` export condition. vitest (node env) has no such
// condition, so alias `server-only` here to reproduce that behavior and keep
// the production import guard from throwing during tests.
export {}
