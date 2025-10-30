// UI Feature Flags Configuration
export const UI_FLAGS = {
  neutralTheme: true, // flip to false to go back to original theme
  enableAdvancedFilters: true,
  enableMobileOptimizations: true,
  enableThemePresets: true,
  // When true, dropdowns use global data (ignore org scoping) to avoid empty lists
  // Useful for single-store setups or before org data is fully attached.
  forceGlobalDropdowns: true,
}

// Theme Configuration
export const THEME_CONFIG = {
  defaultTheme: 'neutral-luxe',
  availableThemes: ['default', 'neutral-luxe', 'carded', 'compact', 'zebra'],
  persistTheme: true,
}
