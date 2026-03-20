import { describe, expect, it } from "bun:test"
import {
	createInitialState,
	trackId,
	trackIds,
	trackIdsRange
} from "#/testHelpers"
import { getQueueDisplayItems } from "./queueDisplayItems"
import type { QueueDisplayItem } from "./queueDisplayItems"

function displayItem(
	type: "auto" | "manual",
	queueIndex: number,
	playState?: "playing" | "paused"
): QueueDisplayItem {
	const prefix = type === "auto" ? "track" : "manual"

	return {
		type,
		trackId: trackId(`${prefix}-${queueIndex}`),
		queueIndex,
		playState
	}
}

describe("getQueueDisplayItems", () => {
	it("should return empty for empty state", () => {
		const state = createInitialState()

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([])
	})

	it("should return upcoming auto tracks after current index", () => {
		const state = createInitialState({
			tracks: trackIdsRange(5),
			index: 2
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([displayItem("auto", 3), displayItem("auto", 4)])
	})

	it("should return all manual tracks when playing from auto", () => {
		const state = createInitialState({
			manuallyAdded: trackIds("manual-0", "manual-1")
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([displayItem("manual", 0), displayItem("manual", 1)])
	})

	it("should skip first manual track when playing from manual queue", () => {
		const state = createInitialState({
			manuallyAdded: trackIds("manual-0", "manual-1", "manual-2"),
			isPlayingFromManualQueue: true
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([displayItem("manual", 1), displayItem("manual", 2)])
	})

	it("should show manual then auto upcoming when playing from manual", () => {
		const state = createInitialState({
			tracks: trackIdsRange(4),
			manuallyAdded: trackIds("manual-0", "manual-1"),
			isPlayingFromManualQueue: true,
			index: 1
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([
			displayItem("manual", 1),
			displayItem("auto", 2),
			displayItem("auto", 3)
		])
	})

	it("should show manual then auto upcoming when playing from auto", () => {
		const state = createInitialState({
			tracks: trackIdsRange(4),
			manuallyAdded: trackIds("manual-0"),
			index: 1
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([
			displayItem("manual", 0),
			displayItem("auto", 2),
			displayItem("auto", 3)
		])
	})

	it("should return empty auto upcoming when at last track", () => {
		const state = createInitialState({
			tracks: trackIdsRange(3),
			index: 2
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([])
	})

	it("should return only auto upcoming when single manual track is playing", () => {
		const state = createInitialState({
			tracks: trackIdsRange(3),
			manuallyAdded: trackIds("manual-0"),
			isPlayingFromManualQueue: true,
			index: 0
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([displayItem("auto", 1), displayItem("auto", 2)])
	})

	it("should include current auto track as playing when playState is playing", () => {
		const state = createInitialState({
			tracks: trackIdsRange(4),
			index: 1,
			playState: "playing"
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([
			displayItem("auto", 1, "playing"),
			displayItem("auto", 2),
			displayItem("auto", 3)
		])
	})

	it("should include current auto track as playing when playState is paused", () => {
		const state = createInitialState({
			tracks: trackIdsRange(3),
			index: 0,
			playState: "paused"
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([
			displayItem("auto", 0, "paused"),
			displayItem("auto", 1),
			displayItem("auto", 2)
		])
	})

	it("should include current manual track as playing when playing from manual", () => {
		const state = createInitialState({
			tracks: trackIdsRange(4),
			manuallyAdded: trackIds("manual-0", "manual-1"),
			isPlayingFromManualQueue: true,
			playState: "playing",
			index: 1
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([
			displayItem("manual", 0, "playing"),
			displayItem("manual", 1),
			displayItem("auto", 2),
			displayItem("auto", 3)
		])
	})

	it("should not include current track when stopped", () => {
		const state = createInitialState({
			tracks: trackIdsRange(3),
			index: 1
		})

		const result = getQueueDisplayItems(state.playback)

		expect(result).toEqual([displayItem("auto", 2)])
	})
})
