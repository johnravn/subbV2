// src/shared/theme/ThemeWrapper.tsx
import * as React from 'react'
import { Theme } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { companyDetailQuery } from '@features/company/api/queries'
import type { RadixAccentColor } from '@features/company/api/queries'

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { companyId } = useCompany()

  const { data: companyData } = useQuery({
    ...(companyId
      ? companyDetailQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'company-detail'] as const,
          queryFn: () => Promise.resolve(null),
        }),
    enabled: !!companyId,
  })

  const [accentColor, setAccentColor] = React.useState<RadixAccentColor>(
    (companyData?.accent_color as RadixAccentColor | undefined) ?? 'indigo',
  )

  // Update accent color when company data changes
  React.useEffect(() => {
    const color = companyData?.accent_color
    if (!color) {
      setAccentColor('indigo')
      return
    }
    // Check if it's a valid Radix accent color (not 'conta' or 'none')
    const validColors: Array<RadixAccentColor> = [
      'gray',
      'gold',
      'bronze',
      'brown',
      'yellow',
      'amber',
      'orange',
      'tomato',
      'red',
      'ruby',
      'pink',
      'plum',
      'purple',
      'violet',
      'iris',
      'indigo',
      'blue',
      'cyan',
      'teal',
      'jade',
      'green',
      'grass',
      'mint',
      'lime',
      'sky',
    ]
    // Type guard to check if color is a valid Radix accent color
    const isValidColor = (c: string): c is RadixAccentColor => {
      return validColors.includes(c as RadixAccentColor)
    }
    if (isValidColor(color)) {
      setAccentColor(color)
    } else {
      setAccentColor('indigo')
    }
  }, [companyData?.accent_color])

  // Listen for accent color changes from the color picker
  React.useEffect(() => {
    const handleColorChange = (e: CustomEvent<{ color: RadixAccentColor }>) => {
      setAccentColor(e.detail.color)
    }

    window.addEventListener(
      'accent-color-changed',
      handleColorChange as EventListener,
    )
    return () =>
      window.removeEventListener(
        'accent-color-changed',
        handleColorChange as EventListener,
      )
  }, [])

  return (
    <Theme radius="small" accentColor={accentColor}>
      {children}
    </Theme>
  )
}
