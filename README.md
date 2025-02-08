> [!IMPORTANT]
> Wip, not working atm.

<div align="center">

<h1>Moo</h1>
<b>Sick terminal music player </b>
</br>

</div>

## Features
- Create smart playlists with a simple config (including autocompletion!)
  - Easy to back up. It's just simple `.yml` files
- Easy to use. Nice flexible runner a la VS Code.
  - No need to remember every shortcut. Just type the first letters of what you want
- Simple Json5 config with out-of-the-box LSP support via JSON schema :)
- Customize it to your liking. (Chorded) keybindings, icons and more
  - Custom layouts, colors will get added in the future



## Install


### Requirements
- [mpv](https://mpv.io/)
- [Bun](https://bun.sh/)
- Terminal with Nerdfonts support like [Kitty](https://github.com/kovidgoyal/kitty) and [Ghostty](https://ghostty.org/) or use a [patched font](https://github.com/ryanoasis/nerd-fonts). 
 
  You can also change all Nerdfont icons to regular letters in the config though.

### Steps

In the future executables will be provided.

For now:
- Install the required depedencies (mpv and Bun)
- Clone the repo
- `cd` into it
- Install dependencies via:
  ```bash
  bun install
  ```
- To run:
  ```bash
  bun prod # or bun dev for dev 
  ```

