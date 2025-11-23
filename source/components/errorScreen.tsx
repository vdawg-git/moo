import { CowSay } from "./cowsay"

export function ErrorScreen({ error }: { error: Error | string }) {
	return (
		<box flexDirection="column">
			<CowSay d>{error instanceof Error ? error.message : error}</CowSay>
			{error instanceof Error && (
				<text>
					<span fg="red">Stack:</span>
					{error.stack}
				</text>
			)}
		</box>
	)
}
