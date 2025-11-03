import * as React from 'react'

/**
 * Hook to detect if dark mode is active
 * Checks both the HTML class and system preference
 */
export function useTheme() {
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window === 'undefined') return false
    const html = document.documentElement
    // Check if dark class is present
    if (html.classList.contains('dark')) return true
    if (html.classList.contains('light')) return false
    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  React.useEffect(() => {
    const html = document.documentElement
    const checkTheme = () => {
      if (html.classList.contains('dark')) {
        setIsDark(true)
      } else if (html.classList.contains('light')) {
        setIsDark(false)
      } else {
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
      }
    }

    // Initial check
    checkTheme()

    // Watch for class changes
    const observer = new MutationObserver(checkTheme)
    observer.observe(html, {
      attributes: true,
      attributeFilter: ['class'],
    })

    // Watch for system preference changes
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      // Only update if no explicit theme class is set
      if (
        !html.classList.contains('dark') &&
        !html.classList.contains('light')
      ) {
        setIsDark(mql.matches)
      }
    }
    mql.addEventListener('change', handleChange)

    return () => {
      observer.disconnect()
      mql.removeEventListener('change', handleChange)
    }
  }, [])

  return { isDark, isLight: !isDark }
}
