export const tryParseJson = <T>(json: string | null): T | undefined => {
  if (!json) return undefined
  try {
    return JSON.parse(json)
  } catch (_e) {
    return undefined
  }
}

export const uppercaseFirstLetter = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)
