export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { ink: { 950: '#070b19', 900: '#0b1020', 800: '#10172e', 700: '#182142', 600: '#243060' }, line: '#222c52' },
    fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'] },
  } },
}
