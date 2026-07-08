import { getLlmsTxt } from '@/lib/llms'

describe('lib/llms', () => {
  it('states the site is a minesweeper game in plain English', () => {
    const text = getLlmsTxt('https://example.com')

    expect(text).toMatch(/MineScroll is a free online minesweeper game/i)
    expect(text).toMatch(/Genre: Minesweeper/i)
    expect(text).toMatch(/classic minesweeper rules/i)
    expect(text).toContain('https://example.com/play')
  })
})
