const { heroui } = require("@heroui/react");
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx}",
        "./node_modules/@heroui/theme/dist/components/(button|card|input|skeleton|popover|dropdown|menu|tooltip).js",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Pretendard Variable"', 'Pretendard', 'var(--font-nanum-gothic)', ...defaultTheme.fontFamily.sans],
                josefin: ['var(--font-josefin-sans)', ...defaultTheme.fontFamily.sans],
                'noto-serif-kr': ['var(--font-noto-serif-kr)', 'serif'],
                'pretendard': ['"Pretendard Variable"', 'Pretendard', 'var(--font-ibm-plex-sans-kr)', 'sans-serif'],
                'ibm-plex-sans-kr': ['var(--font-ibm-plex-sans-kr)', 'sans-serif'],
                'nanum-pen-script': ['var(--font-nanum-pen-script)', 'cursive'],
            },
            fontSize: {
                xs: ['0.8125rem', { lineHeight: '1.125rem' }],
            },
            screens: {
                'xs': '320px', // min-width
            },
            colors: {
                lavender: {
                    DEFAULT: 'var(--color-lavender)',
                    light: 'var(--color-lavender-light)',
                    muted: 'var(--color-lavender-muted)',
                    pale: 'var(--color-lavender-pale)',
                    border: 'var(--color-lavender-border)',
                },
                ivory: 'var(--color-ivory)',
                text: {
                    primary: 'var(--color-text-primary)',
                    secondary: 'var(--color-text-secondary)',
                }
            }
        },
        container: {
            center: true,
            padding: '1rem',
        },
    },
    plugins: [
        heroui(),
    ],
    darkMode: 'class',
};