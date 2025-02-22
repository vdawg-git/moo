import path from "node:path"
import { APP_ROOT, IS_DEV, LOGS_DIRECTORY } from "./constants"
import { createLogger, format, transports } from "winston"

const logsPath = IS_DEV
	? path.join(APP_ROOT, "moo.log")
	: path.join(LOGS_DIRECTORY, "moo.log")

const logLevel = IS_DEV ? "silly" : process.env.LOG_LEVEL || "info"

const transportFile = new transports.File({
	filename: logsPath,
	level: logLevel,
	handleExceptions: true,
	handleRejections: true,
	format: format.combine(
		format.errors({ stack: true }),
		format.timestamp(),
		format.json()
	)
})
const transportConsole = new transports.Console({
	handleExceptions: true,
	handleRejections: true
})

export const logg = createLogger({
	transports: [transportFile],
	exceptionHandlers: [transportConsole, transportFile],
	rejectionHandlers: [transportConsole, transportFile],
	exitOnError: true
})

export function enumarateError(error: unknown) {
	return error instanceof Error
		? {
				name: error.name,
				stack: error.stack,
				message: error.message,
				cause: error.cause
			}
		: { error }
}
