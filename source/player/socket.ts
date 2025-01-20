import type { Socket } from "bun"
import { type Observable, Subject } from "rxjs"

export type SocketEvents =
	| { type: "data"; data: Buffer<ArrayBufferLike> }
	| { type: "error"; error: Error }
	| { type: "connectError"; error: Error }
	| { type: "close" }
	| { type: "open" }

export type Socket$ = {
	events$: Observable<SocketEvents>
	client: Socket<undefined>
}

export async function createSocketClient(socket: string): Promise<Socket$> {
	const events$ = new Subject<SocketEvents>()

	const client = await Bun.connect({
		unix: socket,
		socket: {
			data(socket, data) {
				events$.next({ type: "data", data })
			},
			connectError(socket, error) {
				events$.next({ type: "connectError", error })
			},
			close(socket) {
				events$.next({ type: "close" })
				events$.complete()
			},
			open(socket) {
				events$.next({ type: "open" })
			},
			error(socket, error) {
				events$.next({ type: "error", error })
			}
		}
	})

	return { events$, client }
}
