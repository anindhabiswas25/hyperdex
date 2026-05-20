/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream:          '#EDECEA',
        'cream-dark':   '#E3E0DB',
        lavender:       '#E4E0F8',
        'lavender-mid': '#C8C3ED',
        'lavender-deep':'#9B8FF0',
        navy:           '#1C1B2E',
        'navy-light':   '#2A2942',
        purple:         '#6B5CF6',
        'purple-mid':   '#8B7CF6',
        ink:            '#111118',
        'ink-muted':    '#77778A',
        white:          '#FFFFFF',
        // backward compat for swap/maker/admin dark pages
        black:          '#1C1B2E',
        'black-offset': '#2A2942',
        'black-light':  '#232235',
        'pure-white':   '#FFFFFF',
        cyan:           '#00FFD1',
        muted:          '#77778A',
      },
      fontFamily: {
        display: ['var(--font-dm-sans)', 'sans-serif'],
        serif:   ['var(--font-playfair)', 'Georgia', 'serif'],
        mono:    ['var(--font-space-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
