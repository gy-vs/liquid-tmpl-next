import { Tag } from '../template/tag'
import type { Liquid } from '../liquid'
import type { TagToken, TopLevelToken } from '../tokens'
import { isTagToken } from '../util'

export interface DocParam {
  /** Parameter name as declared in the `@param` tag. */
  name: string;
  /** Value of the `{type}` part, or `null` when no type is declared. */
  type: string | null;
  /** Whether the name is wrapped in `[brackets]`. */
  optional: boolean;
  /** Description following the dash, or an empty string when absent. */
  description: string;
}

export interface Doc {
  /** Text before the first `@` tag, or the value of an explicit `@description` tag. */
  description: string;
  /** Declared `@param` tags, in document order. */
  params: DocParam[];
  /** Contents of each `@example` tag, with common indentation removed. */
  examples: string[];
}

const RE_TAG = /^@(\w+)([\s\S]*)$/

/**
 * Parse the body of a `{% doc %}` tag into its description, params and examples.
 */
export function parseDocBody (rawBody: string): Doc {
  const body = stripCommonIndent(rawBody)
  const params: DocParam[] = []
  const examples: string[] = []
  const preamble: string[] = []
  const descriptionTag: string[] = []
  let active: 'preamble' | 'description' | 'param' | 'example' | 'unknown' = 'preamble'

  for (const line of body.split(/\r\n?|\n/)) {
    const match = line.match(RE_TAG)
    if (match) {
      const [, tag, rest] = match
      const value = rest.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')
      if (tag === 'param') {
        active = 'param'
        const param = parseParam(value)
        if (param) params.push(param)
      } else if (tag === 'example') {
        active = 'example'
        examples.push(value)
      } else if (tag === 'description') {
        active = 'description'
        descriptionTag.push(value)
      } else {
        active = 'unknown'
      }
      continue
    }

    if (active === 'example') {
      examples[examples.length - 1] += '\n' + line
    } else if (active === 'description') {
      descriptionTag.push(line)
    } else if (active === 'preamble') {
      preamble.push(line)
    } else if (active === 'param') {
      const continuation = line.trim()
      const last = params[params.length - 1]
      if (last && continuation) last.description += ` ${continuation}`
    }
    // continuation lines of unknown tags are ignored
  }

  return {
    description: (descriptionTag.length ? descriptionTag.join('\n') : preamble.join('\n')).trim(),
    params,
    examples: examples.map(dedentExample)
  }
}

function parseParam (text: string): DocParam | null {
  let rest = text.trim()
  let type: string | null = null

  // optional `{type}` prefix
  if (rest[0] === '{') {
    const end = rest.indexOf('}')
    if (end === -1) return null
    type = rest.slice(1, end).trim()
    rest = rest.slice(end + 1).trim()
  }
  if (!rest) return null

  // name or `[name]`, optionally followed by ` - description`
  const match = rest.match(/^(\[[^\]]+\]|\S+?)(?:\s+-\s*([\s\S]*))?$/)
  if (!match) return null
  const [, rawName, rawDescription] = match
  const optional = rawName[0] === '[' && rawName[rawName.length - 1] === ']'
  return {
    name: optional ? rawName.slice(1, -1) : rawName,
    type,
    optional,
    description: (rawDescription || '').trim()
  }
}

function stripCommonIndent (text: string): string {
  const lines = text.split(/\r\n?|\n/)
  let indent = Infinity
  for (const line of lines) {
    if (!line.trim()) continue
    const match = line.match(/^[ \t]*/)!
    if (match[0].length < indent) indent = match[0].length
  }
  if (!indent || indent === Infinity) return text
  return lines.map(line => line.trim() ? line.slice(indent) : line).join('\n')
}

function dedentExample (example: string): string {
  const lines = example.split('\n')
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()

  let indent = Infinity
  for (const line of lines) {
    if (!line.trim()) continue
    const match = line.match(/^[ \t]*/)!
    if (match[0].length < indent) indent = match[0].length
  }
  if (indent === Infinity) indent = 0
  return lines.map(line => line.trim() ? line.slice(indent) : line).join('\n')
}

export default class DocTag extends Tag {
  static rawBlock = true
  body: string
  constructor (tagToken: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
    super(tagToken, remainTokens, liquid)
    const parts: string[] = []
    while (remainTokens.length) {
      const token = remainTokens.shift()!
      if (isTagToken(token) && token.name === 'enddoc') {
        this.body = parts.join('')
        return
      }
      parts.push(token.getText())
    }
    throw new Error(`tag ${tagToken.getText()} not closed`)
  }
  render () {}
}
