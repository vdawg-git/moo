import { TextAttributes } from "@opentui/core"
import { useColors } from "#/hooks/useColors"
import { Input } from "../Input"
import type { ScrollBoxProps } from "@opentui/react"
import type { ReactNode } from "react"
import type { Except } from "type-fest"
import type { UseListReturn } from "./listState"
import type { ListItemContextData } from "./listTypes"

export { type UseListArgument, type UseListReturn, useList } from "./listState"
export type { ListItem } from "./listTypes"

type ListArgument<T> = {
	register: UseListReturn<T>
	render: (item: T, context: ListItemContextData) => ReactNode
} & Except<ScrollBoxProps, "children">

export function List<T>({
	register,
	render,
	...scrollboxProps
}: ListArgument<T>): ReactNode {
	if (!register) {
		throw new Error(`List received no proper register prop. It is ${register}`)
	}

	const {
		index: indexFocused,
		items,
		scrollboxRef,
		mode,
		setSearchString,
		searchString,
		setMode
	} = register

	const colors = useColors()

	return (
		<box>
			{(mode === "searchInput" || !!searchString) && (
				<box height={2} flexDirection="row">
					<text
						height={1}
						attributes={mode === "default" ? TextAttributes.DIM : undefined}
						fg={colors.blue}
					>
						Filter:{" "}
					</text>
					<Input
						focused={mode === "searchInput"}
						placeholder="Search.."
						onInput={setSearchString}
						height={1}
						width={"100%"}
						textColor={mode === "default" ? colors.brightBlack : undefined}
						onKeyDown={({ name }) => {
							if (name === "escape" || name === "return") setMode("default")
						}}
					/>
				</box>
			)}

			<scrollbox
				scrollbarOptions={{
					arrowOptions: {
						// dunno why this is not working
						foregroundColor: colors.red,
						backgroundColor: colors.yellow,
						attributes: TextAttributes.DIM
					},
					trackOptions: { backgroundColor: colors.bg }
				}}
				{...scrollboxProps}
				ref={scrollboxRef}
			>
				{items.map((item, indexDisplayed) => {
					// The item index is different here as the items could be filtered.
					// The item.index is the original one.
					const focused = indexFocused === indexDisplayed

					return (
						<box
							onMouseDown={() =>
								focused
									? register.onSelect(item)
									: register.setIndex(indexDisplayed)
							}
							key={item.index}
						>
							{render(item.data, {
								focused: indexDisplayed === indexFocused,
								indexDisplayed: indexDisplayed,
								indexItem: item.index
							})}
						</box>
					)
				})}
			</scrollbox>
		</box>
	)
}
