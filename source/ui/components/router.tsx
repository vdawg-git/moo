import { useSelector } from "@xstate/store/react"
import { AlbumPage } from "#/ui/pages/albumPage"
import { All } from "#/ui/pages/allPage"
import { ArtistPage } from "#/ui/pages/artistPage"
import { PlaylistPage } from "#/ui/pages/playlistPage"
import { QueuePage } from "#/ui/pages/queuePage"
import { QuickEditPage } from "#/ui/pages/quickEdit/quickEditPage"
import { useAppState } from "#/ui/hooks/useSelectors"
import type { ViewPage, ViewPages } from "#/core/state/types"
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
	const appState = useAppState()
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
