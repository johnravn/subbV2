export function makeWordPresentable(str: string): string {
  if (!str) return str
  const cleaned = str.replace(/[_-]+/g, ' ')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function fmtVAT(str: string | null | undefined): string {
  if (!str || str.trim() === '') return '—'
  // Remove any existing spaces/dashes for formatting
  const cleaned = str.replace(/[\s-]/g, '')
  // Format as "xxx xxx xxx" if we have 9 digits
  if (cleaned.length === 9) {
    return (
      cleaned.slice(0, 3) + ' ' + cleaned.slice(3, 6) + ' ' + cleaned.slice(6)
    )
  }
  // For other lengths, just return the cleaned string
  return cleaned
}
