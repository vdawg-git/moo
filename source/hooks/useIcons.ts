import { useConfig } from "#/config/configContext"

/** Returns the icon config for the current theme. */
export function useIcons() {
	const config = useConfig()

	return config.icons
}
