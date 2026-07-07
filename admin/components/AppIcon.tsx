import type { SVGProps } from 'react';

export type AppIconName =
  | 'activity'
  | 'backup'
  | 'ban'
  | 'bed'
  | 'book'
  | 'brand'
  | 'briefcase'
  | 'building'
  | 'bus'
  | 'calendar'
  | 'card'
  | 'chart'
  | 'check'
  | 'checkCircle'
  | 'chevron'
  | 'clipboard'
  | 'clock'
  | 'close'
  | 'file'
  | 'fileText'
  | 'folder'
  | 'graduationCap'
  | 'grid'
  | 'headset'
  | 'history'
  | 'id'
  | 'invoice'
  | 'layoutDashboard'
  | 'list'
  | 'lock'
  | 'mail'
  | 'message'
  | 'monitor'
  | 'package'
  | 'palette'
  | 'percent'
  | 'portal'
  | 'refresh'
  | 'scale'
  | 'school'
  | 'settings'
  | 'shield'
  | 'sparkles'
  | 'tag'
  | 'ticket'
  | 'transfer'
  | 'userCheck'
  | 'userPlus'
  | 'users'
  | 'wallet'
  | 'warning';

type AppIconProps = SVGProps<SVGSVGElement> & {
  name: AppIconName;
  title?: string;
};

export function AppIcon({ name, className = 'h-4 w-4', title, ...props }: AppIconProps) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    role: title ? 'img' : undefined,
    'aria-hidden': title ? undefined : true,
    ...props,
  };

  const titleNode = title ? <title>{title}</title> : null;

  switch (name) {
    case 'activity':
      return <svg {...common}>{titleNode}<path d="M4 13h4l2-7 4 12 2-5h4" /></svg>;
    case 'backup':
      return <svg {...common}>{titleNode}<path d="M7 19h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6 9.5 4.5 4.5 0 0 0 7 19Z" /><path d="M12 13v4" /><path d="m9.5 15.5 2.5 2.5 2.5-2.5" /></svg>;
    case 'ban':
      return <svg {...common}>{titleNode}<circle cx="12" cy="12" r="8" /><path d="m7.5 7.5 9 9" /></svg>;
    case 'bed':
      return <svg {...common}>{titleNode}<path d="M4 20V7" /><path d="M20 20v-5.5A2.5 2.5 0 0 0 17.5 12H4" /><path d="M4 16h16" /><path d="M7 12V9h4v3" /></svg>;
    case 'book':
      return <svg {...common}>{titleNode}<path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 0-3 3v-18Z" /><path d="M5 18.5A3 3 0 0 1 8 16h10" /></svg>;
    case 'brand':
      return <svg {...common}>{titleNode}<path d="M12 3 4.5 7v10L12 21l7.5-4V7L12 3Z" /><path d="M12 8v8" /><path d="m8.5 10 3.5-2 3.5 2" /></svg>;
    case 'briefcase':
      return <svg {...common}>{titleNode}<path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" /><path d="M9 12h6" /></svg>;
    case 'building':
      return <svg {...common}>{titleNode}<path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M3 21h18" /><path d="M9 7h3" /><path d="M9 11h3" /><path d="M9 15h3" /></svg>;
    case 'bus':
      return <svg {...common}>{titleNode}<path d="M6 17h12" /><path d="M7 20a1.5 1.5 0 0 0 3 0" /><path d="M14 20a1.5 1.5 0 0 0 3 0" /><path d="M5 17V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v10" /><path d="M5 9h14" /><path d="M8 13h.01" /><path d="M16 13h.01" /></svg>;
    case 'calendar':
      return <svg {...common}>{titleNode}<path d="M7 3v3" /><path d="M17 3v3" /><path d="M4 8h16" /><path d="M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5Z" /></svg>;
    case 'card':
      return <svg {...common}>{titleNode}<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M4 10h16" /><path d="M7 15h4" /></svg>;
    case 'chart':
      return <svg {...common}>{titleNode}<path d="M5 19V5" /><path d="M5 19h14" /><path d="m8 14 3-3 3 2 4-6" /></svg>;
    case 'check':
      return <svg {...common}>{titleNode}<path d="m5 12 4 4L19 6" /></svg>;
    case 'checkCircle':
      return <svg {...common}>{titleNode}<circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
    case 'chevron':
      return <svg {...common}>{titleNode}<path d="m9 6 6 6-6 6" /></svg>;
    case 'clipboard':
      return <svg {...common}>{titleNode}<path d="M9 5h6" /><path d="M9 3.5h6A1.5 1.5 0 0 1 16.5 5v1A1.5 1.5 0 0 1 15 7.5H9A1.5 1.5 0 0 1 7.5 6V5A1.5 1.5 0 0 1 9 3.5Z" /><path d="M7.5 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.5" /></svg>;
    case 'clock':
      return <svg {...common}>{titleNode}<circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>;
    case 'close':
      return <svg {...common}>{titleNode}<path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>;
    case 'file':
      return <svg {...common}>{titleNode}<path d="M7 3.5h7l4 4V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V8h4" /></svg>;
    case 'fileText':
      return <svg {...common}>{titleNode}<path d="M7 3.5h7l4 4V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V8h4" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>;
    case 'folder':
      return <svg {...common}>{titleNode}<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" /></svg>;
    case 'graduationCap':
      return <svg {...common}>{titleNode}<path d="m3 8.5 9-4 9 4-9 4-9-4Z" /><path d="M7 11v4c2.8 2 7.2 2 10 0v-4" /><path d="M20 9v5" /></svg>;
    case 'grid':
      return <svg {...common}>{titleNode}<path d="M4 4h7v7H4z" /><path d="M13 4h7v7h-7z" /><path d="M4 13h7v7H4z" /><path d="M13 13h7v7h-7z" /></svg>;
    case 'headset':
      return <svg {...common}>{titleNode}<path d="M5 12a7 7 0 0 1 14 0" /><path d="M5 12v3a2 2 0 0 0 2 2h1v-6H7a2 2 0 0 0-2 2Z" /><path d="M19 12v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" /><path d="M12 19h3" /></svg>;
    case 'history':
      return <svg {...common}>{titleNode}<path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 5v5h5" /><path d="M12 8v4l3 2" /></svg>;
    case 'id':
      return <svg {...common}>{titleNode}<path d="M5.5 6h13A1.5 1.5 0 0 1 20 7.5v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9A1.5 1.5 0 0 1 5.5 6Z" /><path d="M8 10h4" /><path d="M8 14h3" /><path d="M15.5 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /></svg>;
    case 'invoice':
      return <svg {...common}>{titleNode}<path d="M7 3.5h10v17l-2-1-2 1-2-1-2 1-2-1-2 1v-15a2 2 0 0 1 2-2Z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></svg>;
    case 'layoutDashboard':
      return <svg {...common}>{titleNode}<path d="M4 4h7v9H4z" /><path d="M13 4h7v5h-7z" /><path d="M13 11h7v9h-7z" /><path d="M4 15h7v5H4z" /></svg>;
    case 'list':
      return <svg {...common}>{titleNode}<path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></svg>;
    case 'lock':
      return <svg {...common}>{titleNode}<path d="M7 10V8a5 5 0 0 1 10 0v2" /><path d="M6.5 10h11A1.5 1.5 0 0 1 19 11.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z" /></svg>;
    case 'mail':
      return <svg {...common}>{titleNode}<path d="M5.5 6h13A1.5 1.5 0 0 1 20 7.5v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9A1.5 1.5 0 0 1 5.5 6Z" /><path d="m5 8 7 5 7-5" /></svg>;
    case 'message':
      return <svg {...common}>{titleNode}<path d="M5 5.5h14v9H8l-3 3v-12Z" /><path d="M8 9h8" /><path d="M8 12h5" /></svg>;
    case 'monitor':
      return <svg {...common}>{titleNode}<path d="M5.5 5h13A1.5 1.5 0 0 1 20 6.5v9A1.5 1.5 0 0 1 18.5 17h-13A1.5 1.5 0 0 1 4 15.5v-9A1.5 1.5 0 0 1 5.5 5Z" /><path d="M8 21h8" /><path d="M12 17v4" /></svg>;
    case 'package':
      return <svg {...common}>{titleNode}<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.2 7.5-4.2" /><path d="M12 12v8.5" /></svg>;
    case 'palette':
      return <svg {...common}>{titleNode}<path d="M12 4a8 8 0 0 0 0 16h1.2a1.8 1.8 0 0 0 1.2-3.15 1.8 1.8 0 0 1 1.2-3.15H17a3 3 0 0 0 3-3A6.7 6.7 0 0 0 12 4Z" /><path d="M7.8 11h.1" /><path d="M10.3 8h.1" /><path d="M14 8h.1" /></svg>;
    case 'percent':
      return <svg {...common}>{titleNode}<path d="m19 5-14 14" /><circle cx="7.5" cy="7.5" r="2" /><circle cx="16.5" cy="16.5" r="2" /></svg>;
    case 'portal':
      return <svg {...common}>{titleNode}<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M9 12h6" /><path d="m13 9 3 3-3 3" /></svg>;
    case 'refresh':
      return <svg {...common}>{titleNode}<path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M18 12a6 6 0 0 0-10.2-4.2L4 11" /><path d="M6 12a6 6 0 0 0 10.2 4.2L20 13" /></svg>;
    case 'scale':
      return <svg {...common}>{titleNode}<path d="M12 3v18" /><path d="M6 6h12" /><path d="m6 6-3 7h6L6 6Z" /><path d="m18 6-3 7h6l-3-7Z" /></svg>;
    case 'school':
      return <svg {...common}>{titleNode}<path d="M4 21V9l8-5 8 5v12" /><path d="M3 21h18" /><path d="M9 21v-6h6v6" /><path d="M9 11h6" /><path d="M12 4v3" /></svg>;
    case 'settings':
      return <svg {...common}>{titleNode}<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.3 2.7h4.4l.3-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></svg>;
    case 'shield':
      return <svg {...common}>{titleNode}<path d="M12 3.5 5.5 6v5.5c0 4.1 2.6 7.5 6.5 9 3.9-1.5 6.5-4.9 6.5-9V6L12 3.5Z" /><path d="m9 12 2 2 4-5" /></svg>;
    case 'sparkles':
      return <svg {...common}>{titleNode}<path d="m12 3 1.4 4.2L17.5 9l-4.1 1.8L12 15l-1.4-4.2L6.5 9l4.1-1.8L12 3Z" /><path d="m5 15 .8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15Z" /><path d="m18 14 .7 1.8 1.8.7-1.8.7L18 19l-.7-1.8-1.8-.7 1.8-.7L18 14Z" /></svg>;
    case 'tag':
      return <svg {...common}>{titleNode}<path d="M4 12V5h7l8.5 8.5a2 2 0 0 1 0 2.8l-3.2 3.2a2 2 0 0 1-2.8 0L4 12Z" /><path d="M8 8h.01" /></svg>;
    case 'ticket':
      return <svg {...common}>{titleNode}<path d="M5 7.5A1.5 1.5 0 0 1 6.5 6h11A1.5 1.5 0 0 1 19 7.5v2.2a2.3 2.3 0 0 0 0 4.6v2.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 16.5v-2.2a2.3 2.3 0 0 0 0-4.6V7.5Z" /><path d="M12 8v8" /></svg>;
    case 'transfer':
      return <svg {...common}>{titleNode}<path d="M7 7h12" /><path d="m16 4 3 3-3 3" /><path d="M17 17H5" /><path d="m8 14-3 3 3 3" /></svg>;
    case 'userCheck':
      return <svg {...common}>{titleNode}<path d="M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M4.5 19a5.5 5.5 0 0 1 10.5-2.2" /><path d="m16 18 2 2 3.5-4" /></svg>;
    case 'userPlus':
      return <svg {...common}>{titleNode}<path d="M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M4.5 19a5.5 5.5 0 0 1 11 0" /><path d="M18 8v6" /><path d="M15 11h6" /></svg>;
    case 'users':
      return <svg {...common}>{titleNode}<path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M15.5 10a2.5 2.5 0 1 0 0-5" /><path d="M4 19a5 5 0 0 1 10 0" /><path d="M14 17.5a4 4 0 0 1 6 1.5" /></svg>;
    case 'wallet':
      return <svg {...common}>{titleNode}<path d="M5.5 6h12A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-12A2.5 2.5 0 0 1 3 16.5v-8A2.5 2.5 0 0 1 5.5 6Z" /><path d="M16 12h4" /><path d="M6 6V5a2 2 0 0 1 2-2h8" /></svg>;
    case 'warning':
      return <svg {...common}>{titleNode}<path d="M12 4 3.5 19h17L12 4Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
    default:
      return <svg {...common}>{titleNode}<path d="M4 4h16v16H4z" /></svg>;
  }
}
