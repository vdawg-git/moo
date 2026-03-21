import { useEffect } from "react"
import { logger } from "#/shared/logs"
import { CowSay } from "./cowsay"

export function ErrorScreen({ error }: { error: unknown }) {
	useEffect(() => {
		logger.error("An error occured in the app (error screen)", error)
	}, [error])

	return (
		<box flexDirection="column">
			<CowSay d>
				{error instanceof Error ? error.message : String(error)}
			</CowSay>
			{error instanceof Error && (
				<text>
					<span fg="red">Stack:</span>
					{error.stack}
				</text>
			)}
		</box>
	)
}
