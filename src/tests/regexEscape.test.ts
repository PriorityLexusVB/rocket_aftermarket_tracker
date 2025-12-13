import { describe, expect, it } from 'vitest'
import { escapeForRegex } from '../utils/regex'

describe('escapeForRegex', () => {
  it('escapes regex metacharacters so placeholders are treated literally', () => {
    const placeholder = '{stock.number?}'
    const escaped = escapeForRegex(placeholder)

    expect(new RegExp(escaped).test('{stock.number?}')).toBe(true)
  })

  it('enables safe template replacement with special characters in keys', () => {
    const template = 'Value: {stock.number?}'
    const escaped = escapeForRegex('{stock.number?}')
    const replaced = template.replace(new RegExp(escaped, 'g'), '12345')

    expect(replaced).toBe('Value: 12345')
  })

  it('handles empty strings', () => {
    expect(escapeForRegex('')).toBe('')
  })

  it('escapes only metacharacters correctly', () => {
    expect(escapeForRegex('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
  })

  it('escapes existing backslashes', () => {
    expect(escapeForRegex('\\path\\to\\file')).toBe('\\\\path\\\\to\\\\file')
  })

  it('handles consecutive metacharacters without loss', () => {
    expect(escapeForRegex('}}}}')).toBe('\\}\\}\\}\\}')
  })
})
