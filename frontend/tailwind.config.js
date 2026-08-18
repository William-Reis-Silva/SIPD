/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Identidade visual do SIPD — ver docs/DESIGN_SYSTEM.md.
        // Cada token de marca tem um par claro/escuro explícito (mesmo
        // padrão já usado no resto do app: `bg-white dark:bg-neutral-900`),
        // já que este projeto não usa CSS variables para temas.
        brand: {
          primary: '#0B3B82',
          'primary-dark': '#2D6FD6',
          secondary: '#1677D2',
          'secondary-dark': '#4FA3F7',
          light: '#EAF3FF',
          'light-dark': '#12335E',
          deep: '#06265A',
          'deep-dark': '#DCE9FB',
          gold: '#D9A62E',
          'gold-dark': '#E8C158',
          'gold-light': '#FFF4D6',
          'gold-light-dark': '#3A2E10',
        },
        semantic: {
          success: '#16A34A',
          'success-dark': '#22C55E',
          warning: '#D97706',
          'warning-dark': '#F59E0B',
          error: '#DC2626',
          'error-dark': '#EF4444',
          info: '#2563EB',
          'info-dark': '#3B82F6',
        },
      },
    },
  },
  plugins: [],
};
