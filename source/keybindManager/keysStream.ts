import { Observable, share } from "rxjs"
import { renderer } from "#/renderer"
import type { KeyEvent, PasteEvent } from "@opentui/core"

export type KeyTypeData =
	| KeyPressEvent
	| { type: "keyrelease"; event: KeyEvent }
	| { type: "paste"; event: PasteEvent }

export type KeyPressEvent = { type: "keypress"; event: KeyEvent }

export const keys$: Observable<KeyTypeData> = new Observable<KeyTypeData>(
	(subscriber) => {
		renderer.keyInput.addListener("keypress", (event) =>
			subscriber.next({ type: "keypress", event })
		)

		renderer.keyInput.addListener("keyrelease", (event) =>
			subscriber.next({ type: "keyrelease", event })
		)

		renderer.keyInput.addListener("paste", (event) =>
			subscriber.next({ type: "paste", event })
		)

		// we only ever want to stop listening to changes when the app closes,
		// so we can simply remove all listeners here (or even dont unsubscribe at all tbf)
		return () => renderer.keyInput.removeAllListeners()
	}
).pipe(share())
