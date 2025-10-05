import { useSelector } from "@xstate/store/react"
import { Text } from "tuir"
import { All } from "#/pages/allPage"
import { PlaylistPage } from "#/pages/playlistPage"
import { QueuePage } from "#/pages/queuePage"
import { appState } from "#/state/state"
import type { ViewPage, ViewPages } from "#/state/types"
import { ArtistPage } from "#/pages/artistPage"
import { AlbumPage } from "#/pages/albumPage"

type Routes = { [K in keyof ViewPages]: (params: ViewPages[K]) => JSX.Element }
const routes: Routes = {
	home: () => <All />,
	playlist: ({ id }) => <PlaylistPage id={id} />,
	search: () => <Text>Search is not implemented yet</Text>,
	queue: () => <QueuePage />,
	album: ({ id }) => <AlbumPage id={id} />,
	artist: ({ id }) => <ArtistPage id={id} />
}

export function Navigator() {
	const viewData = useSelector(
		appState,
		({ context: { view } }) => view.history[view.historyIndex]
	)

	if (!viewData) {
		throw new Error("view is undefined, should not happen #owygyh")
	}

	return renderRoute(viewData)
}

function renderRoute(view: ViewPage): JSX.Element {
	const Component = routes[view.route]

	// @ts-expect-error
	return <Component {...view.parameter} key={JSON.stringify(view)} />
}
