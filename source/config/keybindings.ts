import { appCommands, type AppCommand } from "#/commands/commands"
import { z } from "zod"
import { displayKeybinding, shortcutSchema } from "./shortcutParser"

const optionalShortcut = shortcutSchema.nullable()

const keybinds = appCommands.map(({ id, description, keybinding }) =>
	z
		.object({ id: z.literal(id), key: optionalShortcut })
		.describe(
			description + "\n" + `Default: "${displayKeybinding(keybinding)}"`
		)
)
// biome-ignore lint/style/noNonNullAssertion: Zod workaround for its non-empty array argument
const toUnionize = [keybinds[0]!, keybinds[1]!, ...keybinds.slice(2)] as const

export const keybindingsSchema = z
	.array(z.union(toUnionize))
	.describe(
		'The keybindings of the app. If a keybinding is not set its default value will be used, so you dont have to set any. You can unset a keybind by setting it to "null". Setting it to "" will not work.'
	)
	.default([])
	.transform((userBinds, ctx) => {
		const userSetCommandIds = userBinds.map(({ id }) => id)
		// Commands set by the user should be overriden (thus the defaults removed)
		const defaultCommands = appCommands.filter(
			({ id }) => !userSetCommandIds.includes(id)
		)

		const userSetCommands: AppCommand[] = userBinds.flatMap((userBind) => {
			if (!userBind.key) return []

			const matchingCommand = appCommands.find(({ id }) => id === userBind.id)
			if (!matchingCommand) {
				// should not happen, as the IDs get checked during parsing
				ctx.addIssue({
					message: "Invalid ID passed. This is a bug. Please report it.",
					code: z.ZodIssueCode.custom
				})
				return []
			}

			return { ...matchingCommand, keybinding: userBind.key }
		})

		return [...defaultCommands, ...userSetCommands]
	})
