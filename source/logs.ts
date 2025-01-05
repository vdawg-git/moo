import patchConsole from "patch-console"
import { concatMap, type Observable, share, Subject } from "rxjs"
import fs from "node:fs/promises"
import os from "node:os"
import { IS_DEV } from "./constants"
import path from "node:path"

type Log = {
	stream: "stdout" | "stderr"
	data: string
}
const logsPath = IS_DEV
	? path.join(process.cwd(), "logs.txt")
	: path.join(os.homedir(), ".local/share/plx/logs.txt")

const logsInput$ = new Subject<Log>()
/** Logs need to be patched via {@link patchLogs} for this to emit something */
export const logs$: Observable<Log> = logsInput$.pipe(share())

/**
 * Patches console.* to emit to {@link logs$} and to write them to a file.
 * Returns the unsubscription.
 */
export function patchLogs() {
	// console.log = true
	// console.log = (...data) => {
	// 	logsInput$.next({ stream: "stdout", data: data.join(",") + "aiaiai" })
	// }

	const restore = patchConsole((stream, data) => {
		logsInput$.next({ stream, data })
	})

	const subscription = logsInput$
		.pipe(
			concatMap(({ stream, data }) =>
				fs.appendFile(logsPath, `${stream}: ${data}\n`),
			),
		)
		.subscribe()

	return () => {
		restore()
		subscription.unsubscribe()
	}
}
