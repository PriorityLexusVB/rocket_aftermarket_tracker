declare module 'pg' {
  // Minimal typing for CI typecheck; runtime uses the real pg package.
  export const Client: any
}
