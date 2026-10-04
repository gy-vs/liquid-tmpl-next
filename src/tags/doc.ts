import { TagToken, TopLevelToken, Tag } from '..'
import { isHTMLToken, isTagToken, docTagSymbol, docBodySymbol } from '../util'
import type { Parser } from '../parser'
import type { Liquid } from '../liquid'

/**
 * A single parameter declared in a `{% doc %}` block.
 */
export interface DocParam {
  /** Parameter name, without the square brackets used to mark optionality. */
  name: string;
  /** Type declared in braces (e.g. `string`), or `null` when not declared. */
  type: string | null;
  /** Whether the name was wrapped in square brackets. */
  optional: boolean;
  /** Description after the dash, or an empty string when absent. */
  description: string;
}

/**
 * Parsed contents of a `{% doc %}` block, returned by {@link Liquid.parseDoc}.
 */
export interface DocInfo {
  description: string;
  params: DocParam[];
  examples: string[];
}

export default class DocTag extends Tag {
  /** Marker identifying the built-in doc tag, see {@link docTagSymbol}. */
  public static [docTagSymbol] = true
  /** Raw text between `{% doc %}` and `{% enddoc %}`. */
  public [docBodySymbol]: string

  constructor (tagToken: TagToken, remainTokens: TopLevelToken[], liquid: Liquid, parser: Parser) {
    super(tagToken, remainTokens, liquid)
    if (parser.blockDepth > 0) {
      throw new Error(`tag ${tagToken.getText()} is not allowed inside another block`)
    }
    if (parser.docSeen) {
      throw new Error(`tag ${tagToken.getText()} duplicated, a template can only contain a single doc block`)
    }
    parser.docSeen = true

    const body: string[] = []
    while (remainTokens.length) {
      const token = remainTokens.shift()!
      if (isTagToken(token) && token.name === 'enddoc') break
      // the tokenizer treats the whole doc body as a raw HTML token
      if (isHTMLToken(token)) body.push(token.getText())
    }
    this[docBodySymbol] = body.join('')
  }
  render () {}
}

/**
 * Extract and parse the `{% doc %}` block from a raw template string.
 * Returns `undefined` when the source contains no doc block.
 */
export function parseDocContent (body: string): DocInfo {
  const lines = stripCommonIndent(body).split('\n')

  const params: DocParam[] = []
  const examples: string[] = []
  const descriptions: string[] = []

  type Section = 'description' | 'param' | 'example' | 'unknown'
  let section: Section = 'description'
  const paramHeader: string[] = []
  const exampleLines: string[] = []
  const descriptionLines: string[] = []

  function commit () {
    if (section === 'param') {
      const param = parseParam(paramHeader[0] || '')
      if (param) params.push(param)
    } else if (section === 'example' && exampleLines.some(line => line.trim())) {
      examples.push(stripExample(exampleLines))
    } else if (section === 'description' && descriptionLines.some(line => line.trim())) {
      descriptions.push(descriptionLines.join('\n').trim())
    }
    paramHeader.length = exampleLines.length = descriptionLines.length = 0
  }

  for (const line of lines) {
    const tagMatch = /^\s*@(\w+)\s?/.exec(line)
    if (tagMatch) {
      commit()
      const tag = tagMatch[1].toLowerCase()
      const rest = line.slice(tagMatch[0].length)
      if (tag === 'param') {
        section = 'param'
        paramHeader.push(rest)
      } else if (tag === 'example') {
        section = 'example'
        if (rest) exampleLines.push(rest)
      } else if (tag === 'description') {
        section = 'description'
        if (rest) descriptionLines.push(rest)
      } else {
        section = 'unknown'
      }
    } else if (section === 'param') {
      // continuation lines of a param header are not part of its signature
      continue
    } else if (section === 'example') {
      exampleLines.push(line)
    } else if (section === 'description') {
      descriptionLines.push(line)
    }
  }
  commit()

  return {
    description: descriptions.join('\n\n').trim(),
    params,
    examples
  }
}

function parseParam (header: string): DocParam | null {
  const { type, rest } = parseType(header)
  const { name, optional, rest: afterName } = parseName(rest)
  if (!name) return null

  let description = ''
  const dashMatch = /\s-\s?(.*)$/.exec(afterName)
  if (dashMatch) {
    description = dashMatch[1].trim()
  } else if (/^-\s?(.*)$/.test(afterName)) {
    description = afterName.replace(/^-\s?/, '').trim()
  }
  return { name, type, optional, description }
}

/** Consume a `{type}` declaration at the beginning of a param header. */
function parseType (str: string): { type: string | null, rest: string } {
  const match = /^\s*\{([^}]*)\}/.exec(str)
  if (!match) return { type: null, rest: str.trimStart() }
  const type = match[1].trim()
  return { type: type || null, rest: str.slice(match[0].length).trimStart() }
}

/** Consume the param name, optionally wrapped in `[]` to mark it optional. */
function parseName (str: string): { name: string, optional: boolean, rest: string } {
  const optional = str.startsWith('[')
  const source = optional ? str.slice(1) : str
  const end = source.search(/[\s\]]/)
  const hasName = /^\S/.test(source)
  const name = hasName ? source.slice(0, end === -1 ? source.length : end) : ''
  let rest: string
  if (optional && end !== -1) {
    rest = source.slice(end).replace(/^\s*\]/, '').trimStart()
  } else {
    rest = end === -1 ? '' : source.slice(end).trimStart()
  }
  return { name, optional, rest }
}

function stripExample (lines: string[]): string {
  return stripCommonIndent(lines.join('\n')).replace(/^\n+|\n+$/g, '')
}

/** Remove the longest all-whitespace indentation shared by every non-blank line. */
function stripCommonIndent (text: string): string {
  const lines = text.split('\n')
  let indent = ''
  for (const line of lines) {
    if (!line.trim()) continue
    const match = /^[ \t]*/.exec(line)!
    if (!indent || match[0].length < indent.length) {
      indent = match[0]
    }
  }
  if (!indent) return text
  return lines.map(line => line.startsWith(indent) ? line.slice(indent.length) : line.trimStart()).join('\n')
}
