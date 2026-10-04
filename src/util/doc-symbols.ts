/**
 * Internal markers used to identify the built-in `doc` tag.
 *
 * Kept in `util` (which depends on nothing inside the package) so that both
 * the parser and the tag implementation can share them without introducing
 * an import cycle.
 */
export const docTagSymbol = Symbol('liquidjs:doc-tag')
export const docBodySymbol = Symbol('liquidjs:doc-body')

/**
 * Built-in block tags whose bodies are tokenized verbatim (no Liquid parsing).
 * `doc` is only active while the built-in doc tag is registered (see
 * {@link docTagSymbol}); a user-registered `doc` tag keeps normal tokenization.
 */
export const builtinRawBlockTags = ['raw', 'doc'] as const
