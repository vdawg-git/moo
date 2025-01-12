import { state, type ViewPage, type ViewPages } from "../state/state"
import { useSelector } from "@xstate/store/react"
import { Playlist } from "#/views/playlist"
import { Text } from "ink"
import { All } from "#/views/all"

type Routes = { [K in keyof ViewPages]: (params: ViewPages[K]) => JSX.Element }
const routes: Routes = {
	home: () => <All />,
	playlist: ({ id }) => <Playlist id={id} />,
	search: () => <Text>Search</Text>,
}

export function Navigator() {
	const view = useSelector(
		state,
		({ context: { view } }) => view.history[view.historyIndex],
	)

	return renderRoute(view)
}

function renderRoute(view: ViewPage): JSX.Element {
	const Component = routes[view.route]

	// @ts-expect-error
	return <Component {...view.parameter} />
}
