/* gifdecoder.js — minimal GIF89a frame decoder.

   Why this exists: drawImage() on an animated <img> returns frame 0, not the
   frame currently displayed, so canvas capture cannot freeze a GIF in place.
   ImageDecoder would solve it but requires a secure context, which file://
   is not — and this app ships as a downloadable zip. So we parse the frames
   ourselves.

   Only used for GIFs the user actually pauses or opens in the zoom view.
   Normal grid playback stays as a plain <img>, so bulk performance is
   unaffected.

   Exposes window.AGV.gif.decode(arrayBuffer) -> { width, height, frames }
   where each frame is { bitmap: ImageData, delay: ms }. Frames are composited
   with disposal handling, so each one is a complete image. */

window.AGV = window.AGV || {};

AGV.gif = (function () {
  'use strict';

  var MAX_FRAMES = 2000;

  function decode(buffer) {
    var b = new Uint8Array(buffer);
    var p = 0;

    function byte() { return b[p++]; }
    function short() { var v = b[p] | (b[p + 1] << 8); p += 2; return v; }

    /* --- header --- */
    var sig = String.fromCharCode(b[0], b[1], b[2], b[3], b[4], b[5]);
    if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('not a GIF');
    p = 6;

    var width = short();
    var height = short();
    var packed = byte();
    var bgIndex = byte();
    p++;                                   /* pixel aspect ratio */

    /* Guard against garbage dimensions in a corrupt file — without this a bad
       header sends us straight into a multi-gigabyte allocation. */
    if (!width || !height || width > 8192 || height > 8192) {
      throw new Error('implausible dimensions ' + width + 'x' + height);
    }

    var globalTable = null;
    if (packed & 0x80) {
      globalTable = readColorTable(b, p, 2 << (packed & 7));
      p += (2 << (packed & 7)) * 3;
    }

    /* --- canvas state for compositing --- */
    var canvas = new Uint8ClampedArray(width * height * 4);   /* RGBA */
    var frames = [];
    var gce = { delay: 10, transparent: -1, disposal: 0 };
    var prev = null;

    while (p < b.length) {
      var block = byte();

      if (block === 0x3B) break;                       /* trailer */

      if (block === 0x21) {                            /* extension */
        var label = byte();
        if (label === 0xF9) {                          /* graphic control */
          byte();                                      /* block size (4) */
          var flags = byte();
          gce.disposal = (flags >> 2) & 7;
          gce.transparent = (flags & 1) ? -1 : -2;     /* resolved below */
          gce.delay = short() * 10;                    /* centiseconds -> ms */
          var tIndex = byte();
          gce.transparent = (flags & 1) ? tIndex : -1;
          byte();                                      /* terminator */
        } else {
          p = skipSubBlocks(b, p);       /* application/comment/plain-text */
        }
        continue;
      }

      if (block !== 0x2C) {                            /* image descriptor */
        /* Unknown block — bail rather than desync. */
        break;
      }

      var ix = short(), iy = short(), iw = short(), ih = short();
      var ipacked = byte();
      var localTable = null;
      if (ipacked & 0x80) {
        localTable = readColorTable(b, p, 2 << (ipacked & 7));
        p += (2 << (ipacked & 7)) * 3;
      }
      var interlaced = !!(ipacked & 0x40);
      var table = localTable || globalTable;

      var minCodeSize = byte();
      var data = collectSubBlocks(b, p);
      p = data.next;

      var indices = lzwDecode(data.bytes, minCodeSize, iw * ih);
      if (interlaced) indices = deinterlace(indices, iw, ih);

      /* Save what the next disposal may need to restore. */
      if (gce.disposal === 3) prev = canvas.slice(0);

      /* Composite this frame's pixels onto the running canvas. */
      for (var row = 0; row < ih; row++) {
        var ty = iy + row;
        if (ty >= height) break;
        for (var col = 0; col < iw; col++) {
          var tx = ix + col;
          if (tx >= width) continue;
          var idx = indices[row * iw + col];
          if (idx === gce.transparent) continue;       /* leave what's under */
          var c = idx * 3;
          var o = (ty * width + tx) * 4;
          canvas[o]     = table[c];
          canvas[o + 1] = table[c + 1];
          canvas[o + 2] = table[c + 2];
          canvas[o + 3] = 255;
        }
      }

      frames.push({
        bitmap: new ImageData(new Uint8ClampedArray(canvas), width, height),
        /* Browsers clamp 0ms/10ms delays to 100ms; match that so playback
           speed looks the same as the native <img> rendering. */
        delay: gce.delay <= 10 ? 100 : gce.delay
      });

      /* A full-frame bitmap per frame is width*height*4 bytes, so an absurd
         frame count in a malformed file would exhaust memory. */
      if (frames.length > MAX_FRAMES) break;

      /* Apply disposal for the *next* frame. */
      if (gce.disposal === 2) {                        /* restore to background */
        for (var ry = iy; ry < iy + ih && ry < height; ry++) {
          for (var rx = ix; rx < ix + iw && rx < width; rx++) {
            var ro = (ry * width + rx) * 4;
            canvas[ro] = canvas[ro + 1] = canvas[ro + 2] = canvas[ro + 3] = 0;
          }
        }
      } else if (gce.disposal === 3 && prev) {         /* restore to previous */
        canvas.set(prev);
      }

      gce = { delay: 10, transparent: -1, disposal: 0 };
    }

    if (!frames.length) throw new Error('no frames');
    return { width: width, height: height, frames: frames };
  }

  function readColorTable(b, offset, count) {
    return b.subarray(offset, offset + count * 3);
  }

  function skipSubBlocks(b, p) {
    var size;
    while ((size = b[p++]) !== 0) p += size;
    return p;
  }

  function collectSubBlocks(b, p) {
    var chunks = [], total = 0, size;
    while ((size = b[p++]) !== 0) {
      chunks.push(b.subarray(p, p + size));
      total += size;
      p += size;
    }
    var out = new Uint8Array(total), o = 0;
    for (var i = 0; i < chunks.length; i++) { out.set(chunks[i], o); o += chunks[i].length; }
    return { bytes: out, next: p };
  }

  /* Standard GIF LZW decompression. */
  function lzwDecode(data, minCodeSize, pixelCount) {
    var clearCode = 1 << minCodeSize;
    var eoiCode = clearCode + 1;
    var codeSize = minCodeSize + 1;
    var mask = (1 << codeSize) - 1;

    var dict = [];
    function resetDict() {
      dict.length = 0;
      for (var i = 0; i < clearCode; i++) dict.push([i]);
      dict.push([]);   /* clear */
      dict.push([]);   /* eoi */
      codeSize = minCodeSize + 1;
      mask = (1 << codeSize) - 1;
    }
    resetDict();

    var out = new Uint8Array(pixelCount);
    var oi = 0;
    var bitPos = 0;
    var prevCode = null;

    while (oi < pixelCount) {
      var bytePos = bitPos >> 3;
      if (bytePos >= data.length) break;
      var chunk = data[bytePos] | (data[bytePos + 1] << 8) | (data[bytePos + 2] << 16);
      var code = (chunk >> (bitPos & 7)) & mask;
      bitPos += codeSize;

      if (code === clearCode) { resetDict(); prevCode = null; continue; }
      if (code === eoiCode) break;

      var entry;
      if (code < dict.length && dict[code].length) {
        entry = dict[code];
      } else if (code === dict.length && prevCode !== null) {
        entry = dict[prevCode].concat(dict[prevCode][0]);
      } else {
        break;   /* corrupt stream — keep what we decoded */
      }

      for (var k = 0; k < entry.length && oi < pixelCount; k++) out[oi++] = entry[k];

      if (prevCode !== null && dict.length < 4096) {
        dict.push(dict[prevCode].concat(entry[0]));
        if (dict.length - 1 === mask && codeSize < 12) {
          codeSize++;
          mask = (1 << codeSize) - 1;
        }
      }
      prevCode = code;
    }
    return out;
  }

  function deinterlace(src, w, h) {
    var out = new Uint8Array(src.length);
    var offsets = [0, 4, 2, 1], steps = [8, 8, 4, 2];
    var row = 0;
    for (var pass = 0; pass < 4; pass++) {
      for (var y = offsets[pass]; y < h; y += steps[pass]) {
        out.set(src.subarray(row * w, row * w + w), y * w);
        row++;
      }
    }
    return out;
  }

  return { decode: decode };
})();
