// src/shared/phone/phone.ts
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js/core'

export function normalizeToE164(value: string, defaultCountry?: CountryCode) {
  const p = parsePhoneNumberFromString(value, defaultCountry) // e.g., 'NO'
  return p?.isValid() ? p.number : null // E.164 or null
}

export function formatInternational(e164: string) {
  const p = parsePhoneNumberFromString(e164)
  return p?.formatInternational() ?? e164
}

export function formatNational(e164: string) {
  const p = parsePhoneNumberFromString(e164)
  return p?.formatNational() ?? e164
}

export function isPhoneValid(value: string, defaultCountry?: CountryCode) {
  const p = parsePhoneNumberFromString(value, defaultCountry)
  return !!p?.isValid()
}
