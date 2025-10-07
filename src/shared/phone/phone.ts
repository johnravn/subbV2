// src/shared/phone/phone.ts
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js/core'

export function normalizeToE164(value: string, defaultCountry?: CountryCode) {
  const p = parsePhoneNumberFromString(value, defaultCountry) // e.g., 'NO'
  return p?.isValid() ? p.number : null // E.164 or null
}

export function formatInternational(e164: string) {
  const p = parsePhoneNumberFromString(e164)
  if (!p) return e164

  // Norwegian special-case: "+47 xxx xx xxx"
  if (p.country === 'NO') {
    const nn = p.nationalNumber || ''
    if (nn.length === 8) {
      return `+47 ${nn.slice(0, 3)} ${nn.slice(3, 5)} ${nn.slice(5)}`
    }
    // Fallback to library formatting for odd-length cases
    return p.formatInternational()
  }

  return p.formatInternational()
}

export function formatNational(e164: string) {
  const p = parsePhoneNumberFromString(e164)
  if (!p) return e164

  // Norwegian special-case: "xxx xx xxx"
  if (p.country === 'NO') {
    const nn = p.nationalNumber || ''
    if (nn.length === 8) {
      return `${nn.slice(0, 3)} ${nn.slice(3, 5)} ${nn.slice(5)}`
    }
    return p.formatNational()
  }

  return p.formatNational()
}

export function isPhoneValid(value: string, defaultCountry?: CountryCode) {
  const p = parsePhoneNumberFromString(value, defaultCountry)
  return !!p?.isValid()
}

export function prettyPhone(e164?: string | null) {
  if (!e164) return '—'
  try {
    return isPhoneValid(e164) ? formatInternational(e164) : e164
  } catch {
    return e164
  }
}
