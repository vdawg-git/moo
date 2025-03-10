import * as R from "remeda"
import { pipe } from "remeda"
import type { WritableDeep } from "type-fest"
import { z } from "zod"
import {
	appCommandsBase,
	type AppCommandData,
	type AppCommandID
} from "#/commands/commandsBase"
import type { AppCommandsMap } from "#/commands/appCommands"
import {
	type KeyBinding,
	type KeyInput,
	displayKeybinding,
	shortcutSchema
} from "./shortcutParser"

const keybindsRawShape = pipe(
	R.entries(appCommandsBase),
	R.map(([id, { description, keybindings }]) => {
		const defaultDisplay: string =
			(keybindings.length as number) === 0
				? "none"
				: keybindings.map((binding) => displayKeybinding(binding)).join("\n")

		return z
			.object({ command: z.literal(id), key: shortcutSchema } as const)
			.describe(description + "\n" + `Default: "${defaultDisplay}"`)
	})
)
const toDiscriminate = z.discriminatedUnion("command", [
	// biome-ignore lint/style/noNonNullAssertion: We need to do that bc of Zod's typing
	keybindsRawShape[0]!,
	...keybindsRawShape.slice(1)
])

export const keybindingsSchema = z
	.array(toDiscriminate)
	.describe(
		'The keybindings of the app. If a keybinding is not set its default value will be used, so you dont have to set any. You can unset a keybind by setting it to "null". Setting it to "" will not work.'
	)
	.default([])
	.transform<AppCommandsMap>((userBinds, ctx) => {
		// save to an object as later on we also want to support `value` for commands with arguments
		const reduced: Map<AppCommandID, readonly { key: KeyBinding }[]> =
			userBinds.reduce(
				(accumulator, { command: id, key }) => {
					const isSet = accumulator.get(id) !== undefined
					if (!isSet) {
						accumulator.set(id, [])
					}
					// biome-ignore lint/style/noNonNullAssertion: <explanation>
					accumulator.get(id)!.push({ key })
					return accumulator
				},
				new Map() as Map<AppCommandID, { key: KeyBinding }[]>
			)

		// clone the original as to not mutate it,
		// then override the keybindings with user-defined ones.
		const result = new Map(Object.entries(R.clone(appCommandsBase)))
		for (const [command, binds] of reduced.entries()) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const data = result.get(command)! as WritableDeep<AppCommandData>
			data.keybindings = binds.map(({ key }) => key) as KeyInput[][]
		}

		return result as AppCommandsMap
	})
