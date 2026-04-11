import { useThemeContext } from '@/lib/theme'
import type { ThemeContextValue } from '@/lib/theme'

export function useTheme(): ThemeContextValue {
  return useThemeContext()
}
