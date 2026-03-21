import { useConfig } from "#/shared/config/configContext"

/** Returns the icon config for the current theme. */
export function useIcons() {
	const config = useConfig()

	return config.icons
}
