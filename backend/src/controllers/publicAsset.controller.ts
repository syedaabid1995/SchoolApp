import type { Request, Response } from 'express';
import { Readable } from 'stream';
import { getObjectForKey } from '../services/s3.service';
import {
  BRANDING_ASSET_MIME_TYPES,
  isSafeBrandingAssetKey,
} from '../utils/brandingAssets';

export const getPublicBrandingAsset = async (req: Request, res: Response) => {
  const key = typeof req.query.key === 'string' ? req.query.key : '';
  if (!isSafeBrandingAssetKey(key)) {
    res.status(400).json({ error: { message: 'Invalid asset key', details: null } });
    return;
  }

  try {
    const object = await getObjectForKey({ key });
    const contentType = object.contentType ?? 'application/octet-stream';
    if (!(BRANDING_ASSET_MIME_TYPES as readonly string[]).includes(contentType)) {
      res.status(415).json({ error: { message: 'Unsupported branding asset type', details: null } });
      return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', object.cacheControl ?? 'public, max-age=86400, immutable');
    if (object.contentLength) {
      res.setHeader('Content-Length', String(object.contentLength));
    }

    const body = object.body;
    if (!body) {
      res.status(404).json({ error: { message: 'Asset not found', details: null } });
      return;
    }

    if (body instanceof Readable) {
      body.pipe(res);
      return;
    }

    if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
      const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
      res.send(Buffer.from(bytes));
      return;
    }

    res.status(500).json({ error: { message: 'Unsupported asset stream', details: null } });
  } catch {
    res.status(404).json({ error: { message: 'Asset not found', details: null } });
  }
};
