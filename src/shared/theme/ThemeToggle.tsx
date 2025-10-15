import { Box, Flex, RadioCards, Text } from '@radix-ui/themes'
import { HalfMoon, ModernTv, SunLight } from 'iconoir-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type ThemeChoice = 'inherit' | 'light' | 'dark'
const STORAGE_KEY = 'theme' // only set when user forces light/dark

export default function ThemeToggle() {
  // Determine initial choice: user override -> inherit
  const initialChoice: ThemeChoice = useMemo(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null
    return stored === 'light' || stored === 'dark' ? stored : 'inherit'
  }, [])

  const [theme, setTheme] = useState<ThemeChoice>(initialChoice)
  const mqlRef = useRef<MediaQueryList | null>(null)

  // Apply theme choice to <html> and keep it updated
  useEffect(() => {
    const root = document.documentElement
    const apply = (mode: 'light' | 'dark') => {
      root.classList.remove('light', 'dark', 'light-theme', 'dark-theme')
      root.classList.add(mode)
    }

    // Clean up any previous listener
    if (mqlRef.current) {
      mqlRef.current.removeEventListener('change', handleSystemChange)
      mqlRef.current = null
    }

    function handleSystemChange(e: MediaQueryListEvent) {
      // only react to system changes when inheriting
      if (theme === 'inherit') apply(e.matches ? 'dark' : 'light')
    }

    if (theme === 'inherit') {
      // no stored override
      localStorage.removeItem(STORAGE_KEY)
      // follow current system
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      mqlRef.current = mql
      apply(mql.matches ? 'dark' : 'light')
      // keep in sync with system changes
      mql.addEventListener('change', handleSystemChange)
    } else {
      // user forced a theme
      localStorage.setItem(STORAGE_KEY, theme)
      apply(theme)
    }

    return () => {
      if (mqlRef.current) {
        mqlRef.current.removeEventListener('change', handleSystemChange)
        mqlRef.current = null
      }
    }
  }, [theme])

  return (
    <Box maxWidth="420px" p={'4'}>
      <RadioCards.Root
        value={theme}
        onValueChange={(val) => setTheme(val as ThemeChoice)}
      >
        <Flex
          width={'100%'}
          gap={'3'}
          wrap={'wrap'}
          align={'center'}
          justify={'center'}
        >
          <RadioCards.Item value="light">
            <Flex gap="2">
              <Text weight="bold">Light</Text>
              <SunLight />
            </Flex>
          </RadioCards.Item>

          <RadioCards.Item value="dark">
            <Flex gap="2">
              <Text weight="bold">Dark</Text>
              <HalfMoon />
            </Flex>
          </RadioCards.Item>
          <RadioCards.Item value="inherit">
            <Flex width="100%" gap="2">
              <Text weight="bold">System</Text>
              <ModernTv />
            </Flex>
          </RadioCards.Item>
        </Flex>
      </RadioCards.Root>
    </Box>
  )
}
