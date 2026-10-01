import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: ["dist/**", ".vinext/**", ".wrangler/**"] },
  ...nextVitals,
  ...nextTypeScript,
];

export default eslintConfig;