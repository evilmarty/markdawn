import { describe, expect, it } from 'vitest'
import {
  applyFrontmatter,
  makeFrontmatterRow,
  parseFrontmatterRows,
  rowsToFrontmatter,
  splitFrontmatter,
  validateFrontmatterRows,
} from './frontmatter'

describe('frontmatter utilities', () => {
  it('splits markdown with and without frontmatter', () => {
    expect(splitFrontmatter('# body')).toEqual({ frontmatter: '', body: '# body' })
    expect(splitFrontmatter('---\ntitle: hi\n---\n\n# body')).toEqual({
      frontmatter: 'title: hi',
      body: '\n# body',
    })
  })

  it('applies and removes frontmatter correctly', () => {
    const withFrontmatter = applyFrontmatter('# body', 'title: Hi')
    expect(withFrontmatter).toContain('---\ntitle: Hi\n---')
    expect(withFrontmatter).toContain('# body')
    expect(applyFrontmatter(withFrontmatter, '')).toBe('# body')
  })

  it('creates at least one empty row for invalid or missing frontmatter', () => {
    expect(parseFrontmatterRows('# body')).toHaveLength(1)
    expect(parseFrontmatterRows('---\n: bad\n---\n\n# body')).toHaveLength(1)
  })

  it('parses key/value rows from object frontmatter', () => {
    const rows = parseFrontmatterRows('---\ntitle: Demo\ndraft: false\n---\n\n# body')
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows.some((row) => row.key === 'title' && row.value === 'Demo')).toBe(true)
  })

  it('converts rows back to yaml and ignores empty keys/values', () => {
    const rows = [makeFrontmatterRow('title', 'Demo'), makeFrontmatterRow('draft', 'false'), makeFrontmatterRow('', '')]
    const yaml = rowsToFrontmatter(rows)
    expect(yaml).toContain('title: Demo')
    expect(yaml).toContain('draft: false')
  })

  it('returns row-level validation errors for invalid yaml values', () => {
    const invalidRow = makeFrontmatterRow('tags', '[')
    const errors = validateFrontmatterRows([invalidRow])
    expect(errors[invalidRow.id]).toContain('Invalid YAML value')
  })
})
