import { createContext, useContext } from "react"
import { createQuerySystem } from "./database/useQuery"
import { createKeybindManager } from "./keybindManager/keybindManager"
import { createDerivedState } from "./state/derivedState"
import {
	createAppState,
	createNotificationHelpers,
	createPlaybackActions
} from "./state/state"
import type { ErrorNotificationFn } from "#/types/types"
import type { ReactNode } from "react"
import type { AppConfig } from "./config/config"
import type { AppDatabase } from "./database/types"
import type { QuerySystem } from "./database/useQuery"
import type {
	KeybindManager,
	KeybindManagerDeps
} from "./keybindManager/keybindManager"
import type { Player } from "./player/types"
import type { NotificationAdd, PlaybackSource } from "./state/types"

export type AppContext = {
	readonly config: AppConfig
	readonly database: AppDatabase
	readonly player: Player
	readonly appState: ReturnType<typeof createAppState>["appState"]
	readonly appState$: ReturnType<typeof createAppState>["appState$"]
	readonly notifications: {
		readonly add: (notification: NotificationAdd) => string
		readonly addError: ErrorNotificationFn
	}
	readonly playNewPlayback: (args: {
		source: PlaybackSource
		index?: number
	}) => Promise<void>
	readonly query: QuerySystem
	readonly keybindManager: KeybindManager
	readonly derived: ReturnType<typeof createDerivedState>
}

/** Creates all app dependencies wired together */
export function createAppContext({
	config,
	database,
	player,
	keybindManagerDeps
}: {
	readonly config: AppConfig
	readonly database: AppDatabase
	readonly player: Player
	readonly keybindManagerDeps: Omit<KeybindManagerDeps, "appState$">
}): AppContext {
	const { appState, appState$ } = createAppState()
	const { addErrorNotification, addNotification } = createNotificationHelpers({
		appState
	})
	const { playNewPlayback } = createPlaybackActions({
		database,
		appState,
		addErrorNotification
	})
	const query = createQuerySystem(database.changed$)
	const keybindManager = createKeybindManager({
		appState$,
		...keybindManagerDeps
	})
	const derived = createDerivedState({
		appState$,
		database,
		player,
		addErrorNotification,
		observeQuery: query.observeQuery
	})

	return {
		config,
		database,
		player,
		appState,
		appState$,
		notifications: {
			add: addNotification,
			addError: addErrorNotification
		},
		playNewPlayback,
		query,
		keybindManager,
		derived
	}
}

const AppReactContext = createContext<AppContext | undefined>(undefined)

export function AppContextProvider({
	value,
	children
}: {
	readonly value: AppContext
	readonly children: ReactNode
}) {
	return <AppReactContext value={value}>{children}</AppReactContext>
}

export function useAppContext(): AppContext {
	const context = useContext(AppReactContext)
	if (!context) {
		throw new Error("useAppContext must be used within AppContextProvider")
	}

	return context
}
