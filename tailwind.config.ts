import type { Config } from "tailwindcss";

const config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#FBF9F5",
        surface: "#FBF9F5",
        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#F5F3EF",
        "surface-container": "#EFEEEA",
        "surface-container-high": "#EAE8E4",
        primary: "#211D18",
        "on-primary": "#FFFFFF",
        "on-surface": "#1B1C1A",
        "on-surface-variant": "#4C463F",
        secondary: "#775928",
        "secondary-container": "#FFD79B",
        "on-secondary-container": "#7A5C2B",
        "outline-variant": "#CEC5BC",
        outline: "#7D766E",
        error: "#BA1A1A",
        "error-container": "#FFDAD6",
        "on-error-container": "#93000A",
        "status-received": "#C79A3A",
        "status-ready": "#3E8E6B",
        "status-collected": "#9A9186",
        "status-cancelled": "#B45B5B",
        "status-overdue": "#C0392B",
      },
      fontFamily: {
        wordmark: ["EB Garamond", "Georgia", "serif"],
        "headline-lg": ["Nunito Sans", "system-ui", "sans-serif"],
        "headline-md": ["Nunito Sans", "system-ui", "sans-serif"],
        "body-lg": ["Nunito Sans", "system-ui", "sans-serif"],
        "body-md": ["Nunito Sans", "system-ui", "sans-serif"],
        "label-lg": ["Nunito Sans", "system-ui", "sans-serif"],
        "label-sm": ["Nunito Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        wordmark: ["1.5rem", { lineHeight: "2rem", fontWeight: "500", letterSpacing: "0.02em" }],
        "headline-lg": ["1.75rem", { lineHeight: "2.25rem", fontWeight: "700", letterSpacing: "-0.01em" }],
        "headline-md": ["1.375rem", { lineHeight: "1.75rem", fontWeight: "700" }],
        "body-lg": ["1.125rem", { lineHeight: "1.625rem", fontWeight: "400" }],
        "body-md": ["1rem", { lineHeight: "1.5rem", fontWeight: "400" }],
        "label-lg": ["1rem", { lineHeight: "1.25rem", fontWeight: "700", letterSpacing: "0.01em" }],
        "label-sm": ["0.875rem", { lineHeight: "1.125rem", fontWeight: "600" }],
      },
      spacing: {
        "card-padding": "1.5rem",
        "gutter-y": "1rem",
        "stack-gap": "0.75rem",
        "margin-mobile": "1.25rem",
        "touch-target-min": "3rem",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
    },
  },
} satisfies Config;

export default config;