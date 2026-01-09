/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  experimentalOperatorPosition: "start",
  experimentalTernaries: false,
  trailingComma: "none",
  semi: false,
  useTabs: true,
  plugins: ["@prettier/plugin-oxc", "@ianvs/prettier-plugin-sort-imports"],
  importOrder: [
    "<BUILTIN_MODULES>",
    "^bun.+",
    "<THIRD_PARTY_MODULES>",
    "^#.+",
    "^[.]",
    "<TYPES>^(node:)",
    "<TYPES>^(bun:)",
    "<TYPES>",
    "<TYPES>^[.]"
  ],
  importOrderTypeScriptVersion: "5.9.3"
}

export default config
