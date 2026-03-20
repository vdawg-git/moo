import { useAppContext } from "#/appContext"
import type { AppConfig } from "./config"

export function useConfig(): AppConfig {
	return useAppContext().config
}
