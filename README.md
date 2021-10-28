# higlass-dynseq
Dynamic sequence track for HiGlass

![](https://user-images.githubusercontent.com/29579245/127757191-244d2d33-e13f-4e30-b80e-f05f70134ba4.png)
## Installation

If you are using NPM:
```sh
npm install higlass-dynseq
```

Then you can load it by adding this import to your JavaScript:

```js
import HorizontalDynseqTrack from 'higlass-dynseq';

// Alternatively, if you don't need access to the component
import 'higlass-dynseq';
```

Otherwise, load `higlass-dynseq` from a CDN. You can use this script tag:

```html
<script src="https://unpkg.com/higlass-dynseq"></script>
<!-- Make sure to load higlass-dynseq before hglib.js -->
<script src="hglib.js"></script>
```

## Usage

The DynSeq track depends on both a data source (e.g. bigWig) and a sequence source (FASTA). You should load them together with [`higlass-multi-tileset`](https://github.com/kundajelab/higlass-multi-tileset) (follow the installation instructions before using it).

```js
{
  // You must use a custom data config
  "data": {
    "type": "multi-tileset",
    "configs": [
      // The first config is the data source
      {
        "server": "http://localhost:8001/api/v1",
        "tilesetUid": "my-bigwig-tileset"
      },
      // The second config is the FASTA sequence source
      {
        "server": "https://my-higlass-server.com/api/v1",
        "tilesetUid": "my-fasta-tileset"
      }
    ]
  },
  "uid": "dynseq-example",
  "type": "horizontal-dynseq",
  // See below for list of options
  "options": {
    ...
  }
}
```

These options are available (beyond the standard ones such as `labelColor` and `minHeight`):

```js
{
  // Style for line when sequence zoomed out
  "lineStrokeColor": "blue",
  "lineStrokeWidth": 1,
  "valueScaling": "linear", // can be "log"
  // The smallest font size where the sequence should be shown
  "minFontSize": 0,
  // When the sequence should start to fade out
  "fadeOutFontSize": 8,
  // Maximum font size to grow to
  "maxFontSize": 40,
  // Set to true if the sequence has more than A, T, C, G, N
  "nonStandardSequence": false,
  "fontFamily": "Arial",
  // Colors for each character (must be uppercase)
  "fontColors": {
    "A": "#89c738",
    "T": "#9238c7",
    "C": "#e05144",
    "G": "#3899c7",
    "N": "#858585"
  },
  // Color for characters not in fontColors
  "defaultFontColor": "#ffb347"
}
```

## Features
The DynSeq track was designed with performance in mind. It only fetches the FASTA sequence when it is visible on screen and takes advantage of HiGlass' tiling system to minimize network requests and latency. Using efficient rendering techniques and debounced, batched updates, the track remains as fast as a standalone line track.

Multiple DynSeq tracks that use the same FASTA sequence but different datasets will remain fast due to the tile cache in HiGlass, which prevents duplicate tile requests, and the efficient Pixi.js-based rendering system, which reuses a high-resolution bitmap of each character to offer smooth, latency-free analysis even on low-end devices.

`higlass-dynseq` includes a configurable automatic hiding feature for the FASTA sequence when there are thousands of characters on screen. As a user zooms out, the sequence will fade out as it is replaced by a colored line, which will more accurately show the data. At low zoom levels, the DynSeq track is similar to the `horizontal-line` track built-in to HiGlass.

## Support
[File an issue](https://github.com/kundajelab/higlass-dynseq/issues) if you have found a bug, would like help resolving a problem, or want to ask a question about using the track.

Alternatively, contact [Arjun Barrett](https://github.com/101arrowz) for more information.
