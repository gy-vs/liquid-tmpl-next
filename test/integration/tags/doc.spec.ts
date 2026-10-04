import { Liquid } from '../../../src/liquid'

describe('tags/doc', function () {
  const liquid = new Liquid()

  it('should render nothing', async function () {
    const src = 'a{% doc %}some docs{% enddoc %}b'
    expect(await liquid.parseAndRender(src)).toBe('ab')
  })

  it('should not parse its body as liquid', async function () {
    const src = [
      '{% doc %}',
      '  Renders a product card.',
      '  @example',
      '  {% render "card", product: p %}',
      '  {{ unclosed',
      '{% enddoc %}'
    ].join('\n')
    expect(await liquid.parseAndRender(src)).toBe('')
  })

  it('should respect whitespace control markers', async function () {
    const src = 'before\n{%- doc %}\n docs \n{%- enddoc %}\nafter'
    expect(await liquid.parseAndRender(src)).toBe('before\nafter')
  })

  it('should throw when not closed', function () {
    const src = '{% doc %}\nRenders a card.'
    expect(() => liquid.parse(src)).toThrow(/doc .* not closed/)
  })

  it('should throw when duplicated at top level', function () {
    const src = '{% doc %}one{% enddoc %}{% doc %}two{% enddoc %}'
    expect(() => liquid.parse(src)).toThrow(/doc.*duplicated/)
  })

  it('should throw when nested inside an if block', function () {
    const src = '{% if true %}{% doc %}docs{% enddoc %}{% endif %}'
    expect(() => liquid.parse(src)).toThrow(/doc.*not allowed inside another block/)
  })

  it('should throw when nested inside a for block', function () {
    const src = '{% for x in xs %}{% doc %}docs{% enddoc %}{% endfor %}'
    expect(() => liquid.parse(src)).toThrow(/doc.*not allowed inside another block/)
  })

  it('should allow an unclosed tag and braces in the body', function () {
    const src = '{% doc %}{%if true%} {{{ {% enddoc %}'
    expect(() => liquid.parse(src)).not.toThrow()
  })

  it('should support sync rendering', function () {
    expect(liquid.parseAndRenderSync('{% doc %}docs{% enddoc %}x')).toBe('x')
  })

  describe('user override', function () {
    it('should use a user-registered tag named doc', function () {
      const engine = new Liquid()
      engine.registerTag('doc', {
        parse: function () {},
        render: function () { return 'custom-doc' }
      })
      expect(engine.parseAndRenderSync('{% doc %}')).toBe('custom-doc')
    })
  })
})
