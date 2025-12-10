type IndexContext = {
	/** The index of the item without any filtering applied */
	index: number
}

export type ListItem<T> = {
	data: T
	/** The index of the item without any filtering applied */
	index: number
	onSelect: (context: IndexContext) => void
	onFocus?: (context: IndexContext) => void
}

export type ListItemContextData = {
	focused: boolean
	indexDisplayed: number
	indexItem: number
}
