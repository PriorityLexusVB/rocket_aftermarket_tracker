/**
 * Escapes characters with regex meaning so the provided string can be used
 * literally inside a RegExp constructor, preventing regex injection.
 */
export const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
