import type { Socket } from "bun"
import { type Observable, Subject } from "rxjs"

export type SocketEvents<T> =
	| { type: "data"; data: T }
	| { type: "error"; error: Error }
	| { type: "connectError"; error: Error }
	| { type: "close" }
	| { type: "open" }

export type Socket$<T> = {
	events$: Observable<SocketEvents<T>>
	client: Socket<undefined>
}

export async function createSocketClient<T>(
	socket: string,
	options: {
		/**
		 * Handles how data gets parsed from the raw ArrayBuffer.
		 *
		 * Mpv for example emits JSON, but it can emit multiple objects at the same time, so it requires extra handling.
		 * */
		onData: (data: Buffer<ArrayBufferLike>) => T
	}
): Promise<Socket$<T>> {
	const events$ = new Subject<SocketEvents<T>>()

	const client = await Bun.connect({
		unix: socket,
		socket: {
			data(socket, data) {
				events$.next({ type: "data", data: options.onData(data) })
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
