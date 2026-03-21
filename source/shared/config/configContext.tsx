import { useAppContext } from "#/app/context"
import type { AppConfig } from "./config"

export function useConfig(): AppConfig {
	return useAppContext().config
}
