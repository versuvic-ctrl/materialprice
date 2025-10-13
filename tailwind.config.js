/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontSize: {
        'custom-xs': ['0.8125rem', { lineHeight: '1.125rem' }], // 13px
      },
    },
  },
  plugins: [require('@tailwindcss/line-clamp')],
};