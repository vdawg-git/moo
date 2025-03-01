CREATE TABLE `albums` (
	`title` text NOT NULL,
	`artist` text,
	`sort` text,
	`id` text NOT NULL,
	PRIMARY KEY(`title`, `artist`),
	FOREIGN KEY (`artist`) REFERENCES `artists`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_id_unique` ON `albums` (`id`);--> statement-breakpoint
CREATE TABLE `artists` (
	`name` text PRIMARY KEY NOT NULL,
	`sort` text
);
--> statement-breakpoint
CREATE TABLE `composers` (
	`name` text PRIMARY KEY NOT NULL,
	`sort` text
);
--> statement-breakpoint
CREATE TABLE `movements` (
	`title` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `playlistTracks` (
	`playlistId` text NOT NULL,
	`trackId` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`playlistId`, `trackId`, `position`),
	FOREIGN KEY (`playlistId`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trackId`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`displayName` text
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`sourceProvider` text NOT NULL,
	`duration` integer NOT NULL,
	`title` text,
	`trackIndex` integer,
	`trackIndexOf` integer,
	`disk` integer,
	`diskOf` integer,
	`year` integer,
	`artist` text,
	`albumartist` text,
	`album` text,
	`comment` text,
	`genre` text,
	`picture` text,
	`composer` text,
	`lyrics` text,
	`albumsort` text,
	`titlesort` text,
	`work` text,
	`artistsort` text,
	`albumartistsort` text,
	`composersort` text,
	`lyricist` text,
	`writer` text,
	`conductor` text,
	`remixer` text,
	`arranger` text,
	`engineer` text,
	`publisher` text,
	`producer` text,
	`djmixer` text,
	`mixer` text,
	`technician` text,
	`label` text,
	`grouping` text,
	`totaltracks` text,
	`totaldiscs` text,
	`movementTotal` integer,
	`compilation` integer,
	`rating` integer,
	`bpm` integer,
	`mood` text,
	`media` text,
	`catalognumber` text,
	`podcast` integer,
	`podcasturl` text,
	`releasestatus` text,
	`releasetype` text,
	`releasecountry` text,
	`script` text,
	`language` text,
	`releasedate` integer,
	`performerInstrument` text,
	`averageLevel` integer,
	`peakLevel` integer,
	`key` text,
	`category` text,
	`keywords` text,
	`movement` text,
	`movementIndex` integer,
	`movementIndexOf` integer,
	`podcastId` text,
	`bitrate` integer,
	`codec` text,
	`audioMD5` text,
	`lossless` integer,
	`modificationTime` integer,
	`trackGain` integer,
	`numberOfChannels` integer,
	`numberOfSamples` integer,
	`tool` text,
	`trackPeakLevel` integer,
	`sampleRate` integer,
	`bitsPerSample` integer,
	`albumGain` integer,
	`codecProfile` text,
	`container` text,
	`size` integer,
	`mtime` integer,
	FOREIGN KEY (`artist`) REFERENCES `artists`(`name`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`albumartist`) REFERENCES `artists`(`name`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
