// src/features/company/components/AccentColorPicker.tsx
import { Box, Flex, Grid, Text } from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { companyDetailQuery, updateCompanyAccentColor } from '../api/queries'
import type { RadixAccentColor } from '../api/queries'

const RADIX_COLORS: Array<{ value: RadixAccentColor; label: string }> = [
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'purple', label: 'Purple' },
  { value: 'violet', label: 'Violet' },
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'amber', label: 'Amber' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'pink', label: 'Pink' },
  { value: 'iris', label: 'Iris' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'teal', label: 'Teal' },
  { value: 'jade', label: 'Jade' },
  { value: 'grass', label: 'Grass' },
  { value: 'mint', label: 'Mint' },
  { value: 'lime', label: 'Lime' },
  { value: 'sky', label: 'Sky' },
  { value: 'tomato', label: 'Tomato' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'plum', label: 'Plum' },
  { value: 'gold', label: 'Gold' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'brown', label: 'Brown' },
  { value: 'gray', label: 'Gray' },
]

export default function AccentColorPicker() {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  const { data: companyData } = useQuery({
    ...(companyId
      ? companyDetailQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'company-detail'] as const,
          queryFn: () => Promise.resolve(null),
        }),
    enabled: !!companyId,
  })

  // Get current color, defaulting to indigo if not set or invalid
  const currentColor: RadixAccentColor = (() => {
    const color = companyData?.accent_color
    if (!color) return 'indigo'
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
    const isValidColor = (
      c: string | null | undefined,
    ): c is RadixAccentColor => {
      return (
        c !== null &&
        c !== undefined &&
        validColors.includes(c as RadixAccentColor)
      )
    }
    return isValidColor(color) ? color : 'indigo'
  })()

  const updateColorMutation = useMutation({
    mutationFn: async (color: RadixAccentColor) => {
      if (!companyId) throw new Error('No company selected')
      return updateCompanyAccentColor({
        companyId,
        accentColor: color,
      })
    },
    onSuccess: (_, color: RadixAccentColor) => {
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'company-detail'],
      })
      success('Updated', 'Accent color has been updated.')
      // Apply color to document root for immediate preview
      document.documentElement.setAttribute('data-accent-color', color)
      // Dispatch custom event to notify Theme component
      window.dispatchEvent(
        new CustomEvent('accent-color-changed', { detail: { color } }),
      )
    },
    onError: (e: any) => {
      toastError('Failed to update color', e?.message ?? 'Please try again.')
    },
  })

  const handleColorChange = (color: RadixAccentColor) => {
    updateColorMutation.mutate(color)
  }

  return (
    <Box>
      <Text as="div" size="2" weight="bold" mb="3">
        Accent Color
      </Text>
      <Text as="div" size="1" color="gray" mb="3">
        Choose the accent color for your company theme. This color will be
        applied to all users in the company.
      </Text>
      <Grid columns="6" gap="2" style={{ maxWidth: 420 }}>
        {RADIX_COLORS.map((color) => {
          const isSelected = currentColor === color.value
          return (
            <ColorSwatch
              key={color.value}
              color={color.value}
              label={color.label}
              isSelected={isSelected}
              onClick={() => handleColorChange(color.value)}
            />
          )
        })}
      </Grid>
    </Box>
  )
}

function ColorSwatch({
  color,
  label,
  isSelected,
  onClick,
}: {
  color: RadixAccentColor
  label: string
  isSelected: boolean
  onClick: () => void
}) {
  // Map Radix color names to CSS color values for preview
  const colorMap: Record<RadixAccentColor, string> = {
    blue: '#3e63dd',
    green: '#30a46c',
    purple: '#8e4ec6',
    violet: '#6e56cf',
    red: '#e5484d',
    orange: '#f76808',
    amber: '#f59e0b',
    yellow: '#f5d90a',
    pink: '#d6409f',
    iris: '#5b5bd6',
    indigo: '#3451b2',
    cyan: '#0891b2',
    teal: '#12a594',
    jade: '#00a972',
    grass: '#46a758',
    mint: '#00c897',
    lime: '#65a30d',
    sky: '#0284c7',
    tomato: '#f23d3d',
    ruby: '#e54666',
    plum: '#ab4aba',
    gold: '#f7c948',
    bronze: '#cd7f32',
    brown: '#ad7f58',
    gray: '#6f6e77',
  }

  const colorValue = colorMap[color] || colorMap.blue

  return (
    <Flex direction="column" align="center" gap="1">
      <button
        type="button"
        onClick={onClick}
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: colorValue,
          border: isSelected
            ? '3px solid var(--gray-12)'
            : '2px solid var(--gray-a6)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: isSelected
            ? '0 0 0 2px var(--gray-a3)'
            : '0 1px 2px rgba(0, 0, 0, 0.1)',
          outline: 'none',
        }}
        aria-label={`Select ${label} color`}
        title={label}
      />
      <Text size="1" color={isSelected ? undefined : 'gray'}>
        {label}
      </Text>
    </Flex>
  )
}
