# Flow v2

Flow v2 is a custom Adobe After Effects CEP extension for editing animation curves, applying easing, managing curve presets, and running common motion-design utilities from one compact panel.

The extension combines a visual curve editor with a lightweight Motion Tools workspace and extensive appearance controls. It is designed for animators who want direct control over easing without repeatedly switching between panels.

## Features

### Curve editor

- Seven curve modes: Bezier, 4-Key, Custom, Elastic, Bounce, Wave, and Step
- Interactive handles with click-to-move behavior and Shift snapping
- Value and speed graph views
- Read easing values from selected keyframes
- Separate resizable graph editor window
- Movement preview before applying a curve
- Expression mode for expression-based workflows

### Presets and libraries

- Save custom graph presets
- Create and manage multiple preset libraries
- Import and export libraries
- Built-in easing preset collection

### Motion Tools

- Nine-position anchor point control
- Pre-compose and unprecompose selected layers
- Sequence, align, and randomize selected layers with adjustable offset and step values
- Select shape fills, strokes, and paths
- Create connected null objects and color-configurable solid layers
- Quick actions for adjustment layers, cameras, effects, mirroring, fitting, freezing, and other common operations

### Customization

- Interface, graph line, handle, node, and home-indicator colors
- Two-color extension background gradient with direction and intensity controls
- Image, GIF, and video graph backgrounds with opacity and original-color controls
- Built-in and custom PNG/GIF handle styles
- Adjustable handle size and handle-line thickness
- Snow, rain, glowing-particle, and grain effects
- English, Mandarin, and Thai interface languages
- Custom profile image, display name, and bio

## Requirements

- Adobe After Effects 17.5 or later
- CEP/CSXS 6.0 or later
- Windows 10 or 11 for the included installer scripts

The extension manifest currently accepts After Effects versions from 17.5 through 99.9.

## Installation

### Windows installer

1. Download and extract the repository or release archive.
2. Open the `scripts` directory.
3. Run `install.bat`.
4. Restart After Effects.
5. Open **Window > Extensions (Legacy) > Flow**.

The installer copies the extension to:

```text
%APPDATA%\Adobe\CEP\extensions\com.rendertom.flow.v2
```

### Manual installation

Copy the complete `flow-v2` directory to the appropriate CEP extensions directory:

```text
Windows: %APPDATA%\Adobe\CEP\extensions\com.rendertom.flow.v2
macOS:   ~/Library/Application Support/Adobe/CEP/extensions/com.rendertom.flow.v2
```

Restart After Effects after copying the files. Unsigned development builds may require CEP debug mode to be enabled on the computer.

## Uninstallation

On Windows, run:

```text
scripts\uninstall.bat
```

For a manual installation, close After Effects and remove the installed extension directory.

## Basic usage

1. Select two or more keyframes in an active composition.
2. Choose a curve mode or preset.
3. Adjust the graph handles or enter exact values.
4. Use the direction controls to choose Ease In, Ease Out, or both.
5. Select **Apply**.

Use the book button in the preset toolbar to switch between graph presets and the integrated Motion Tools controls.

## Graph background media

Graph backgrounds support images, GIFs, and browser-compatible video. Video decoding is handled by the Chromium version bundled with After Effects, so compatibility can vary between releases.

For reliable video playback, use:

- MP4 with H.264 video
- 8-bit `yuv420p` color format
- A constant frame rate
- No HDR metadata
- A moderate resolution and bitrate

HEVC/H.265, AV1, 10-bit video, and unusually large files may fail to load in older CEP runtimes even when the file uses an `.mp4` extension.

## Troubleshooting

### The panel fails to load

- Confirm that the entire extension directory was copied, including `CSXS/manifest.xml` and the `panel` directory.
- Restart After Effects after installation.
- Confirm that the installed folder is named `com.rendertom.flow.v2` when using the included installer layout.
- Enable CEP debug mode if you are running an unsigned development build.

### A tool does nothing

- Make sure a composition is active.
- Select the layers, properties, or keyframes required by the tool.
- Check whether the operation is supported by the selected property type.

### A graph background video does not play

Transcode the file to H.264 MP4 with 8-bit `yuv420p` output and reduce its bitrate or resolution. The container format alone does not guarantee that CEP can decode the video stream.

## Development

Flow v2 is a legacy CEP extension built with HTML, CSS, JavaScript, and ExtendScript.

```text
flow-v2/
|-- CSXS/          Extension manifest
|-- panel/         Main panel, settings, graph editor, scripts, and styles
|-- preferences/   Legacy preferences dialog
|-- dialog/        About window
|-- custom/        Custom dialog content
|-- scripts/       Windows installer and uninstaller
`-- node_modules/  Bundled runtime dependencies
```

Install JavaScript dependencies when working from a clean clone:

```bash
npm install
```

There is no compilation step for the panel. After making changes, refresh the extension or restart After Effects.

## Credits

Flow v2 is an unofficial custom project maintained by leylin. It is based on and adapted from Flow v1.5.2 and NeuCurve, with additional workflow concepts inspired by Motion Tools and PrimeTools.

This project is not affiliated with Adobe or the original commercial extension publishers. Adobe and After Effects are trademarks of Adobe Inc.

## Contact

- Discord: `leylinnnn`
- Telegram: `@leylinvfx`

## License

No project license is currently included in this repository. Unless a license is added, the source code is not automatically granted an open-source license. Third-party code and dependencies remain subject to their respective licenses.
