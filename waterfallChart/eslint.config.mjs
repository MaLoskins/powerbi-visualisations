import eslintPluginPowerbiVisuals from "eslint-plugin-powerbi-visuals";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptEslintParser from "@typescript-eslint/parser";

export default [
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: typescriptEslintParser,
        },
        plugins: {
            "powerbi-visuals": eslintPluginPowerbiVisuals,
            "@typescript-eslint": typescriptEslintPlugin,
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "warn",
            "no-console": "off",
        },
    },
];
