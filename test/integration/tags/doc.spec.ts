import { Liquid } from '../../../src/liquid'

describe('tags/doc', function () {
  const liquid = new Liquid()
  const source = `{% doc %}
  Renders a product card.
  @param {object} product - 要展示的商品
  @param {string} [size] - 尺寸，可选
  @example
  {% render "card", product: p %}
{% enddoc %}`

  it('should render nothing', function () {
    expect(liquid.parseAndRenderSync(`${source}after`)).toBe('after')
  })
  it('should not parse content as liquid', function () {
    const src = '{% doc %}{{ unclosed\n{% render "x"\n{% enddoc %}'
    expect(liquid.parseAndRenderSync(src)).toBe('')
  })
  it('should support empty content', function () {
    expect(liquid.parseAndRenderSync('{% doc %}{% enddoc %}')).toBe('')
  })
  it('should respect whitespace control', function () {
    expect(liquid.parseAndRenderSync('  {%- doc %}\nx\n{% enddoc -%}  \nhi')).toBe('hi')
  })
  it('should throw when not closed', function () {
    expect(() => liquid.parse('{% doc %}\nbody')).toThrow(/doc .* not closed/)
  })
  it('should throw when declared twice', function () {
    const src = '{% doc %}\na\n{% enddoc %}\n{% doc %}\nb\n{% enddoc %}'
    expect(() => liquid.parse(src)).toThrow(/must appear only once/)
  })
  it('should throw inside an if tag', function () {
    expect(() => liquid.parse('{% if true %}{% doc %}a{% enddoc %}{% endif %}'))
      .toThrow(/must be at the top level/)
  })
  it('should throw inside a for tag', function () {
    expect(() => liquid.parse('{% for x in xs %}{% doc %}a{% enddoc %}{% endfor %}'))
      .toThrow(/must be at the top level/)
  })
  it('should allow a user-registered doc tag to take precedence', function () {
    const custom = new Liquid()
    custom.registerTag('doc', {
      parse: () => {},
      render: () => 'custom'
    })
    expect(custom.parseAndRenderSync('{% doc %}')).toBe('custom')
    expect(custom.parseDoc('{% doc %}')).toBeUndefined()
  })

  describe('parseDoc', function () {
    it('should return undefined without a doc tag', function () {
      expect(liquid.parseDoc('plain template')).toBeUndefined()
    })
    it('should accept parsed templates', function () {
      const templates = liquid.parse(source)
      expect(liquid.parseDoc(templates)?.description).toBe('Renders a product card.')
    })
    it('should parse the Shopify example', function () {
      expect(liquid.parseDoc(source)).toStrictEqual({
        description: 'Renders a product card.',
        params: [
          { name: 'product', type: 'object', optional: false, description: '要展示的商品' },
          { name: 'size', type: 'string', optional: true, description: '尺寸，可选' }
        ],
        examples: ['{% render "card", product: p %}']
      })
    })
    it('should support @description', function () {
      const src = `{% doc %}
      ignored preamble
      @description explicit description
      {% enddoc %}`
      expect(liquid.parseDoc(src)?.description).toBe('explicit description')
    })
    it('should default type to null and description to empty string', function () {
      const src = '{% doc %}@param product{% enddoc %}'
      expect(liquid.parseDoc(src)?.params).toStrictEqual([
        { name: 'product', type: null, optional: false, description: '' }
      ])
    })
    it('should keep newlines and strip common indentation in examples', function () {
      const src = `{% doc %}
      @example
        line one
          line two
        line three
      {% enddoc %}`
      expect(liquid.parseDoc(src)?.examples).toEqual(['line one\n  line two\nline three'])
    })
    it('should support content on the same line as @example', function () {
      const src = '{% doc %}@example {% render "x" %}{% enddoc %}'
      expect(liquid.parseDoc(src)?.examples).toEqual(['{% render "x" %}'])
    })
    it('should parse multiple examples', function () {
      const src = [
        '{% doc %}',
        '@example one',
        '@example',
        'two',
        '{% enddoc %}'
      ].join('\n')
      expect(liquid.parseDoc(src)?.examples).toEqual(['one', 'two'])
    })
    it('should ignore unknown tags', function () {
      const src = '{% doc %}\ndesc\n@sight unknown\n@param {String} x - d\n{% enddoc %}'
      const doc = liquid.parseDoc(src)
      expect(doc?.description).toBe('desc')
      expect(doc?.params.map(p => p.name)).toEqual(['x'])
    })
  })

  describe('static analysis', function () {
    it('should not report variables referenced inside doc', async function () {
      const src = source + '\n{{ product.title }}'
      const templates = liquid.parse(src)
      const globals = await liquid.globalVariables(templates)
      expect(globals.sort()).toEqual(['product'])
    })
  })
})
