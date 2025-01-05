import patchConsole from "patch-console"
import { useEffect, useState } from "react"
import { map, Observable, scan, share } from "rxjs"
import { logs$ } from "../logs"
import { Text, Box } from "ink"

export function LogView() {
	const [logs, setLogs] = useState<string>("ohoho")

	useEffect(() => {
		const subscription = logs$
			.pipe(
				map(
					({ stream, data }) =>
						`${stream === "stdout" ? "log" : "err"}: ${data}`,
				),
				scan((accumulator, current) => `${accumulator}${current}`),
			)
			.subscribe((data) => {
				setLogs(data)
			})

		return () => subscription.unsubscribe()
	}, [])

	return (
		<Box
			flexDirection="row"
			flexShrink={0}
			borderTop
			borderTopDimColor
			height={9}
		>
			<Text>{logs}</Text>
		</Box>
	)
}
