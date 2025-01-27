import { Text, type TextProps } from "tuir"

type Props = TextProps & { children: string }

export function BracketButton({ children, ...rest }: Props) {
	return (
		<Text {...rest}>
			<Text color={"gray"}>[</Text> {children} <Text color={"gray"}>] </Text>
		</Text>
	)
}
