import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import type { Player, PlayerEvent } from "./types"
import path from "node:path"
import { TEMP_DIRECTORY } from "#/constants"
import type { JsonValue } from "type-fest"
import { randomInt } from "node:crypto"
import { mkdir } from "node:fs/promises"
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
import { logg } from "#/logs"
import { sleep, type Subprocess } from "bun"

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
	socket: Promise<Socket$<JsonValue[]>> | Socket$<JsonValue[]>
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
		concatMap((event) =>
			match(event) //
				.with({ type: "data" }, ({ data }) =>
					data
						.map((toParse) => mpvEvent.safeParse(toParse))
						.filter((zod) => zod.success)
						.map((zod) => parseEvent(zod.data))
						.filter(isNonNullish)
				)
				.otherwise(() => of(undefined))
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
	socket: Promise<Socket$<JsonValue[]>> | Socket$<JsonValue[]>
): Promise<Result<void, Error>> {
	const { client, events$ } = await socket
	const { payload, id: requestId } = createPayload(command, args)

	logg.debug(`COMMAND ${command}\n`, { requestId })
	client.write(payload)

	const waitForCommand: Promise<void> = new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			subscription.unsubscribe()
			reject(`Timeout: ${payload}`)
		}, 1000)

		const subscription = events$
			.pipe(
				filter((event) => event.type === "data"),
				concatMap(({ data }) =>
					Promise.all(
						data.map((toTry) =>
							mpvReply
								.safeParseAsync(toTry)
								.then((parsed) =>
									parsed.success ? parsed.data.request_id === requestId : false
								)
						)
					).then((results) => results.some(Boolean))
				),
				filter((result) => result === true),
				take(1)
			)
			.subscribe(() => {
				clearTimeout(timeoutId)

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
