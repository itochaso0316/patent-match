/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './themes/patent-modern/layouts/**/*.html',
    './content/**/*.md',
  ],
  theme: {
    extend: {
      colors: {
        patent: {
          blue: {
            50: '#eef2f7',
            100: '#d4dce8',
            200: '#a9b9d1',
            300: '#7e96ba',
            400: '#5373a3',
            500: '#2d5186',
            600: '#1a365d',
            700: '#142a4a',
            800: '#0f1f37',
            900: '#091424',
          },
          gold: {
            50: '#fdf8e8',
            100: '#faefc5',
            200: '#f5df8b',
            300: '#efd051',
            400: '#d69e2e',
            500: '#b7861f',
            600: '#986e19',
            700: '#795613',
            800: '#5a3f0e',
            900: '#3b2909',
          },
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Noto Serif JP"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      fontSize: {
        'body-ja': ['1.1rem', { lineHeight: '1.8', letterSpacing: '0.02em' }],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '800px',
            fontSize: '1.1rem',
            lineHeight: '1.8',
            letterSpacing: '0.02em',
            p: { marginTop: '1.5em', marginBottom: '1.5em' },
            li: { marginTop: '0.5em', marginBottom: '0.5em' },
            h2: {
              fontFamily: '"Noto Serif JP", Georgia, serif',
              fontWeight: '600',
              lineHeight: '1.4',
              marginTop: '2.5em',
            },
            h3: {
              fontFamily: '"Noto Serif JP", Georgia, serif',
              fontWeight: '600',
              lineHeight: '1.5',
              marginTop: '2em',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            table: {
              fontSize: '0.95rem',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
