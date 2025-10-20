export function makeWordPresentable(str: string): string {
  if (!str) return str
  const cleaned = str.replace(/[_-]+/g, ' ')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function fmtVAT(str: string): string {
  if (str.length == 9) {
    return str.slice(0, 3) + ' ' + str.slice(3, 6) + ' ' + str.slice(6)
  }
  return str
}
