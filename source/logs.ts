import path from "node:path"
import { createLogger, format, transports } from "winston"
import { APP_ROOT, IS_DEV, LOGS_DIRECTORY } from "./constants"

export type AppLogger = {
	readonly info: (message: string, meta?: Record<string, unknown>) => void
	readonly debug: (message: string, meta?: Record<string, unknown>) => void
	readonly error: (message: string, error?: unknown) => void
	readonly warn: (message: string, meta?: Record<string, unknown>) => void
}

const logsPath = IS_DEV
	? path.join(APP_ROOT, "moo.log")
	: path.join(LOGS_DIRECTORY, "moo.log")

const logLevel = IS_DEV ? "silly" : process.env.LOG_LEVEL || "info"

function createAppLogger(): AppLogger {
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

	const logg = createLogger({
		transports: [transportFile],
		exceptionHandlers: [transportConsole, transportFile],
		rejectionHandlers: [transportConsole, transportFile],
		exitOnError: true
	})

	return {
		debug: logg.debug.bind(logg),
		error: (message, error) => logg.error(message, enumarateError(error)),
		info: logg.info.bind(logg),
		warn: logg.warn.bind(logg)
	}
}

export const logger = createAppLogger()

function enumarateError(error: unknown) {
	return error instanceof Error
		? {
				name: error.name,
				stack: error.stack,
				message: error.message,
				cause: error.cause
			}
		: { error }
}
