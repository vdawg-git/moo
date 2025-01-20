import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import type { Player, PlayerEvent } from "./types"
import path from "node:path"
import { TEMP_DIRECTORY } from "#/constants"
import type { JsonValue } from "type-fest"
import { randomInt } from "node:crypto"
import { Result } from "typescript-result"
import { createSocketClient, type Socket$ } from "./socket"
import {
	filter,
	map as switchMap,
	type Observable,
	take,
	map,
	tap,
	from,
	concatMap,
	of
} from "rxjs"
import { z } from "zod"
import { isNonNullish, isPromise } from "remeda"
import { match } from "ts-pattern"
import { addErrorNotification } from "#/state/state"

const socketPath = path.join(TEMP_DIRECTORY, "mpv.sock")

/** This is the reply format of mpv from a socket request. */
const mpvReply = z.object({
	data: z.unknown(),
	request_id: z.number(),
	error: z
		.string()
		.transform((error) => (error === "success" ? undefined : error))
})
const mpvEvent = z.object({
	event: z.string(),
	id: z.number(),
	name: z.string(),
	data: z.any()
})

// TODO restart on mpv crash
// and better error handling

/** Creates an mpv player child process and controls it via IPC */
export function createMpvPlayer(): Player {
	const socket = spawnMpv()

	return {
		play: async (id) => runCommand("loadfile", [id], socket),

		pause: async () => runCommand("set_property", ["pause", true], socket),

		seek: async (seconds) => runCommand("seek", [seconds, "relative"], socket),

		seekTo: async (to) => runCommand("seek", [to, "absolute"], socket),

		clear: async () => runCommand("stop", [], socket),

		events$: socketToPlayerEvents(socket)
	}
}

function socketToPlayerEvents(
	socket: Promise<Socket$> | Socket$
): Observable<PlayerEvent> {
	return (isPromise(socket) ? from(socket) : of(socket)).pipe(
		concatMap((socket) => socket.events$),
		tap(() =>
			Result.fromAsync(
				runCommand("observePropery", [1, "playback-time"], socket)
			).onFailure((error) =>
				addErrorNotification("Failed to listen to progress updates", error)
			)
		),
		map((event) =>
			match(event) //
				.with({ type: "data" }, (dataEvent) => {
					const event = mpvEvent.safeParse(dataEvent.data.toString()).data
					if (!event) return

					return parseEvent(event)
				})
				.otherwise(() => undefined)
		),
		filter(isNonNullish)
	)
}

function parseEvent(event: z.infer<typeof mpvEvent>): PlayerEvent | undefined {
	return match(event)
		.with(
			{ event: "property-change", name: "playback-time" },
			(propertyChange) => {
				if (!propertyChange.data) return undefined

				return {
					type: "progress",
					currentTime: propertyChange.data
				} as const
			}
		)
		.otherwise(() => undefined)
}

async function runCommand(
	command: string,
	args: JsonValue[],
	socket: Promise<Socket$> | Socket$
): Promise<Result<void, Error>> {
	const { client, events$ } = await socket
	const { payload, id: requestId } = createPayload(command, args)

	client.write(payload)

	const waitForCommand: Promise<void> = new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			subscription.unsubscribe()
			reject(`Timeout: ${payload}`)
		})

		const subscription = events$
			.pipe(
				switchMap((event) => {
					if (event.type !== "data") return undefined

					try {
						return mpvReply.parse(event.data.toJSON())
					} catch {
						return undefined
					}
				}),
				filter(isNonNullish),
				filter(({ request_id }) => request_id === requestId),
				take(1)
			)
			.subscribe((data) => {
				clearTimeout(timeoutId)

				if (data.error) {
					reject(data.error)
				}

				resolve(undefined)
			})
	})

	return Result.fromAsyncCatching(waitForCommand)
}

/** Creates a command payload to be send to the mpv unix socket */
function createPayload(
	command: string,
	args: JsonValue[]
): { payload: string; id: number } {
	const id = randomInt(9999)
	const payload = { command: [command, ...args], request_id: id }

	// mpv needs the trailing new line
	return { payload: JSON.stringify(payload) + "\n", id }
}

async function spawnMpv() {
	console.log({ socketPath })
	const mpvFlags = ["--no-config", "--idle", `--input-ipc-server=${socketPath}`]
	// TODO handle restarting mpv on crash
	const mpv = spawn("mpv", mpvFlags)
	mpv.on("error", (error) => {
		throw error
	})
	mpv.stdout.on("data", (data: unknown) =>
		console.log("mpv data", String(data))
	)

	// Socket connection wont work unless mpv has finished starting up
	const socket = await waitForInit(mpv).then(() =>
		createSocketClient(socketPath)
	)
	return socket
}

async function waitForInit(
	mpvInstance: ChildProcessWithoutNullStreams
): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(
			() => reject("Starting Mpv player timed out."),
			88500
		)

		mpvInstance.stdout.prependOnceListener("data", (event) => {
			clearTimeout(timeoutId)
			console.log({ socket: event?.toString() })
			resolve()
		})
	})
}
