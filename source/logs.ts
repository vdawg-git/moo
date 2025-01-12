import fs from "node:fs/promises"
import path from "node:path"
import patchConsole from "patch-console"
import { concatMap, type Observable, share, Subject } from "rxjs"
import { IS_DEV, LOGS_DIRECTORY } from "./constants"

type Log = {
	stream: "stdout" | "stderr"
	data: string
}
const logsPath = IS_DEV
	? path.join(process.cwd(), "logs.txt")
	: path.join(LOGS_DIRECTORY, "logs.txt")

const logsInput$ = new Subject<Log>()
/** Logs need to be patched via {@link patchLogs} for this to emit something */
export const logs$: Observable<Log> = logsInput$.pipe(share())

/**
 * Patches `console.*` to log to a file and to emit to {@link logs$}.
 *
 * Returns the unsubscription / cleanup.
 */
export function patchLogs() {
	const restore = patchConsole((stream, data) => {
		logsInput$.next({ stream, data })
	})

	const subscription = logsInput$
		.pipe(
			concatMap(({ stream, data }) =>
				fs.appendFile(
					logsPath,
					`${new Date().toISOString()} ${stream}: ${data}\n`,
				),
			),
		)
		.subscribe()

	return () => {
		restore()
		subscription.unsubscribe()
	}
}
