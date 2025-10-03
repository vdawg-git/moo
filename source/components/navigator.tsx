import { useSelector } from "@xstate/store/react"
import { Text } from "tuir"
import { All } from "#/pages/allPage"
import { Playlist } from "#/pages/playlistPage"
import { QueuePage } from "#/pages/queuePage"
import { appState } from "#/state/state"
import type { ViewPage, ViewPages } from "#/state/types"

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

	if (!view) {
		throw new Error("view is undefined, should not happen #owygyh")
	}

	return renderRoute(view)
}

function renderRoute(view: ViewPage): JSX.Element {
	const Component = routes[view.route]

	// @ts-expect-error
	return <Component {...view.parameter} key={JSON.stringify(view)} />
}
