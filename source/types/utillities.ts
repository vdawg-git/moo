/**
 * Converts keys from `T | null` to `T | undefined`.
 *
 * Useful when mapping database types.
 * */
export type NullToUndefined<T> = {
	[Key in keyof T]: T[Key] extends string & { __brand: string }
		? T[Key]
		: T[Key] extends object
			? NullToUndefined<T[Key]>
			: keyof T[Key] extends null
				? Exclude<T[Key], null> | undefined
				: T[Key]
}
