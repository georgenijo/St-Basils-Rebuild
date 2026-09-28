import { describe, expect, it } from 'vitest'

import { parseVerdict } from './verdict'

describe('parseVerdict', () => {
  it('parses a single strict JSON object', () => {
    expect(parseVerdict('{"verdict":"pass","summary":"Looks right."}')).toEqual({
      verdict: 'pass',
      summary: 'Looks right.',
    })
    expect(parseVerdict('  {"summary": "Broken {layout}.", "verdict": "fail"}\n')).toEqual({
      verdict: 'fail',
      summary: 'Broken {layout}.',
    })
  })

  it('accepts one outer code fence', () => {
    expect(parseVerdict('```json\n{"verdict":"fail","summary":"Text missing."}\n```')).toEqual({
      verdict: 'fail',
      summary: 'Text missing.',
    })
    expect(parseVerdict('```\n{"verdict":"unsure","summary":"Below the fold."}\n```').verdict).toBe(
      'unsure'
    )
  })

  it('never takes an example pass over the actual fail', () => {
    const reply =
      'For example {"verdict":"pass","summary":"example"} — but actually:\n{"verdict":"fail","summary":"The caption is missing."}'
    expect(parseVerdict(reply).verdict).toBe('unsure')
    expect(
      parseVerdict('{"verdict":"pass","summary":"example"}\n{"verdict":"fail","summary":"real"}')
        .verdict
    ).toBe('unsure')
  })

  it('treats prose around the object as unsure', () => {
    expect(
      parseVerdict('I looked.\n{"verdict":"pass","summary":"Looks right."}\nDone.').verdict
    ).toBe('unsure')
    expect(
      parseVerdict('Here you go:\n```json\n{"verdict":"pass","summary":"x"}\n```').verdict
    ).toBe('unsure')
  })

  it('rejects invalid or missing fields', () => {
    expect(parseVerdict('{"verdict":"approved","summary":"yes"}').verdict).toBe('unsure')
    expect(parseVerdict('{"verdict":"PASS","summary":"yes"}').verdict).toBe('unsure')
    expect(parseVerdict('{"verdict":"pass"}').verdict).toBe('unsure')
    expect(parseVerdict('{"verdict":"pass","summary":"  "}').verdict).toBe('unsure')
    expect(parseVerdict('{"verdict":"pass","summary":"x","extra":1}').verdict).toBe('unsure')
    expect(parseVerdict('[{"verdict":"pass","summary":"x"}]').verdict).toBe('unsure')
    expect(parseVerdict('not json at all').verdict).toBe('unsure')
    expect(parseVerdict('').verdict).toBe('unsure')
    expect(parseVerdict('{"verdict":"pass"').verdict).toBe('unsure')
  })
})
