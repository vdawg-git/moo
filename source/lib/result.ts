// This would be cool https://github.com/dmmulroy/better-result/blob/main/src/result.ts

type Result<TValue, TError = unknown> =
	| { readonly error: TError; readonly ok: false }
	| { readonly ok: true; readonly value: TValue }

/** Wraps a value in a successful Result. */
function ok<T>(value: T): Result<T, never> {
	return { ok: true, value }
}

/** Wraps an error in a failed Result. */
function error<TError>(resultError: TError): Result<never, TError> {
	return { error: resultError, ok: false }
}

/** Wraps a sync throwing function into a Result with `unknown` error. */
function fromTryCatch<T>(function_: () => T): Result<T, unknown> {
	try {
		return ok(function_())
	} catch (caughtError) {
		return error(caughtError)
	}
}

/** Transform the value if ok. */
function map<T, TOutput>(
	mapper: (value: T) => TOutput
): <TError>(result: Result<T, TError>) => Result<TOutput, TError> {
	return (result) => (result.ok ? ok(mapper(result.value)) : result)
}

/** Transform the error if not ok. */
function mapError<TError, TNewError>(
	mapper: (error: TError) => TNewError
): <T>(result: Result<T, TError>) => Result<T, TNewError> {
	return (result) => (result.ok ? result : error(mapper(result.error)))
}

/** If ok, chain a Result-returning function. Widens error type to `TError | TNewError`. */
function andThen<T, TOutput, TNewError>(
	function_: (value: T) => Result<TOutput, TNewError>
): <TError>(result: Result<T, TError>) => Result<TOutput, TError | TNewError> {
	return (result) => (result.ok ? function_(result.value) : result)
}

/** Unwrap the value or return a default. */
function getOrDefault<TDefault>(
	default_: TDefault
): <T>(result: Result<T, unknown>) => T | TDefault {
	return (result) => (result.ok ? result.value : default_)
}

/** Unwrap the value or throw the error. */
function getOrThrow<T, TError>(result: Result<T, TError>): T {
	if (result.ok) return result.value

	throw result.error
}

/** Exhaustive pattern match on a Result. */
function match<T, TError, TOutput>(handlers: {
	readonly error: (error: TError) => TOutput
	readonly ok: (value: T) => TOutput
}): (result: Result<T, TError>) => TOutput {
	return (result) =>
		result.ok ? handlers.ok(result.value) : handlers.error(result.error)
}

/**
 * Pipeable Result helpers for explicit error handling without exceptions.
 * Use with Remeda's `pipe()`.
 */
export const R = {
	andThen,
	error: error,
	fromTryCatch,
	getOrDefault,
	getOrThrow,
	map,
	mapError,
	match,
	ok
}

export type { Result }
