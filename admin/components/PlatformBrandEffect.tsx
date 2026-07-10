'use client';

import { useEffect } from 'react';
import { getCurrentPlatformBrand } from '../lib/platform-brand';

const upsertMeta = (selector: string, create: () => HTMLMetaElement, content: string) => {
  let meta = document.head.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = create();
    document.head.appendChild(meta);
  }
  meta.content = content;
};

const upsertIcon = (rel: string, href: string, type?: string) => {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
  if (type) link.type = type;
};

export function PlatformBrandEffect() {
  useEffect(() => {
    const brand = getCurrentPlatformBrand();
    document.title = brand.title;

    upsertMeta(
      "meta[name='application-name']",
      () => {
        const meta = document.createElement('meta');
        meta.name = 'application-name';
        return meta;
      },
      brand.appName,
    );
    upsertMeta(
      "meta[name='apple-mobile-web-app-title']",
      () => {
        const meta = document.createElement('meta');
        meta.name = 'apple-mobile-web-app-title';
        return meta;
      },
      brand.appName,
    );

    const iconType = brand.faviconUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    upsertIcon('icon', brand.faviconUrl, iconType);
    upsertIcon('shortcut icon', brand.faviconUrl, iconType);
    upsertIcon('apple-touch-icon', brand.faviconUrl);
  }, []);

  return null;
}
