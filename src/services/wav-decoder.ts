/**
 * Basic WAV header parser. Returns sample rate, bit depth, channels, and PCM data offset.
 * Used for informational purposes; actual decoding uses Web Audio API.
 */
export interface WavInfo {
  sampleRate: number;
  bitDepth: number;
  channels: number;
  dataOffset: number;
  dataSize: number;
}

export function parseWavHeader(buffer: ArrayBuffer): WavInfo | null {
  const view = new DataView(buffer);

  // Check RIFF header
  if (readString(view, 0, 4) !== 'RIFF') return null;
  if (readString(view, 8, 4) !== 'WAVE') return null;

  let offset = 12;
  let fmtFound = false;
  let sampleRate = 0;
  let bitDepth = 0;
  let channels = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset < buffer.byteLength - 8) {
    const chunkId = readString(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitDepth = view.getUint16(offset + 22, true);
      fmtFound = true;
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
    // Chunks are padded to even byte boundaries
    if (chunkSize % 2 !== 0) offset++;
  }

  if (!fmtFound || dataOffset === 0) return null;

  return { sampleRate, bitDepth, channels, dataOffset, dataSize };
}

function readString(view: DataView, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(view.getUint8(offset + i));
  }
  return str;
}
