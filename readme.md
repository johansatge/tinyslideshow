# Tiny Slideshow

A local photo and video slideshow for desktop and mobile browsers.

## Requirements

- Node.js 22 or newer
- [FFmpeg](https://ffmpeg.org/download.html), installed and available as `ffmpeg` in `PATH`. The application exits if FFmpeg is unavailable.

Install the command from this directory with `npm install --global .`.

## Usage

```bash
tinyslideshow [folder] [port]
tinyslideshow [folder] --static [--overwrite]
```

The default folder is the current directory and the default port is `9080`. The server listens on the local network. Refresh the page to pick up new or removed files. Stop the server with Ctrl+C.

Static mode creates `tinyslideshow.html` in the chosen folder. Copy this file, the `tinyslideshow` directory and the media files together, preserving their relative locations. Opening local HTML and media files depends on the browser and file manager; some mobile browsers may restrict access to neighboring files. Generate the page again after changing the media. Existing HTML requires confirmation, or `--overwrite` for non-interactive use.

The application generates cached JPEG thumbnails with FFmpeg in the `tinyslideshow` directory. It reuses them until the source file changes and removes obsolete cached thumbnails when the media list is refreshed. If an individual thumbnail cannot be generated, the original image or a video icon is used instead.

JPEG, PNG, WebP, GIF, MP4 and WebM files in the selected folder are sorted by name. Playback depends on browser support for the media codecs. Use the arrow keys to navigate, Space to play or pause, and Escape to close the viewer. Swipe or drag horizontally to navigate. The slideshow stops at the last item; videos play muted until they end when automatic playback is active.

Pinch or double-tap a photo to zoom; on desktop, double-click to zoom. Drag a zoomed photo to explore it. Zooming pauses the slideshow, and returning to the original size restores swipe navigation.
