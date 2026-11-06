/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'luxury-brown': '#503724',
        'luxury-dark': '#2c241e',
        'luxury-cream': '#F3EEE8',
        'luxury-bg': '#f7f3ee',
        'luxury-border': '#EAEAEA',
        'luxury-tan': '#CD9B77'
      },
      fontFamily: {
        montserrat: ['"Montserrat"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        manrope: ['"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        bodoni: ['"Bodoni Moda"', 'Didot', 'Bodoni MT', 'Georgia', 'serif'],
        serif: ['Trirong', 'Georgia', 'serif'],
        sans: ['Figtree', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        ui: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['Poppins', 'sans-serif']
      },
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1200px',
        '2xl': '1520px'
      }
    }
  },
  plugins: []
};
