// src/shared/auth/permissions.ts
export type CompanyRole = 'owner' | 'employee' | 'freelancer' | 'super_user'
export type Capability =
  | 'visit:home'
  | 'visit:inventory'
  | 'visit:vehicles'
  | 'visit:crew'
  | 'visit:jobs'
  | 'visit:calendar'
  | 'visit:customers'
  | 'visit:latest'
  | 'visit:matters'
  | 'visit:company'
  | 'visit:profile'
  | 'visit:super'

export type CapabilitySet = Set<Capability>

export function capabilitiesFor({
  isGlobalSuperuser,
  companyRole,
}: {
  isGlobalSuperuser: boolean
  companyRole: CompanyRole | null // null when no company selected
}): CapabilitySet {
  const caps = new Set<Capability>([
    'visit:home',
    'visit:calendar',
    'visit:matters',
    'visit:profile',
  ])

  // Global superuser: can do everything including /super
  if (isGlobalSuperuser) {
    ;(
      [
        'visit:super',
        'visit:company',
        'visit:inventory',
        'visit:vehicles',
        'visit:crew',
        'visit:jobs',
        'visit:customers',
        'visit:latest',
      ] as Array<Capability>
    ).forEach((c) => caps.add(c))
    return caps
  }

  if (!companyRole) {
    // Not in a company context: allow only generic pages (already added above)
    return caps
  }

  const allowAllCompany =
    companyRole === 'owner' || companyRole === 'super_user'
  if (allowAllCompany) {
    ;(
      [
        'visit:company',
        'visit:inventory',
        'visit:vehicles',
        'visit:crew',
        'visit:jobs',
        'visit:customers',
        'visit:latest',
      ] as Array<Capability>
    ).forEach((c) => caps.add(c))
    return caps
  }

  if (companyRole === 'employee') {
    // everything but company settings
    ;(
      [
        'visit:inventory',
        'visit:vehicles',
        'visit:crew',
        'visit:jobs',
        'visit:customers',
        'visit:latest',
      ] as Array<Capability>
    ).forEach((c) => caps.add(c))
    return caps
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (companyRole === 'freelancer') {
    // blocked: inventory, vehicles, crew, jobs
    // (calendar, matters, profile, home already allowed)
    return caps
  }

  return caps
}

export function canVisit(caps: CapabilitySet, need: Capability) {
  return caps.has(need)
}
