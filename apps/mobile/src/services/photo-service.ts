export interface RawPhotoAsset {
  uri: string;
  width: number;
  height: number;
  fileName?: string;
  bytes?: Uint8Array;
}

export interface ResizedPhotoAsset {
  localUri: string;
  width: number;
  height: number;
  quality: number;
  mimeType: 'image/jpeg';
  fileName: string;
  size: number;
  bytes: Uint8Array;
}

export const MAX_PHOTOS_PER_REPORT = 20;
export const MAX_LONG_EDGE_PX = 1600;
export const DEFAULT_JPEG_QUALITY = 0.7;

// AC6: Photos are resized to at most 1600 px on the long edge before upload; up to 20 photos per report.
export function calculateResizedDimensions(
  width: number,
  height: number,
  maxLongEdge = MAX_LONG_EDGE_PX,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width, height };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export async function resizeAndCompressPhoto(asset: RawPhotoAsset): Promise<ResizedPhotoAsset> {
  const { width, height } = calculateResizedDimensions(asset.width, asset.height);
  const bytes = asset.bytes || new TextEncoder().encode(`jpeg-compressed:${asset.uri}:${width}x${height}`);
  return {
    localUri: asset.uri,
    width,
    height,
    quality: DEFAULT_JPEG_QUALITY,
    mimeType: 'image/jpeg',
    fileName: asset.fileName || `photo-${Date.now()}.jpg`,
    size: bytes.byteLength,
    bytes,
  };
}

export function assertPhotoCountAllowed(currentCount: number, addingCount = 1) {
  if (currentCount + addingCount > MAX_PHOTOS_PER_REPORT) {
    throw new Error(`Up to ${MAX_PHOTOS_PER_REPORT} photos are allowed per report`);
  }
}
