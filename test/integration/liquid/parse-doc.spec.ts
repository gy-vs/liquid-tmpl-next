import { Liquid } from '../../../src/liquid'

describe('liquid#parseDoc', function () {
  const liquid = new Liquid()

  const snippet = [
    '{% doc %}',
    '  Renders a product card.',
    '  @param {object} product - 要展示的商品',
    '  @param {string} [size] - 尺寸，可选',
    '  @example',
    '  {% render "card", product: p %}',
    '{% enddoc %}'
  ].join('\n')

  it('should parse the shopify-style example', function () {
    const doc = liquid.parseDoc(snippet)!
    expect(doc).toBeDefined()
    expect(doc.description).toBe('Renders a product card.')
    expect(doc.params).toEqual([
      { name: 'product', type: 'object', optional: false, description: '要展示的商品' },
      { name: 'size', type: 'string', optional: true, description: '尺寸，可选' }
    ])
    expect(doc.examples).toEqual(['{% render "card", product: p %}'])
  })

  it('should accept an already parsed template', function () {
    const tpl = liquid.parse(snippet)
    const doc = liquid.parseDoc(tpl)!
    expect(doc.description).toBe('Renders a product card.')
    expect(doc.params).toHaveLength(2)
  })

  it('should return undefined when there is no doc block', function () {
    expect(liquid.parseDoc('{{ foo }}')).toBeUndefined()
    expect(liquid.parseDoc(liquid.parse('{{ foo }}'))).toBeUndefined()
  })

  it('should support @description explicitly', function () {
    const src = [
      '{% doc %}',
      '  @description Explicit description.',
      '{% enddoc %}'
    ].join('\n')
    expect(liquid.parseDoc(src)!.description).toBe('Explicit description.')
  })

  it('should default type to null and description to empty string', function () {
    const src = [
      '{% doc %}',
      '  @param product',
      '  @param {number} count',
      '  @param [verbose]',
      '{% enddoc %}'
    ].join('\n')
    expect(liquid.parseDoc(src)!.params).toEqual([
      { name: 'product', type: null, optional: false, description: '' },
      { name: 'count', type: 'number', optional: false, description: '' },
      { name: 'verbose', type: null, optional: true, description: '' }
    ])
  })

  it('should keep newlines and dedent multiline examples', function () {
    const src = [
      '{% doc %}',
      '  Desc.',
      '  @example',
      '  {% if foo %}',
      '    {{ foo }}',
      '  {% endif %}',
      '{% enddoc %}'
    ].join('\n')
    const doc = liquid.parseDoc(src)!
    expect(doc.examples).toEqual(['{% if foo %}\n  {{ foo }}\n{% endif %}'])
  })

  it('should support multiple examples', function () {
    const src = [
      '{% doc %}',
      '  @example',
      '  one',
      '  @example',
      '  two',
      '{% enddoc %}'
    ].join('\n')
    expect(liquid.parseDoc(src)!.examples).toEqual(['one', 'two'])
  })

  it('should ignore unknown tags', function () {
    const src = [
      '{% doc %}',
      '  Desc.',
      '  @since 1.0',
      '  @param {string} name - the name',
      '  @see https://example.com',
      '{% enddoc %}'
    ].join('\n')
    const doc = liquid.parseDoc(src)!
    expect(doc.description).toBe('Desc.')
    expect(doc.params).toEqual([{ name: 'name', type: 'string', optional: false, description: 'the name' }])
  })

  it('should return empty fields for an empty doc block', function () {
    expect(liquid.parseDoc('{% doc %}{% enddoc %}')).toEqual({
      description: '',
      params: [],
      examples: []
    })
  })

  it('should not expose doc body variables to static analysis', async function () {
    const src = [
      '{% doc %}',
      '  @param {object} product',
      '  @example',
      '  {{ secretGlobal }}',
      '{% enddoc %}',
      '{{ visible }}'
    ].join('\n')
    const tpl = liquid.parse(src)
    const analysis = await liquid.analyze(tpl)
    expect(Object.keys(analysis.globals).sort()).toEqual(['visible'])
  })
})
