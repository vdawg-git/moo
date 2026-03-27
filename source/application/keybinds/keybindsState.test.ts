import { describe, expect, it } from "bun:test"
import { ZONE_DEFAULT } from "#/core/commands/appCommands"
import { keybinding } from "#/shared/library/keybinds"
import { KeybindTrie } from "./keybindsState"
import type { KeybindCommand, KeybindZone } from "./keybindsState"

function makeCommand(id: string, zone?: KeybindZone): KeybindCommand {
	return {
		id,
		label: `cmd-${id}`,
		callback: () => {},
		zone: zone ?? ZONE_DEFAULT
	}
}

describe("KeybindTrie", () => {
	it("should store and retrieve single-key commands", () => {
		const trie = new KeybindTrie()
		const command = makeCommand("move-down")

		trie.addSequence(keybinding("j")[0]!, command)

		const found = trie.getCommandsForKeys(keybinding("j")[0]!)
		expect(found, "should find the registered command").toHaveLength(1)
		expect(found[0]!.id, "should have correct id").toBe("move-down")

		const notFound = trie.getCommandsForKeys(keybinding("k")[0]!)
		expect(notFound, "unregistered key returns empty").toHaveLength(0)
	})

	it("should store and retrieve multi-key sequences", () => {
		const trie = new KeybindTrie()
		const command = makeCommand("go-top")

		trie.addSequence(keybinding("g g")[0]!, command)

		const found = trie.getCommandsForKeys(keybinding("g g")[0]!)
		expect(found, "should find command at full sequence").toHaveLength(1)
		expect(found[0]!.id).toBe("go-top")

		const partial = trie.getCommandsForKeys(keybinding("g")[0]!)
		expect(partial, "partial match has no command").toHaveLength(0)
	})

	it("should handle multiple commands on the same key", () => {
		const trie = new KeybindTrie()
		const commandA = makeCommand("zone-a", "a" as KeybindZone)
		const commandB = makeCommand("zone-b", "b" as KeybindZone)

		trie.addSequence(keybinding("j")[0]!, commandA)
		trie.addSequence(keybinding("j")[0]!, commandB)

		const found = trie.getCommandsForKeys(keybinding("j")[0]!)
		expect(found, "should return both commands").toHaveLength(2)

		const ids = found.map((c) => c.id)
		expect(ids, "should contain both ids").toContain("zone-a")
		expect(ids, "should contain both ids").toContain("zone-b")
	})

	it("should retrieve correct trie node with getNode", () => {
		const trie = new KeybindTrie()
		const command = makeCommand("go-top")

		trie.addSequence(keybinding("g g")[0]!, command)

		const midNode = trie.getNode(keybinding("g")[0]!)
		expect(midNode, "intermediate node should exist").toBeDefined()
		expect(
			midNode!.children.has("g"),
			"intermediate node should have 'g' child"
		).toBe(true)

		const leafNode = trie.getNode(keybinding("g g")[0]!)
		expect(leafNode, "leaf node should exist").toBeDefined()
		expect(leafNode!.commands.size, "leaf should have the command").toBe(1)

		const missing = trie.getNode(keybinding("x")[0]!)
		expect(missing, "non-existent path returns undefined").toBeUndefined()
	})

	it("should collect next-up commands via DFS", () => {
		const trie = new KeybindTrie()
		const goTop = makeCommand("go-top")
		const goEnd = makeCommand("go-end")

		trie.addSequence(keybinding("g g")[0]!, goTop)
		trie.addSequence(keybinding("g e")[0]!, goEnd)

		const nextUp = trie.getNextUp(keybinding("g")[0]!)
		expect(nextUp, "should return both next-up commands").toHaveLength(2)

		const keys = nextUp.map((n) => n.keys.trim())
		expect(keys, "should include 'g' suffix").toContain("g")
		expect(keys, "should include 'e' suffix").toContain("e")

		const allFromRoot = trie.getNextUp([])
		expect(allFromRoot, "from root should collect all commands").toHaveLength(2)
	})

	it("should remove a command and prune empty nodes", () => {
		const trie = new KeybindTrie()
		const command = makeCommand("go-top")

		trie.addSequence(keybinding("g g")[0]!, command)
		trie.removeSequence(keybinding("g g")[0]!, "go-top")

		const found = trie.getCommandsForKeys(keybinding("g g")[0]!)
		expect(found, "command should be removed").toHaveLength(0)

		const midNode = trie.getNode(keybinding("g")[0]!)
		expect(midNode, "empty intermediate node should be pruned").toBeUndefined()
	})

	it("should not prune nodes that still have other commands or children", () => {
		const trie = new KeybindTrie()
		const commandA = makeCommand("go-top")
		const commandB = makeCommand("go-end")

		trie.addSequence(keybinding("g g")[0]!, commandA)
		trie.addSequence(keybinding("g e")[0]!, commandB)

		trie.removeSequence(keybinding("g g")[0]!, "go-top")

		const midNode = trie.getNode(keybinding("g")[0]!)
		expect(midNode, "intermediate node should still exist").toBeDefined()

		const remaining = trie.getCommandsForKeys(keybinding("g e")[0]!)
		expect(remaining, "sibling command should survive").toHaveLength(1)
		expect(remaining[0]!.id).toBe("go-end")
	})

	it("should handle removing a non-existent sequence gracefully", () => {
		const trie = new KeybindTrie()

		expect(() => {
			trie.removeSequence(keybinding("x y")[0]!, "nope")
		}).not.toThrow()
	})

	it("should collect all commands across the trie", () => {
		const trie = new KeybindTrie()

		trie.addSequence(keybinding("j")[0]!, makeCommand("cmd-a"))
		trie.addSequence(keybinding("g g")[0]!, makeCommand("cmd-b"))
		trie.addSequence(keybinding("ctrl+a")[0]!, makeCommand("cmd-c"))

		const allCommands = trie.getAllCommands()
		expect(allCommands.size, "should have all 3 commands").toBe(3)
		expect(allCommands.has("cmd-a")).toBe(true)
		expect(allCommands.has("cmd-b")).toBe(true)
		expect(allCommands.has("cmd-c")).toBe(true)
	})

	it("should differentiate keys with modifiers", () => {
		const trie = new KeybindTrie()
		const ctrlA = makeCommand("select-all")
		const plainA = makeCommand("append")

		trie.addSequence(keybinding("ctrl+a")[0]!, ctrlA)
		trie.addSequence(keybinding("a")[0]!, plainA)

		const ctrlResult = trie.getCommandsForKeys(keybinding("ctrl+a")[0]!)
		expect(ctrlResult, "ctrl+a should return only its command").toHaveLength(1)
		expect(ctrlResult[0]!.id).toBe("select-all")

		const plainResult = trie.getCommandsForKeys(keybinding("a")[0]!)
		expect(
			plainResult,
			"plain 'a' should return only its command"
		).toHaveLength(1)
		expect(plainResult[0]!.id).toBe("append")
	})
})
