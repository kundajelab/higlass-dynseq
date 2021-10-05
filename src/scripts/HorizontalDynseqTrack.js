// Higher value = more memory and slightly worse startup performance
// However, this yields clearer characters, especially when stretched
const LARGE_FONT_SIZE = 200;

export default function HDT(HGC, ...args) {
  if (!(this instanceof HDT)) {
    throw new TypeError('Class constructor cannot be invoked without "new"');
  }

  class HorizontalDynseqTrack extends HGC.tracks.HorizontalTiled1DPixiTrack {
    constructor(context, options) {
      super(context, options);
      this.updateOptions(options);
    }
    stopHover() {
      this.pMouseOver.clear();
      this.animate();
    }

    getMouseOverHtml(trackX) {
      return ``;
    }

    // Convert multi-tileset result to data-only
    makeDataOnlyTile(tile) {
      return {
        ...tile,
        tileData: tile.tileData.length ? tile.tileData[0] : tile.tileData
      };
    }

    /**
     * Create whatever is needed to draw this tile.
     */
    initTile(tile) {
      super.initTile(this.makeDataOnlyTile(tile));
      tile.seqContainer = new HGC.libraries.PIXI.Container();
      tile.lineGraphics = new HGC.libraries.PIXI.Graphics();
      tile.graphics.addChild(tile.seqContainer);
      tile.graphics.addChild(tile.lineGraphics);
      this.drawTile(tile);
    }

    // minVisibleValue and maxVisibleValue rewritten with makeDataOnlyTile

    /**
     * Returns the minimum in the visible area (not visible tiles)
     */
    minVisibleValue(ignoreFixedScale = false) {
      let visibleAndFetchedIds = this.visibleAndFetchedIds();

      if (visibleAndFetchedIds.length === 0) {
        visibleAndFetchedIds = Object.keys(this.fetchedTiles);
      }

      const minimumsPerTile = visibleAndFetchedIds
        .map((x) => this.makeDataOnlyTile(this.fetchedTiles[x]))
        .map((tile) => {
          const ind = this.getIndicesOfVisibleDataInTile(tile);
          return tile.tileData.denseDataExtrema.getMinNonZeroInSubset(ind);
        });

      const min = Math.min(...minimumsPerTile);

      if (ignoreFixedScale) return min;

      return this.valueScaleMin !== null ? this.valueScaleMin : min;
    }

    /**
     * Returns the maximum in the visible area (not visible tiles)
     */
    maxVisibleValue(ignoreFixedScale = false) {
      let visibleAndFetchedIds = this.visibleAndFetchedIds();

      if (visibleAndFetchedIds.length === 0) {
        visibleAndFetchedIds = Object.keys(this.fetchedTiles);
      }

      const maximumsPerTile = visibleAndFetchedIds
        .map((x) => this.makeDataOnlyTile(this.fetchedTiles[x]))
        .map((tile) => {
          const ind = this.getIndicesOfVisibleDataInTile(tile);
          return tile.tileData.denseDataExtrema.getMaxNonZeroInSubset(ind);
        });

      const max = Math.max(...maximumsPerTile);

      if (ignoreFixedScale) return max;

      return this.valueScaleMax !== null ? this.valueScaleMax : max;
    }

    updateOptions(newOptions) {
      this.options = newOptions;
      const textOptions = {
        fontSize: `${LARGE_FONT_SIZE}px`, // Higher res raster
        fontFamily: newOptions.fontFamily || 'Arial',
        fontWeight: 'bold'
      };
      const fontColors = newOptions.fontColors || {
        A: 'rgb(137, 199, 56)',
        T: 'rgb(146, 56, 199)',
        C: 'rgb(224, 81, 68)',
        G: 'rgb(56, 153, 199)',
        N: 'rgb(133, 133, 133)'
      };
      this.textOptions = textOptions;
      this.fontColors = fontColors;

      this.maxCharWidth = 0;
      this.maxStandardCharWidth = 0;
      this.chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(char => {
        const text = new HGC.libraries.PIXI.Text(char, {
          ...textOptions,
          fill: HGC.utils.colorToHex(fontColors[char] || newOptions.defaultFontColor || '#ffb347'),
          trim: true
        });
        // NOTE: text.getBounds() has the important side-effect of pre-rendering
        // the Pixi texture ("filling" the actual texture object)
        // Do not remove text.getBounds()!
        const charWidth = text.getBounds().width;
        this.maxCharWidth = Math.max(this.maxCharWidth, charWidth);
        if ('ATCGN'.includes(char)) {
          this.maxStandardCharWidth = Math.max(this.maxStandardCharWidth, charWidth);
        }
        return text.texture;
      });
    }

    drawTile(tile) {
      super.drawTile(tile);
      if (!tile.lineGraphics || !tile.seqContainer || !tile.tileData || tile.tileData.length !== 2) {
        return;
      }

      const lineGraphics = tile.lineGraphics;
      const seqContainer = tile.seqContainer;

      const { tileX, tileWidth } = this.getTilePosAndDimensions(
        tile.tileData[0].zoomLevel,
        tile.tileData[0].tilePos,
      );

      const data = tile.tileData[0].dense;
      const sequence = tile.tileData[1] && tile.tileData[1].sequence
      const [vs, offsetValue] = this.makeValueScale(
        this.minValue(),
        this.medianVisibleValue,
        this.maxValue(),
      );

      this.valueScale = vs;

      tile.path = '';
      lineGraphics.clear();
      seqContainer.removeChildren();

      this.drawAxis(this.valueScale);

      if (
        this.options.valueScaling === 'log' &&
        this.valueScale.domain()[1] < 0
      ) {
        console.warn(
          'Negative values present when using a log scale',
          this.valueScale.domain(),
        );
        return;
      }

      const dlen = sequence ? sequence.length : data.length;

      const tileXScale = HGC.libraries.d3Scale.scaleLinear()
        .domain([0, dlen])
        .range([tileX, tileX + tileWidth]);
      const width = (this._xScale(tileX + tileWidth) - this._xScale(tileX)) / dlen;
      const middle = this.valueScale(offsetValue);
      const maxFontSize = this.options.maxFontSize || (this.dimensions[1] / 2);
      const minFontSize = this.options.minFontSize || 2;
      const fadeOutFontSize = Math.max(this.options.fadeOutFontSize || 8, minFontSize + 0.01);
      const scaleChange = Math.min(
        width / (this.options.nonStandardSequence ? this.maxCharWidth : this.maxStandardCharWidth),
        maxFontSize / LARGE_FONT_SIZE
      );
      const simFontSize = scaleChange * LARGE_FONT_SIZE;

      if (!sequence || simFontSize < minFontSize) {
        seqContainer.alpha = 0;
        lineGraphics.alpha = 1;
      } else if (simFontSize < fadeOutFontSize) {
        seqContainer.alpha = (simFontSize - minFontSize) / (fadeOutFontSize - minFontSize);
        lineGraphics.alpha = 1 - seqContainer.alpha;
      } else {
        seqContainer.alpha = 1;
        lineGraphics.alpha = 0;
      }
      if (seqContainer.alpha) {
        for (let i = 0; i < sequence.length; i++) {
          const charInd = (sequence.charCodeAt(i) & 95) - 65;
          const dataLoc = i / sequence.length * data.length;
          const dataInd = Math.floor(dataLoc);
          const nextDataInd = dataInd + 1;
          // Linear interpolation between values
          const dataValue = 
            (dataLoc - dataInd) * (data[dataInd] || 0) +
            (nextDataInd - dataLoc) * (data[nextDataInd] || 0);
          const sprite = new HGC.libraries.PIXI.Sprite(this.chars[charInd]);

          const xPos = this._xScale(tileXScale(i)) + width;
          const yPos = this.valueScale(dataValue + offsetValue);
          if (tileXScale(i) > this.tilesetInfo.max_pos[0]) {
            // Data is in the last tile and extends beyond the coordinate system.
            break;
          }
          // No need to render anything for 0 or NaN
          if (!dataValue) {
            continue; 
          }
          sprite.position.x = xPos;
          sprite.position.y = middle;
          sprite.scale.set(scaleChange, (middle - yPos) / sprite.height);
          // sprite.anchor.set(0, 1);
          sprite.anchor.set(0.5, 1);
          sprite.letter = String.fromCharCode(sequence.charCodeAt(i));

          seqContainer.addChild(sprite);
          // graphics.lineStyle(1, 0x000000)[i ? 'lineTo' : 'moveTo'](xPos, this.valueScale(dataValue + offsetValue));
        }
      }
      if (lineGraphics.alpha) {
        const strokeColor = HGC.utils.colorToHex(
          this.options.lineStrokeColor ? this.options.lineStrokeColor : 'blue',
        );
        const strokeWidth = this.options.lineStrokeWidth
          ? this.options.lineStrokeWidth
          : 1;
        const datXScale = sequence
          ? HGC.libraries.d3Scale.scaleLinear()
            .domain([0, data.length])
            .range([tileX, tileX + tileWidth])
          : tileXScale;
        lineGraphics.lineStyle(strokeWidth, strokeColor);
        for (let i = 0; i < data.length; i++) {
          const xPos = this._xScale(datXScale(i));
          const yPos = this.valueScale(data[i] + offsetValue);
          if (yPos != middle && i) {
            lineGraphics.lineTo(xPos, yPos);
            // We'll store a representation of the line as an SVG path
            // so that we can use it in exportSVG.
            tile.path += `L${xPos},${yPos}`
          } else {
            lineGraphics.moveTo(xPos, yPos);
            tile.path += `M${xPos},${yPos}`
          }
        }
      }
    }

    // Copied from HorizonatalLine1DPixiTrack.js
    // Could be also:
    // setPosition = HGC.tracks.HorizontalLine1DPixiTrack.prototype.setPosition
    setPosition(newPosition) {
      super.setPosition(newPosition);

      this.pMain.position.y = this.position[1];
      this.pMain.position.x = this.position[0];

      this.pMouseOver.position.y = this.position[1];
      this.pMouseOver.position.x = this.position[0];
    }

    refreshTiles() {
      if (!this.tilesetInfo) {
        return;
      }
      const dfc = this.dataFetcher.constructor;
      if (dfc && dfc.config && dfc.config.type == 'multi-tileset') {
        let maxZoom = this.tilesetInfo.max_zoom;
        if (maxZoom === undefined) {
          maxZoom = this.tilesetInfo.resolutions.length;
        }
        this.zoomLevel = this.calculateZoomLevel();

        // At most 2048 characters on screen
        const shouldFetchFasta = maxZoom - this.zoomLevel < 2;
        this.dataFetcher.setFilter(_ => shouldFetchFasta, 1)
      }
      super.refreshTiles();
    }

    // Copied from HorizonatalLine1DPixiTrack.js
    // Could be also:
    // zoomed = HGC.tracks.HorizontalLine1DPixiTrack.prototype.zoomed
    zoomed(newXScale, newYScale) {
      this.xScale(newXScale);
      this.yScale(newYScale);

      this.refreshTiles();

      this.draw();

      const isValueScaleLocked = this.isValueScaleLocked();

      if (
        this.continuousScaling &&
        this.minValue() !== undefined &&
        this.maxValue() !== undefined
      ) {
        if (
          this.valueScaleMin === null &&
          this.valueScaleMax === null &&
          !isValueScaleLocked
        ) {
          const newMin = this.minVisibleValue();
          const newMax = this.maxVisibleValue();

          const epsilon = 1e-6;

          if (
            newMin !== null &&
            newMax !== null &&
            (Math.abs(this.minValue() - newMin) > epsilon ||
              Math.abs(this.maxValue() - newMax) > epsilon)
          ) {
            this.minValue(newMin);
            this.maxValue(newMax);

            this.scheduleRerender();
          }
        }

        if (isValueScaleLocked) {
          this.onValueScaleChanged();
        }
      }
    }

    superSVG() {
      /*
      * Bypass this track's exportSVG and call its parent's directly.
      */
      return super.exportSVG();
    }

    /**
     * Export an SVG representation of this track
     *
     * @returns {Array} The two returned DOM nodes are both SVG
     * elements [base,track]. Base is a parent which contains track as a
     * child. Track is clipped with a clipping rectangle contained in base.
     *
     */
    exportSVG() {
      let track = null;
      let base = null;

      [base, track] = super.exportSVG();

      base.setAttribute('class', 'exported-arcs-track');
      const output = document.createElement('g');

      track.appendChild(output);
      output.setAttribute(
        'transform',
        `translate(${this.position[0]},${this.position[1]})`
      );

      const strokeColor = this.options.lineStrokeColor ? this.options.lineStrokeColor : 'blue';
      const strokeWidth = this.options.lineStrokeWidth ? this.options.lineStrokeWidth : 1;

      this.visibleAndFetchedTiles().forEach((tile) => {
        // First we'll draw the line element.
        const path = document.createElement('path');
        path.setAttribute('d', tile.path)
        path.setAttribute('stroke-width', strokeWidth);
        path.setAttribute('stroke', strokeColor);
        path.setAttribute('fill', 'transparent');
        path.setAttribute('opacity', tile.lineGraphics.alpha);

        output.appendChild(path);

        // Then we'll draw each individual letter
        for (let sprite of tile.seqContainer.children) {
          const letter = sprite.letter;
          const g = document.createElement('g')
          const text = document.createElement('text');

          g.setAttribute(
            'transform',
            `translate(${sprite.position.x},${sprite.position.y})scale(${sprite.scale.x}, ${sprite.scale.y})`
          );
          g.setAttribute('opacity', tile.seqContainer.alpha);
          text.setAttribute('font-family', this.textOptions.fontFamily);
          text.setAttribute('font-weight', this.textOptions.fontWeight);
          text.setAttribute('font-size', this.textOptions.fontSize);

          text.setAttribute('fill', this.fontColors[letter]);
          text.setAttribute('text-anchor', 'middle')
          text.innerText = letter;


          g.appendChild(text);
          output.appendChild(g);
        }
      });
      return [base, track];
    }
  }
  return new HorizontalDynseqTrack(...args);
}

const svgIcon = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="1.5"><path d="M4 2.1L.5 3.5v12l5-2 5 2 5-2v-12l-5 2-3.17-1.268" fill="none" stroke="currentColor"/><path d="M10.5 3.5v12" fill="none" stroke="currentColor" stroke-opacity=".33" stroke-dasharray="1,2,0,0"/><path d="M5.5 13.5V6" fill="none" stroke="currentColor" stroke-opacity=".33" stroke-width=".9969299999999999" stroke-dasharray="1.71,3.43,0,0"/><path d="M9.03 5l.053.003.054.006.054.008.054.012.052.015.052.017.05.02.05.024 4 2 .048.026.048.03.046.03.044.034.042.037.04.04.037.04.036.042.032.045.03.047.028.048.025.05.022.05.02.053.016.053.014.055.01.055.007.055.005.055v.056l-.002.056-.005.055-.008.055-.01.055-.015.054-.017.054-.02.052-.023.05-.026.05-.028.048-.03.046-.035.044-.035.043-.038.04-4 4-.04.037-.04.036-.044.032-.045.03-.046.03-.048.024-.05.023-.05.02-.052.016-.052.015-.053.012-.054.01-.054.005-.055.003H8.97l-.053-.003-.054-.006-.054-.008-.054-.012-.052-.015-.052-.017-.05-.02-.05-.024-4-2-.048-.026-.048-.03-.046-.03-.044-.034-.042-.037-.04-.04-.037-.04-.036-.042-.032-.045-.03-.047-.028-.048-.025-.05-.022-.05-.02-.053-.016-.053-.014-.055-.01-.055-.007-.055L4 10.05v-.056l.002-.056.005-.055.008-.055.01-.055.015-.054.017-.054.02-.052.023-.05.026-.05.028-.048.03-.046.035-.044.035-.043.038-.04 4-4 .04-.037.04-.036.044-.032.045-.03.046-.03.048-.024.05-.023.05-.02.052-.016.052-.015.053-.012.054-.01.054-.005L8.976 5h.054zM5 10l4 2 4-4-4-2-4 4z" fill="currentColor"/><path d="M7.124 0C7.884 0 8.5.616 8.5 1.376v3.748c0 .76-.616 1.376-1.376 1.376H3.876c-.76 0-1.376-.616-1.376-1.376V1.376C2.5.616 3.116 0 3.876 0h3.248zm.56 5.295L5.965 1H5.05L3.375 5.295h.92l.354-.976h1.716l.375.975h.945zm-1.596-1.7l-.592-1.593-.58 1.594h1.172z" fill="currentColor"/></svg>';

HDT.config = {
  type: 'horizontal-dynseq',
  datatype: ['vector'],
  local: false,
  orientation: '1d-horizontal',
  // TODO: better icon
  thumbnail: new DOMParser().parseFromString(svgIcon, 'text/xml').documentElement,
  availableOptions: [
    'fontFamily',
    'fontColors',
    'defaultFontColor',
    'valueScaling',
    'valueScaleMin',
    'valueScaleMax',
    'lineStrokeWidth',
    'lineStrokeColor',
    'minFontSize',
    'maxFontSize',
    'fadeOutFontSize',
    'nonStandardSequence',
    'labelPosition',
    'labelLeftMargin',
    'labelRightMargin',
    'labelTopMargin',
    'labelBottomMargin',
    'labelShowResolution',
    'labelShowAssembly',
    'labelColor',
    'labelTextOpacity',
    'labelBackgroundColor',
    'labelBackgroundOpacity',
    'axisLabelFormatting',
    'axisPositionHorizontal',
    'axisMargin',
    'trackBorderWidth',
    'trackBorderColor',
    'showMousePosition',
    'showTooltip',
    'mousePositionColor',
    'minHeight',
  ],
  defaultOptions: {
    labelColor: 'black',
    labelPosition: 'topLeft',
    labelLeftMargin: 0,
    labelRightMargin: 0,
    labelTopMargin: 0,
    labelBottomMargin: 0,
    labelBackgroundColor: 'white',
    labelShowResolution: false,
    labelShowAssembly: true,
    axisLabelFormatting: 'scientific',
    axisPositionHorizontal: 'right',
    lineStrokeColor: 'blue',
    lineStrokeWidth: 1,
    valueScaling: 'linear',
    trackBorderWidth: 0,
    trackBorderColor: 'black',
    labelTextOpacity: 0.4,
    showMousePosition: false,
    minHeight: 20,
    mousePositionColor: '#000000',
    showTooltip: false,
    /* TODO: include?
    fontFamily: 'Arial',
    fontColors: {
      A: 'rgb(137, 199, 56)',
      T: 'rgb(146, 56, 199)',
      C: 'rgb(224, 81, 68)',
      G: 'rgb(56, 153, 199)',
      N: 'rgb(133, 133, 133)'
    },
    defaultFontColor: '#ffb347'
    */
  }
};
