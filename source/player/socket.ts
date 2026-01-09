import { Subject } from "rxjs"
import type { Socket } from "bun"
import type { Observable } from "rxjs"

export type SocketEvents<T> =
	| { type: "data"; data: T }
	| { type: "error"; error: Error }
	| { type: "connectError"; error: Error }
	| { type: "close" }
	| { type: "open" }

export type SocketWrapper<T> = {
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
): Promise<SocketWrapper<T>> {
	const events$ = new Subject<SocketEvents<T>>()

	const client = await Bun.connect({
		unix: socket,
		socket: {
			data(_socket, data) {
				events$.next({ type: "data", data: options.onData(data) })
			},
			connectError(_socket, error) {
				events$.next({ type: "connectError", error })
			},
			close(_socket) {
				events$.next({ type: "close" })
				events$.complete()
			},
			open(_socket) {
				events$.next({ type: "open" })
			},
			error(_socket, error) {
				events$.next({ type: "error", error })
			}
		}
	})

	return { events$, client }
}
