import { type IOptions as CowOptions, say } from "cowsay"
import { Text } from "tuir"

export const cowGlasses = {
	empty: "(oo)",
	default: "■-■¬",
	rounded: "○-○¬",
	rounded2: "●-●¬",
	stars: "★-★¬",
	diamonds: "◆-◆¬",
	triangles: "▼-▼¬"
}

type CowSayProps = { children: string } & Omit<CowOptions, "text">

export function CowSay({ children, ...options }: CowSayProps) {
	return <Text>{say({ text: children, ...options })}</Text>
}
