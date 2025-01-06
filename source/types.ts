/** A branded type for a file path. Just a string. */
export type FilePath = string & { __brand: "FilePath" }
