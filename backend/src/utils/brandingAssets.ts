export const BRANDING_ASSET_TYPES = [
  'logo',
  'compactLogo',
  'darkLogo',
  'favicon',
  'background',
  'illustration',
] as const;

export type BrandingAssetType = (typeof BRANDING_ASSET_TYPES)[number];

export const BRANDING_ASSET_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type BrandingAssetMimeType = (typeof BRANDING_ASSET_MIME_TYPES)[number];

export const BRANDING_ASSET_LIMITS: Record<
  BrandingAssetType,
  { maxBytes: number; minWidth: number; minHeight: number; maxWidth: number; maxHeight: number }
> = {
  logo: { maxBytes: 1 * 1024 * 1024, minWidth: 32, minHeight: 32, maxWidth: 1600, maxHeight: 1600 },
  compactLogo: { maxBytes: 1 * 1024 * 1024, minWidth: 32, minHeight: 32, maxWidth: 1200, maxHeight: 1200 },
  darkLogo: { maxBytes: 1 * 1024 * 1024, minWidth: 32, minHeight: 32, maxWidth: 1600, maxHeight: 1600 },
  favicon: { maxBytes: 512 * 1024, minWidth: 16, minHeight: 16, maxWidth: 512, maxHeight: 512 },
  background: { maxBytes: 3 * 1024 * 1024, minWidth: 320, minHeight: 160, maxWidth: 3840, maxHeight: 2160 },
  illustration: { maxBytes: 2 * 1024 * 1024, minWidth: 120, minHeight: 120, maxWidth: 2400, maxHeight: 2400 },
};

const EXTENSION_BY_MIME: Record<BrandingAssetMimeType, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const SIGNATURES: Record<BrandingAssetMimeType, (buffer: Buffer) => boolean> = {
  'image/png': (buffer) =>
    buffer.length > 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a,
  'image/jpeg': (buffer) => buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/webp': (buffer) =>
    buffer.length > 30 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP',
};

export const isBrandingAssetType = (value: unknown): value is BrandingAssetType =>
  typeof value === 'string' && (BRANDING_ASSET_TYPES as readonly string[]).includes(value);

export const isBrandingMimeType = (value: unknown): value is BrandingAssetMimeType =>
  typeof value === 'string' && (BRANDING_ASSET_MIME_TYPES as readonly string[]).includes(value);

export const extensionForBrandingMimeType = (mimeType: BrandingAssetMimeType) => EXTENSION_BY_MIME[mimeType];

export const isSafeBrandingAssetKey = (key: string) => {
  if (!key || key.length > 512) return false;
  if (!key.startsWith('branding/')) return false;
  if (key.startsWith('/') || key.includes('\\')) return false;
  if (key.split('/').some((part) => part === '..' || part === '')) return false;
  return /^[a-zA-Z0-9/_.,=@-]+$/.test(key);
};

export const brandingAssetProxyUrl = (key: string) =>
  `/api/proxy/public/assets/branding?key=${encodeURIComponent(key)}`;

export const isBrandingAssetProxyUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const directPrefix = '/api/v1/public/assets/branding?';
  const proxyPrefix = '/api/proxy/public/assets/branding?';
  if (!trimmed.startsWith(directPrefix) && !trimmed.startsWith(proxyPrefix)) return false;

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    const key = parsed.searchParams.get('key');
    return Boolean(key && isSafeBrandingAssetKey(key));
  } catch {
    return false;
  }
};

export const readImageDimensions = (buffer: Buffer, mimeType: BrandingAssetMimeType) => {
  if (mimeType === 'image/png') {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const blockLength = buffer.readUInt16BE(offset + 2);
      const isStartOfFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isStartOfFrame) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + blockLength;
    }
    return null;
  }

  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType === 'VP8X' && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }

  if (chunkType === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === 'VP8L' && buffer.length >= 25) {
    const b1 = buffer[21];
    const b2 = buffer[22];
    const b3 = buffer[23];
    const b4 = buffer[24];
    return {
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    };
  }

  return null;
};

export const validateBrandingImage = (
  buffer: Buffer,
  mimeType: BrandingAssetMimeType,
  assetType: BrandingAssetType,
) => {
  const limit = BRANDING_ASSET_LIMITS[assetType];
  if (buffer.length > limit.maxBytes) {
    return {
      valid: false,
      message: `${assetType} must be ${Math.floor(limit.maxBytes / 1024 / 1024) || '0.5'} MB or smaller.`,
    };
  }

  if (!SIGNATURES[mimeType](buffer)) {
    return { valid: false, message: 'Uploaded file content does not match the selected image type.' };
  }

  const dimensions = readImageDimensions(buffer, mimeType);
  if (!dimensions) {
    return { valid: false, message: 'Unable to read image dimensions.' };
  }

  if (
    dimensions.width < limit.minWidth ||
    dimensions.height < limit.minHeight ||
    dimensions.width > limit.maxWidth ||
    dimensions.height > limit.maxHeight
  ) {
    return {
      valid: false,
      message: `${assetType} image must be between ${limit.minWidth}x${limit.minHeight} and ${limit.maxWidth}x${limit.maxHeight}px.`,
    };
  }

  return { valid: true, dimensions };
};
