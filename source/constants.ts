import packageJson from "#/../package.json"

export const IS_DEV = process.env.NODE_ENV !== "production"

export const APP_NAME = packageJson.name
