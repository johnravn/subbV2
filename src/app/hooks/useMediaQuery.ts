import * as React from 'react'

export function useMediaQuery(query: string) {
  const get = () =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  const [matches, setMatches] = React.useState(get)

  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
