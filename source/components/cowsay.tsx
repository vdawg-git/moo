import { type IOptions as CowOptions, say } from "cowsay"

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
	return <text>{say({ text: children, ...options })}</text>
}
