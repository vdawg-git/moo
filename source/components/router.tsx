import { useSelector } from "@xstate/store/react"
import { AlbumPage } from "#/pages/albumPage"
import { All } from "#/pages/allPage"
import { ArtistPage } from "#/pages/artistPage"
import { PlaylistPage } from "#/pages/playlistPage"
import { QueuePage } from "#/pages/queuePage"
import { QuickEditPage } from "#/pages/quickEdit/quickEditPage"
import { appState } from "#/state/state"
import type { ViewPage, ViewPages } from "#/state/types"
import type { ReactNode } from "react"

type Routes = { [K in keyof ViewPages]: (params: ViewPages[K]) => ReactNode }
const routes: Routes = {
	home: () => <All />,
	playlist: ({ id }) => <PlaylistPage id={id} />,
	search: () => <text>Search is not implemented yet</text>,
	queue: () => <QueuePage />,
	album: ({ id }) => <AlbumPage id={id} />,
	artist: ({ id }) => <ArtistPage id={id} />,
	quickEdit: ({ id }) => <QuickEditPage id={id} key={id} />
}

export function Router() {
	const viewData = useSelector(
		appState,
		({ context: { view } }) => view.history[view.historyIndex]
	)

	if (!viewData) {
		throw new Error("view is undefined, should not happen #owygyh")
	}

	return renderRoute(viewData)
}

function renderRoute(view: ViewPage): ReactNode {
	const Component = routes[view.route]

	// @ts-expect-error
	return <Component key={JSON.stringify(view)} {...view.parameter} />
}
