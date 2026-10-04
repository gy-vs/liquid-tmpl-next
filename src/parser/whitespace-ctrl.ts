import { Token } from '../tokens'
import { NormalizedFullOptions } from '../liquid-options'
import { isTagToken, isHTMLToken, isDelimitedToken, TYPES, INLINE_BLANK, BLANK } from '../util'

const blockTags: Record<string, string> = {
  raw: 'endraw',
  doc: 'enddoc'
}

export function whiteSpaceCtrl (tokens: Token[], options: NormalizedFullOptions) {
  let inBlock = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (!isDelimitedToken(token)) continue
    if (!inBlock && token.trimLeft) {
      trimLeft(tokens[i - 1], options.greedy)
    }

    if (isTagToken(token)) {
      if (Object.prototype.hasOwnProperty.call(blockTags, token.name)) inBlock = true
      else if (Object.values(blockTags).includes(token.name)) inBlock = false
    }

    if (!inBlock && token.trimRight) {
      trimRight(tokens[i + 1], options.greedy)
    }
  }
}

function trimLeft (token: Token, greedy: boolean) {
  if (!token || !isHTMLToken(token)) return

  const mask = greedy ? BLANK : INLINE_BLANK
  while (TYPES[token.input.charCodeAt(token.end - 1 - token.trimRight)] & mask) token.trimRight++
}

function trimRight (token: Token, greedy: boolean) {
  if (!token || !isHTMLToken(token)) return

  const mask = greedy ? BLANK : INLINE_BLANK
  while (TYPES[token.input.charCodeAt(token.begin + token.trimLeft)] & mask) token.trimLeft++
  if (token.input.charAt(token.begin + token.trimLeft) === '\n') token.trimLeft++
}
