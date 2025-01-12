import { Box, Text } from "ink"
import { CowSay } from "./cowsay"

export function ErrorScreen({ error }: { error: Error | string }) {
	return (
		<Box flexDirection="column">
			<CowSay d>{error instanceof Error ? error.message : error}</CowSay>
			{error instanceof Error && (
				<Text>
					<Text color="red">Stack:</Text>
					{error.stack}
				</Text>
			)}
		</Box>
	)
}
