<div align="center">

<h1>Moo</h1>
<b>Sick terminal music player </b>
</br>

</div>

> [!WARNING]  
> The app is in early development. There are some bugs and a lot of features I still want to implement.

## Features

* Create smart playlists with a simple config (including autocompletion!)
  + Easy to back up. It's just simple `.yml` files
  + Updates automatically when your library changes
* Easy to use
  + Nice flexible runner a la VS Code.
  + No need to remember every shortcut. Just type the first letters of what you want
* Simple Json5 config with out-of-the-box LSP support via JSON schema :)
* Customize it to your liking.
  + (Chorded) keybindings, icons and more
  + Custom layouts/colors will get added in the future

## How to use

* Use <kbd>; </kbd> to switch to other playlists.
* Use <kbd>:</kbd> to open the commandd runner.
* <kbd>Enter</kbd> to play the selected track.
* <kbd>Space</kbd> to toggle pause.
* Default keybindings use Vim mode.

## Config

You can find the config in `~/.config/moo/config.json5` .
To take full advantage of the format use an editor with a `Yaml` LSP.

For VS Code you can install the [Yaml Extention](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml).

### Smart playlists

Create playlists as `.yml` files in `~/.config/moo/playlists/` .

The filters can be as complex and deeply nested as you want :)

Here is an example of a playlist:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/vdawg-git/moo/refs/heads/main/other/schemas/mooPlaylist.json

rules:
  - all:
      - artist:
          includes: ["Rick Astley", "Waterman"]
      - title:
          includes: ["never gonna give you up"]

  - any:
      - genre:
          includes: "deephouse"
```

## Install

On Arch you can use the AUR via `yay -S moo` .

### Requirements

* [mpv](https://mpv.io/)
* [Bun](https://bun.sh/)
* Terminal with Nerdfonts support like [Kitty](https://github.com/kovidgoyal/kitty) or [Ghostty](https://ghostty.org/) or use a [patched font](https://github.com/ryanoasis/nerd-fonts).

  You can also change all Nerdfont icons to regular letters in the config though.

### Steps

* Install the required depedencies (mpv and Bun)

```bash
  # Clone the repo
  git clone git@github.com:vdawg-git/moo.git
  cd moo
  # Install the dependencies
  bun install
  # Compile into a single executable
  bun compile
```

The executable app will be compiled into `./dist/moo`
