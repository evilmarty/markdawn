import YamlParser from 'js-yaml'

export function splitFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return { frontmatter: '', body: markdown }
  return {
    frontmatter: match[1],
    body: markdown.slice(match[0].length),
  }
}

export function applyFrontmatter(markdown, nextFrontmatter) {
  const { body } = splitFrontmatter(markdown)
  const cleanedBody = body.replace(/^\n+/, '')
  const trimmedFrontmatter = nextFrontmatter.trim()
  if (!trimmedFrontmatter) return cleanedBody
  return `---\n${trimmedFrontmatter}\n---\n\n${cleanedBody}`
}

export function makeFrontmatterRow(key = '', value = '') {
  return {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `fm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    key,
    value,
  }
}

export function parseFrontmatterRows(markdown) {
  const { frontmatter } = splitFrontmatter(markdown)
  if (!frontmatter.trim()) return [makeFrontmatterRow()]

  try {
    const parsed = YamlParser.load(frontmatter)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [makeFrontmatterRow()]
    }
    const entries = Object.entries(parsed).map(([key, value]) =>
      makeFrontmatterRow(
        key,
        typeof value === 'string' ? value : value == null ? '' : YamlParser.dump(value).trim(),
      ),
    )
    return entries.length > 0 ? entries : [makeFrontmatterRow()]
  } catch {
    return [makeFrontmatterRow()]
  }
}

export function rowsToFrontmatter(rows) {
  const data = {}

  for (const row of rows) {
    const key = row.key.trim()
    const value = row.value.trim()
    if (!key || !value) continue

    try {
      data[key] = YamlParser.load(value)
    } catch {
      data[key] = value
    }
  }

  if (Object.keys(data).length === 0) return ''
  return YamlParser.dump(data).trim()
}
