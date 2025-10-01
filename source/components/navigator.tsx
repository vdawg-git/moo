import { useSelector } from "@xstate/store/react"
import { Text } from "tuir"
import { All } from "#/pages/allPage"
import { Playlist } from "#/pages/playlistPage"
import { appState } from "#/state/state"
import type { ViewPage, ViewPages } from "#/state/types"
import { QueuePage } from "#/pages/queuePage"

type Routes = { [K in keyof ViewPages]: (params: ViewPages[K]) => JSX.Element }
const routes: Routes = {
	home: () => <All />,
	playlist: ({ id }) => <Playlist id={id} />,
	search: () => <Text>Search is not implemented yet</Text>,
	queue: () => <QueuePage />
}

export function Navigator() {
	const view = useSelector(
		appState,
		({ context: { view } }) => view.history[view.historyIndex]
	)

	// biome-ignore lint/style/noNonNullAssertion: Should crash if undefined as it is unexpected
	return renderRoute(view!)
}

function renderRoute(view: ViewPage): JSX.Element {
	const Component = routes[view.route]

	// @ts-expect-error
	return <Component {...view.parameter} key={JSON.stringify(view)} />
}
