import { displayKeybinding, type KeyBinding } from "#/lib/keybinds"
import type { Except } from "type-fest"

type TrieNode = {
	children: Map<string, TrieNode>
	commands: KeybindCommandMap
}

export type KeybindCommandMap = Map<string, CommandData>

export type KeybindCommandWhen = "default" | "modal"

export type KeybindCommand = {
	id: string
	label: string
	callback: () => void
	when: KeybindCommandWhen
}
export type KeybindNextUp = { command: KeybindCommand; keys: string }
export type KeybindMatches = Map<string, CommandData>

type CommandData = Except<KeybindCommand, "id">

class KeybindTrie {
	root: TrieNode = createEmptyNode()

	addSequence(sequence: KeyBinding, { id, ...commandData }: KeybindCommand) {
		let node = this.root
		for (const part of sequence) {
			const keyString = displayKeybinding([part])

			if (!node.children.has(keyString)) {
				node.children.set(keyString, createEmptyNode())
			}

			node = node.children.get(keyString)!
		}
		node.commands.set(id, commandData)
	}

	getNode(sequence: KeyBinding): TrieNode | undefined {
		let node = this.root

		for (const part of sequence) {
			const keyString = displayKeybinding([part])
			if (!node.children.has(keyString)) return undefined

			node = node.children.get(keyString)!
		}

		return node
	}

	getCommandsForKeys(sequence: KeyBinding): readonly KeybindCommand[] {
		const node = this.getNode(sequence)

		return (
			node?.commands
				.entries()
				.map(([id, data]) => ({ id, ...data }))
				.toArray() ?? []
		)
	}

	getNextUp(sequence: KeyBinding): readonly KeybindNextUp[] {
		const node = this.getNode(sequence)

		if (!node) return []

		const result: KeybindNextUp[] = []
		recursion(node, "")

		return result

		function recursion(node: TrieNode, keys: string) {
			if (node.commands.size > 0) {
				const toPush: readonly KeybindNextUp[] = node.commands
					.entries()
					.map(
						([id, data]) =>
							({
								command: { id, ...data },
								keys
							}) satisfies KeybindNextUp
					)
					.toArray()

				result.push(...toPush)
				return
			}

			node.children
				.entries()
				.forEach(([key, child]) => recursion(child, keys + " " + key))
		}
	}

	removeSequence(sequence: KeyBinding, id: string) {
		const stack: [TrieNode, string][] = []
		let node = this.root

		// Traverse and store path
		for (const part of sequence) {
			const keyString = displayKeybinding([part])
			if (!node.children.has(keyString)) return // Sequence doesn't exist

			stack.push([node, keyString])

			node = node.children.get(keyString)!
		}

		// Remove command
		node.commands.delete(id)

		// Prune empty nodes
		while (
			stack.length > 0 &&
			node.commands.size === 0 &&
			node.children.size === 0
		) {
			const [parent, keyString] = stack.pop()!
			parent.children.delete(keyString)
			node = parent
		}
	}

	getAllCommands(): KeybindCommandMap {
		const root = this.root
		const result: KeybindCommandMap = new Map()

		recursion(root)

		function recursion(node: TrieNode) {
			node.commands
				.entries()
				.forEach(([id, command]) => result.set(id, command))

			node.children.forEach((child) => recursion(child))
		}

		return result
	}
}

function createEmptyNode(): TrieNode {
	return {
		children: new Map(),
		commands: new Map()
	}
}

export const keybindsState = new KeybindTrie()
