import { randomInt } from "node:crypto"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { deepEquals, sleep } from "bun"
import { isNonNullish, isPromise } from "remeda"
import {
	type Observable,
	concatMap,
	distinctUntilChanged,
	filter,
	from,
	of,
	take
} from "rxjs"
import { match } from "ts-pattern"
import type { JsonValue } from "type-fest"
import { Result } from "typescript-result"
import { z } from "zod"
import { TEMP_DIRECTORY } from "#/constants"
import { logg } from "#/logs"
import { addErrorNotification } from "#/state/state"
import { type Socket$, createSocketClient } from "./socket"
import type { Player, PlayerEvent } from "./types"

const socketPath = path.join(TEMP_DIRECTORY, "mpv.sock")

/** This is the reply format of mpv from a socket request. */
const mpvReply = z.object({
	data: z.unknown(),
	request_id: z.number(),
	error: z
		.string()
		.transform((error) => (error === "success" ? undefined : error))
})
const endFileEvent = z.object({
	event: z.literal("end-file"),
	reason: z.enum(["eof", "stop", "quit", "error", "redirect", "unknown"]),
	playlist_entry_id: z.number().optional()
})

const mpvEvent = z.union([
	z.object({
		event: z.enum(["property-change", "shutdown"]),
		id: z.number().optional(),
		name: z.string().optional(),
		data: z.any()
	}),
	endFileEvent
])

// TODO restart on mpv crash
// and better error handling

/** Creates an mpv player child process and controls it via IPC */
export function createMpvPlayer(): Player {
	const socket = spawnMpv()

	return {
		play: async (id) => {
			// mpv's loadfile command always succeeds, even if the file does not exist.
			// So lets add a check here..
			const doesFileExist = await Bun.file(id).exists()
			if (!doesFileExist) {
				return Result.error(new Error(`File ${id} is not accessible.`))
			}

			return runCommand("loadfile", [id], socket)
		},

		pause: async () => runCommand("set_property", ["pause", true], socket),

		seek: async (seconds) => runCommand("seek", [seconds, "relative"], socket),

		seekTo: async (to) => runCommand("seek", [to, "absolute"], socket),

		clear: async () => runCommand("stop", [], socket),

		events$: socketToPlayerEvents(socket)
	}
}

function socketToPlayerEvents(
	socket: Promise<Socket$<JsonValue[]>> | Socket$<JsonValue[]>
): Observable<PlayerEvent> {
	return (isPromise(socket) ? from(socket) : of(socket)).pipe(
		concatMap((socket) => socket.events$),
		concatMap((event) =>
			match(event)
				.with({ type: "data" }, ({ data }) =>
					data
						.map((toParse) => mpvEvent.safeParse(toParse))
						.filter((zod) => zod.success)
						.map((zod) => parseEvent(zod.data))
						.filter(isNonNullish)
				)
				.otherwise(() => of(undefined))
		),

		filter(isNonNullish),
		distinctUntilChanged(deepEquals)
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
					currentTime: Math.ceil(propertyChange.data)
				} as const
			}
		)

		.with({ event: "end-file" }, ({ reason }) => {
			const toEmit: PlayerEvent =
				reason === "eof"
					? { type: "finishedTrack" }
					: { type: "error", error: `Track ended unexpected: ${reason}` }

			return toEmit
		})

		.with({ event: "shutdown" }, (event) => {
			addErrorNotification("MPV shut down", event)
			return undefined
		})

		.with({ event: "property-change" }, () => undefined)
		.exhaustive()
}

async function runCommand(
	command:
		| "get_property"
		| "loadfile"
		| "observe_property"
		| "seek"
		| "set_property"
		| "event"
		| "stop",
	args: JsonValue[],
	socket: Promise<Socket$<JsonValue[]>> | Socket$<JsonValue[]>
): Promise<Result<void, Error>> {
	const { client, events$ } = await socket
	const { payload, id: requestId } = createPayload(command, args)

	logg.debug(`COMMAND ${command}`, { requestId, args })
	client.write(payload)

	const waitForCommand: Promise<void> = new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			subscription.unsubscribe()
			reject(`Timeout: ${payload}`)
		}, 400)

		const subscription = events$
			.pipe(
				filter((event) => event.type === "data"),
				concatMap(({ data }) =>
					Promise.all(data.map((toTry) => mpvReply.safeParseAsync(toTry))).then(
						(results) =>
							results.find((result) => {
								return result.success && result.data.request_id === requestId
							})?.data
					)
				),
				filter(isNonNullish),
				take(1)
			)
			.subscribe((response) => {
				clearTimeout(timeoutId)

				if (response.error) {
					reject({ error: response.error, requestId })
					return
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

async function spawnMpv(): Promise<Socket$<JsonValue[]>> {
	await mkdir(path.dirname(socketPath), { recursive: true })

	const mpvFlags = [
		"--no-config",
		"--idle",
		`--input-ipc-server=${socketPath}`,
		"--vo=null",
		"--no-video"
	]

	// TODO handle restarting mpv on crash
	const mpv = Bun.spawn(["mpv", ...mpvFlags], {
		onExit: (subprocess) => subprocess.kill()
	})

	process.on("exit", () => {
		mpv.kill()
	})

	// Socket connection wont work unless mpv has finished starting up
	// TODO find a nice way to know when the socket is available
	const socket = sleep(500).then(() =>
		createSocketClient(socketPath, {
			onData: (data) =>
				data
					.toString()
					.split("\n")
					.filter((string) => string !== "")
					.map((string) => {
						try {
							return JSON.parse(string) as JsonValue
						} catch (error) {
							logg.warn("Failed to parse mpv json", { error, string })
							return undefined
						}
					})
					.filter(isNonNullish)
		})
	)

	return socket
}

/* async function waitForInit(
	mpvInstance: Subprocess<"ignore", "pipe", "inherit">
): Promise<void> {
	return Promise.resolve()
	return await mpvInstance.stdout
		.values()
		.next()
		.then((data) => {
			logg.debug(String(data))
		})
	// setTimeout(() => {
	// 	resolve()
	// 	// reject(new Error("Starting mpv timed out"))
	// }, 1500)

	// const timeoutId = setTimeout(
	// 	() => reject(new Error("Starting Mpv player timed out.")),
	// 	2500
	// )

	// mpvInstance.stdout.prependOnceListener("data", (event) => {
	// 	clearTimeout(timeoutId)
	// 	logg.debug({ socket: event?.toString() })
	// 	resolve()
	// })
} */
