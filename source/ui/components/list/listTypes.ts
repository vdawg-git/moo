export type ListItem<T> = {
	data: T
	/** The index of the item without any filtering applied */
	index: number
}

export type ListItemContextData = {
	focused: boolean
	indexDisplayed: number
	indexItem: number
}
