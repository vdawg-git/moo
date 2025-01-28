import cowsay, { type IOptions as CowOptions } from "cowsay"
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
	return <Text>{cowsay.say({ text: children, ...options })}</Text>
}
