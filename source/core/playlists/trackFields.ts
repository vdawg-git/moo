/**
 * Static map of track fields available for smart playlist filtering.
 * Lives in core to avoid the hexagonal violation of importing adapter column definitions.
 *
 * A sync test in `adapters/sqlite/trackFieldSync.test.ts` asserts this stays in sync
 * with the actual Drizzle schema.
 */

export type TrackFieldType = "string" | "number" | "date" | "boolean" | "list"

export const trackFieldTypes = {
	// Text fields
	title: "string",
	artist: "string",
	albumartist: "string",
	album: "string",
	comment: "string",
	composer: "string",
	albumsort: "string",
	titlesort: "string",
	work: "string",
	artistsort: "string",
	albumartistsort: "string",
	composersort: "string",
	lyricist: "string",
	writer: "string",
	conductor: "string",
	remixer: "string",
	arranger: "string",
	engineer: "string",
	publisher: "string",
	producer: "string",
	djmixer: "string",
	mixer: "string",
	technician: "string",
	label: "string",
	grouping: "string",
	totaltracks: "string",
	totaldiscs: "string",
	media: "string",
	catalognumber: "string",
	podcasturl: "string",
	releasestatus: "string",
	releasetype: "string",
	releasecountry: "string",
	script: "string",
	language: "string",
	performerInstrument: "string",
	key: "string",
	category: "string",
	keywords: "string",
	movement: "string",
	podcastId: "string",
	codec: "string",
	audioMD5: "string",
	tool: "string",
	codecProfile: "string",
	container: "string",

	// Number fields
	duration: "number",
	trackIndex: "number",
	trackIndexOf: "number",
	disk: "number",
	diskOf: "number",
	year: "number",
	movementTotal: "number",
	rating: "number",
	bpm: "number",
	averageLevel: "number",
	peakLevel: "number",
	movementIndex: "number",
	movementIndexOf: "number",
	bitrate: "number",
	trackGain: "number",
	numberOfChannels: "number",
	numberOfSamples: "number",
	trackPeakLevel: "number",
	sampleRate: "number",
	bitsPerSample: "number",
	albumGain: "number",
	size: "number",
	mtime: "number",

	// Boolean fields
	compilation: "boolean",
	podcast: "boolean",
	lossless: "boolean",

	// Date fields
	releasedate: "date",
	modificationTime: "date",

	// List (JSON array of strings) fields
	genre: "list",
	mood: "list"
} as const satisfies Record<string, TrackFieldType>

export type TrackFieldName = keyof typeof trackFieldTypes
