# Tiny Slideshow

A local photo and video slideshow for desktop and mobile browsers, with:
- Grid view
- Detailed view (photo & video)
- Automatic mode with configurable delay
- Map view for geolocated media

---

- [Requirements](#requirements)
- [Usage](#usage)
  - [Running the tool](#running-the-tool)
  - [Opening a static slideshow on Android with Termux](#opening-a-static-slideshow-on-android-with-termux)
- [Technical details](#technical-details)
- [License](#license)

## Requirements

- Node.js 22 or newer
- [FFmpeg](https://ffmpeg.org/download.html) & [ExifTool](https://exiftool.org/)

```bash
brew install ffmpeg
brew install exiftool
```

## Usage

### Running the tool

Run `tinyslideshow` in a folder with media:

```bash
tinyslideshow [folder] [port]
tinyslideshow [folder] --static [--overwrite]
```

The default folder is the current directory and the default port is `9080`. The server listens on the local network. Refresh the page to pick up new or removed files. Stop the server with Ctrl+C.

Static mode (`--static`) creates `tinyslideshow.html` in the chosen folder. Copy this file, the `tinyslideshow` directory and the media files together, to open the slideshow on a device that doesn't have Node.js. Generate the page again after changing the media. Overwriting existing slideshow requires confirmation, or `--overwrite` for non-interactive use.

### Opening a static slideshow on Android with Termux

1. Install Termux from the Play Store and open it.
2. Install Node.js and [httpdir](https://github.com/johansatge/httpdir):

```bash
pkg install nodejs
npm install -g httpdir
```

3. Grant Termux access to Android shared storage:

```bash
termux-setup-storage
```

4. Navigate to the folder containing `tinyslideshow.html`, the media files and the `tinyslideshow` directory, then start the server:

```bash
cd /storage/emulated/0/path/to/tinyslideshow
httpdir
```

5. Open [http://localhost:8080/tinyslideshow.html](http://localhost:8080/tinyslideshow.html) in the Android browser. Leave Termux running while using the slideshow.

## Technical details

The application generates cached JPEG thumbnails with FFmpeg in the `tinyslideshow` directory. It reuses them until the source file changes and removes obsolete cached thumbnails when the media list is refreshed. If an individual thumbnail cannot be generated, the original image or a video icon is used instead.

GPS metadata is cached in `tinyslideshow/gps.json`, including files without coordinates. Only new or changed files are read again with ExifTool; deleted files are removed from the cache. The cache persists between server runs and static page generations.

JPEG, PNG, WebP, GIF, MP4 and WebM files in the selected folder are sorted by name. Playback depends on browser support for the media codecs. Use the arrow keys to navigate, Space to play or pause, and Escape to close the viewer. Swipe or drag horizontally to navigate. The slideshow stops at the last item; videos play muted until they end when automatic playback is active.

Pinch or double-tap a photo to zoom; on desktop, double-click to zoom. Drag a zoomed photo to explore it. Zooming pauses the slideshow, and returning to the original size restores swipe navigation.

## License

This project is released under the [MIT License](license.md).
