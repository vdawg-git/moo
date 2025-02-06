import { All } from "#/pages/all"
import { Playlist } from "#/pages/playlist"
import { type ViewPage, type ViewPages, appState } from "#/state/state"
import { useSelector } from "@xstate/store/react"
import { Text } from "tuir"
import { manageKeybinds } from "#/keybindingManagger"

type Routes = { [K in keyof ViewPages]: (params: ViewPages[K]) => JSX.Element }
const routes: Routes = {
	home: () => <All />,
	playlist: ({ id }) => <Playlist id={id} />,
	search: () => <Text>Search</Text>
}

export function Navigator() {
	const view = useSelector(
		appState,
		({ context: { view } }) => view.history[view.historyIndex]
	)

	manageKeybinds()

	// biome-ignore lint/style/noNonNullAssertion: Should crash if undefined as it is unexpected
	return renderRoute(view!)
}

function renderRoute(view: ViewPage): JSX.Element {
	const Component = routes[view.route]

	// @ts-expect-error
	return <Component {...view.parameter} />
}
