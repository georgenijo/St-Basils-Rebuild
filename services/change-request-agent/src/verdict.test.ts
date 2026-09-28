import { describe, expect, it } from 'vitest'

import { parseVerdict } from './verdict'

describe('parseVerdict', () => {
  it('parses strict JSON', () => {
    expect(parseVerdict('{"verdict":"pass","summary":"Looks right."}')).toEqual({
      verdict: 'pass',
      summary: 'Looks right.',
    })
  })

  it('parses fenced JSON and JSON surrounded by prose', () => {
    expect(parseVerdict('```json\n{"verdict":"fail","summary":"Text missing."}\n```')).toEqual({
      verdict: 'fail',
      summary: 'Text missing.',
    })
    expect(
      parseVerdict(
        'I looked at them.\n{"verdict": "Unsure", "summary": "Below the fold {x}."}\nDone.'
      )
    ).toEqual({
      verdict: 'unsure',
      summary: 'Below the fold {x}.',
    })
  })

  it('treats invalid verdicts and garbage as unsure', () => {
    expect(parseVerdict('{"verdict":"approved","summary":"yes"}').verdict).toBe('unsure')
    expect(parseVerdict('not json at all').verdict).toBe('unsure')
    expect(parseVerdict('').verdict).toBe('unsure')
    expect(parseVerdict('{"verdict":"pass"').verdict).toBe('unsure')
  })

  it('fills a missing summary', () => {
    expect(parseVerdict('{"verdict":"pass"}')).toEqual({
      verdict: 'pass',
      summary: 'No summary provided.',
    })
  })

  it('skips non-verdict objects and finds the real one', () => {
    expect(parseVerdict('{"note":1} then {"verdict":"fail","summary":"broken"}')).toEqual({
      verdict: 'fail',
      summary: 'broken',
    })
  })
})
