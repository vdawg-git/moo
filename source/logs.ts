import path from "node:path"
import { IS_DEV, LOGS_DIRECTORY } from "./constants"
import { createLogger, format, transports } from "winston"

const logsPath = IS_DEV
	? path.join(process.cwd(), "moo.log")
	: path.join(LOGS_DIRECTORY, "moo.log")

const logLevel = IS_DEV ? "debug" : process.env.LOG_LEVEL || "info"

const addTimestamp = format((info) => {
	info.timestamp ??= Date.now()
	return info
})

const transportFile = new transports.File({
	filename: logsPath,
	level: logLevel,
	format: format.combine(addTimestamp(), format.json())
})
const transportConsole = new transports.Console({
	handleExceptions: true,
	handleRejections: true,
	forceConsole: true
})

export const logg = createLogger({
	transports: [transportFile],
	exceptionHandlers: [transportConsole, transportFile],
	rejectionHandlers: [transportConsole, transportFile],
	exitOnError: false
})
