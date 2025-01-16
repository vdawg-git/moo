import { useEffect, useState } from "react"
import { map, scan } from "rxjs"
import { logs$ } from "../logs"
import { Text, Box } from "tuir"

export function LogView() {
	const [logs, setLogs] = useState<string>("")

	useEffect(() => {
		const subscription = logs$
			.pipe(
				map(
					({ stream, data }) =>
						`${stream === "stdout" ? "log" : "err"}: ${data}`
				),
				scan((accumulator, current) => `${accumulator}${current}`)
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
			borderColor={"white"}
		>
			<Text dimColor>Logs:</Text>
			<Text>{logs}</Text>
		</Box>
	)
}
