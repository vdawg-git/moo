type Option<T> = T | undefined

/** If the input is undefined use the provided default instead */
function getOrDefault<TInput, TDefault>(
	default_: TDefault
): (input: Option<TInput>) => TDefault | TInput {
	return (input) => input ?? default_
}

/**
 * Applies the mapper function if the input is not undefined.
 * Otherwise returns *undefined* (null becomes undefined too)
 */
function maybe<TInput, TOutput>(
	mapper: (value: TInput) => TOutput
): (input: Option<TInput>) => TOutput | undefined {
	return (input) =>
		input === undefined || input === null ? undefined : mapper(input)
}

/**
 * Contains a bunch of helper functions to deal with Option types (T | undefined)
 */
export const O = { getOrDefault, maybe }
