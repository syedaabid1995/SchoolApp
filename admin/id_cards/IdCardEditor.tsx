'use client';

import { useState } from 'react';
import type { IdCardRecord, IdCardTemplate } from './types';

type CustomSettings = {
  size: 'small' | 'medium' | 'large';
  borderWidth: number;
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'dotted';
  logoPosition: 'top-left' | 'top-center' | 'top-right';
  logoSize: 'small' | 'medium' | 'large';
  textAlignment: 'left' | 'center' | 'right';
  showQR: boolean;
  showPhoto: boolean;
  customSchoolName: string;
  customTitle: string;
  customSchoolAddress: string;
  customSchoolPhone: string;
  customSchoolEmail: string;
  customSchoolLogoUrl: string;
  photoShape: 'square' | 'circle' | 'rounded';
  photoSize: 'small' | 'medium' | 'large';
  customName: string;
  customRole: string;
  customPhone: string;
  customEmail: string;
  customBloodGroup: string;
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
  textColor: string;
};

type TypographyTarget =
  | 'schoolName'
  | 'cardTitle'
  | 'personName'
  | 'personRole'
  | 'phoneValue'
  | 'bloodValue'
  | 'emailValue'
  | 'dobValue';

type TypographyStyle = {
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  color: string;
  letterSpacing: number;
  textTransform: 'none' | 'uppercase' | 'capitalize';
};

type Props = {
  template: IdCardTemplate;
  record: IdCardRecord;
  photoUrl: string | null;
  onTemplateChange: (template: IdCardTemplate) => void;
};

const sizeMap = {
  small: { width: 280, height: 440 },
  medium: { width: 340, height: 540 },
  large: { width: 400, height: 640 }
};

const logoSizeMap = { small: 'w-8 h-8', medium: 'w-12 h-12', large: 'w-16 h-16' };
const photoSizeMap = { small: 'h-16 w-16', medium: 'h-24 w-24', large: 'h-32 w-32' };
const photoShapeMap = { square: 'rounded-lg', circle: 'rounded-full', rounded: 'rounded-2xl' };

export default function IdCardEditor({ template, record, photoUrl, onTemplateChange }: Props) {
  const [showBackSide, setShowBackSide] = useState(false);
  const [settings, setSettings] = useState<CustomSettings>({
    size: 'medium',
    borderWidth: 0,
    borderColor: '#ffffff',
    borderStyle: 'solid',
    logoPosition: 'top-left',
    logoSize: 'medium',
    textAlignment: 'left',
    showQR: true,
    showPhoto: true,
    customSchoolName: 'TechStage School',
    customTitle: 'Student ID Card',
    customSchoolAddress: '123 Education Street, Tech City',
    customSchoolPhone: '+1 555 100 2000',
    customSchoolEmail: 'info@techstageschool.com',
    customSchoolLogoUrl: '',
    photoShape: 'rounded',
    photoSize: 'medium',
    customName: record.name,
    customRole: record.role,
    customPhone: record.phone || '',
    customEmail: record.email || '',
    customBloodGroup: record.bloodGroup || '',
    fontSize: 'medium',
    fontFamily: 'Inter',
    textColor: template.text === 'dark' ? '#0f172a' : '#ffffff'
  });

  const updateSetting = (key: keyof CustomSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const [activeTypoTarget, setActiveTypoTarget] = useState<TypographyTarget | null>(null);
  const [typography, setTypography] = useState<Record<TypographyTarget, TypographyStyle>>({
    schoolName: { fontSize: 13, fontWeight: 700, fontFamily: 'Inter', color: '#ffffff', letterSpacing: 1, textTransform: 'uppercase' },
    cardTitle: { fontSize: 12, fontWeight: 500, fontFamily: 'Inter', color: '#ffffff', letterSpacing: 0, textTransform: 'none' },
    personName: { fontSize: 28, fontWeight: 700, fontFamily: 'Inter', color: '#ffffff', letterSpacing: 0, textTransform: 'none' },
    personRole: { fontSize: 18, fontWeight: 600, fontFamily: 'Inter', color: '#ffffff', letterSpacing: 0, textTransform: 'capitalize' },
    phoneValue: { fontSize: 12, fontWeight: 500, fontFamily: 'Inter', color: '#ffffff', letterSpacing: 0, textTransform: 'none' },
    bloodValue: { fontSize: 12, fontWeight: 500, fontFamily: 'Inter', color: '#ffffff', letterSpacing: 0, textTransform: 'uppercase' },
    emailValue: { fontSize: 12, fontWeight: 500, fontFamily: 'Inter', color: '#ffffff', letterSpacing: 0, textTransform: 'none' },
    dobValue: { fontSize: 12, fontWeight: 600, fontFamily: 'Inter', color: '#ffffff', letterSpacing: 0, textTransform: 'none' },
  });

  const typoLabel: Record<TypographyTarget, string> = {
    schoolName: 'School Name',
    cardTitle: 'Card Title',
    personName: 'Name',
    personRole: 'Role',
    phoneValue: 'Phone Value',
    bloodValue: 'Blood Value',
    emailValue: 'Email Value',
    dobValue: 'DOB Value',
  };

  const updateTypography = <K extends keyof TypographyStyle>(key: K, value: TypographyStyle[K]) => {
    if (!activeTypoTarget) return;
    setTypography((prev) => ({
      ...prev,
      [activeTypoTarget]: {
        ...prev[activeTypoTarget],
        [key]: value,
      },
    }));
  };

  const textButtonClass = 'cursor-pointer rounded px-1 hover:bg-white/20';

  const textClass = template.text === 'dark' ? 'text-slate-900' : 'text-white';
  const pattern = template.backgroundPattern ?? 'gradient';
  const cardSize = sizeMap[settings.size];
  const initials = record.name.split(' ').filter(Boolean).slice(0, 2).map(chunk => chunk.charAt(0).toUpperCase()).join('');

  const SchoolLogo = () => (
    <div className={`${logoSizeMap[settings.logoSize]} rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30`}>
      <div className="w-3/4 h-3/4 rounded-full bg-white/40 flex items-center justify-center">
        <span className="text-xs font-bold text-white">TS</span>
      </div>
    </div>
  );

  const QRCode = ({ size = 32 }: { size?: number }) => (
    <div className="bg-white rounded-lg p-1 shadow-sm" style={{ width: size, height: size }}>
      <div className="w-full h-full bg-slate-900 rounded grid grid-cols-3 gap-0.5 p-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={`rounded-sm ${Math.random() > 0.5 ? 'bg-white' : 'bg-slate-900'}`} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex gap-8 h-screen bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
      {/* Controls Panel */}
      <div className="w-80 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl p-6 m-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
          </div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Customize</h3>
        </div>
        
        {/* Size & Border */}
        <div className="space-y-6 mb-8">
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
            <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4a1 1 0 011-1h4m0 0l-3 3m3-3v4M4 16v4a1 1 0 001 1h4m0 0l-3-3m3 3h-4M16 4h4a1 1 0 011 1v4m0 0l-3-3m3 3v-4M16 20h4a1 1 0 001-1v-4m0 0l3 3m-3-3h4" />
              </svg>
              Card Dimensions
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Size</label>
                <select value={settings.size} onChange={(e) => updateSetting('size', e.target.value)} className="w-full p-3 border border-slate-200 rounded-lg bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                  <option value="small">Small (280×440)</option>
                  <option value="medium">Medium (340×540)</option>
                  <option value="large">Large (400×640)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Border Width</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="8" value={settings.borderWidth} onChange={(e) => updateSetting('borderWidth', Number(e.target.value))} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                  <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">{settings.borderWidth}px</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Border Color</label>
                  <input type="color" value={settings.borderColor} onChange={(e) => updateSetting('borderColor', e.target.value)} className="w-full h-12 rounded-lg border border-slate-200 cursor-pointer" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Style</label>
                  <select value={settings.borderStyle} onChange={(e) => updateSetting('borderStyle', e.target.value)} className="w-full p-3 border border-slate-200 rounded-lg bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Background */}
        <div className="space-y-6 mb-8">
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100">
            <h4 className="font-semibold text-purple-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
              </svg>
              Background Design
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">Pattern</label>
                <select value={pattern} onChange={(e) => onTemplateChange({...template, backgroundPattern: e.target.value as any})} className="w-full p-3 border border-slate-200 rounded-lg bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  <option value="gradient">Gradient</option>
                  <option value="wavy">Wavy</option>
                  <option value="crystal">Crystal</option>
                  <option value="mesh">Mesh</option>
                  <option value="rings">Rings</option>
                </select>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">From</label>
                  <input type="color" value={template.bgFrom} onChange={(e) => onTemplateChange({...template, bgFrom: e.target.value})} className="w-full h-12 rounded-lg border border-slate-200 cursor-pointer" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">To</label>
                  <input type="color" value={template.bgTo} onChange={(e) => onTemplateChange({...template, bgTo: e.target.value})} className="w-full h-12 rounded-lg border border-slate-200 cursor-pointer" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Accent</label>
                  <input type="color" value={template.accent} onChange={(e) => onTemplateChange({...template, accent: e.target.value})} className="w-full h-12 rounded-lg border border-slate-200 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* School Details (Back Side) */}
        <div className="space-y-6 mb-8">
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-100">
            <h4 className="font-semibold text-sky-900 mb-4">Back Side School Details</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">School Address</label>
                <input
                  type="text"
                  value={settings.customSchoolAddress}
                  onChange={(e) => updateSetting('customSchoolAddress', e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white/70 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">School Phone</label>
                <input
                  type="text"
                  value={settings.customSchoolPhone}
                  onChange={(e) => updateSetting('customSchoolPhone', e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white/70 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">School Email</label>
                <input
                  type="text"
                  value={settings.customSchoolEmail}
                  onChange={(e) => updateSetting('customSchoolEmail', e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white/70 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">School Logo URL (optional)</label>
                <input
                  type="text"
                  value={settings.customSchoolLogoUrl}
                  onChange={(e) => updateSetting('customSchoolLogoUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white/70 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Layout & Photo */}
        <div className="grid grid-cols-1 gap-6">
          <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
            <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Layout & Photo
            </h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
                <input type="checkbox" checked={settings.showPhoto} onChange={(e) => updateSetting('showPhoto', e.target.checked)} className="w-4 h-4 text-green-600 rounded focus:ring-green-500" />
                <label className="text-sm font-medium text-slate-700">Show Photo</label>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Shape</label>
                  <select value={settings.photoShape} onChange={(e) => updateSetting('photoShape', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg bg-white/70 text-sm">
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                    <option value="rounded">Rounded</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Size</label>
                  <select value={settings.photoSize} onChange={(e) => updateSetting('photoSize', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg bg-white/70 text-sm">
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100">
            <h4 className="font-semibold text-orange-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              Typography
            </h4>
            <p className="text-sm text-slate-700">
              Click any text in the preview to open typography controls for that specific content.
            </p>
          </div>
          
          <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100">
            <h4 className="font-semibold text-teal-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              Quick Options
            </h4>
            <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
              <input type="checkbox" checked={settings.showQR} onChange={(e) => updateSetting('showQR', e.target.checked)} className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500" />
              <label className="text-sm font-medium text-slate-700">Show QR Code</label>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 flex justify-center items-center p-6 overflow-hidden">
        <div className="relative" style={{ perspective: '1400px', WebkitPerspective: '1400px' }}>
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={() => setShowBackSide((prev) => !prev)}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              Flip to {showBackSide ? 'Front' : 'Back'}
            </button>
          </div>
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 rounded-3xl blur-lg opacity-20 animate-pulse"></div>
          <div
            className="relative transition-transform duration-500"
            style={{
              width: cardSize.width,
              height: cardSize.height,
              transformStyle: 'preserve-3d',
              WebkitTransformStyle: 'preserve-3d',
              transform: showBackSide ? 'rotateY(180deg)' : 'rotateY(0deg)',
              willChange: 'transform',
            }}
          >
        <div
          className={`absolute inset-0 overflow-hidden shadow-2xl transition-all duration-300 ${textClass}`}
          style={{
            background: `linear-gradient(145deg, ${template.bgFrom}, ${template.bgTo})`,
            borderRadius: template.variant === 'badge' ? '1.75rem' : template.variant === 'wave' ? '1.5rem' : '1rem',
            border: settings.borderWidth > 0 ? `${settings.borderWidth}px ${settings.borderStyle} ${settings.borderColor}` : 'none',
            transform: 'rotateY(0deg)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            opacity: showBackSide ? 0 : 1,
            zIndex: showBackSide ? 0 : 2,
            pointerEvents: showBackSide ? 'none' : 'auto',
          }}
        >
          {/* Background Patterns */}
          {pattern === 'wavy' && (
            <svg className="absolute inset-0 h-full w-full opacity-25" viewBox={`0 0 ${cardSize.width} ${cardSize.height}`} preserveAspectRatio="none">
              <path d={`M0 80 C60 130, 120 45, 200 95 C260 130, 300 65, ${cardSize.width} 90 L${cardSize.width} 0 L0 0 Z`} fill="white" />
              <path d={`M0 ${cardSize.height - 70} C70 ${cardSize.height - 110}, 130 ${cardSize.height - 20}, 220 ${cardSize.height - 55} C280 ${cardSize.height - 85}, 315 ${cardSize.height - 10}, ${cardSize.width} ${cardSize.height - 35} L${cardSize.width} ${cardSize.height} L0 ${cardSize.height} Z`} fill="white" />
            </svg>
          )}
          
          {pattern === 'crystal' && (
            <>
              <div className="absolute -left-10 top-12 h-28 w-28 rotate-45 bg-white/20" />
              <div className="absolute right-4 top-8 h-16 w-16 rotate-12 bg-white/15" />
              <div className="absolute right-8 bottom-14 h-24 w-24 -rotate-12 bg-white/20" />
              <div className="absolute left-20 bottom-10 h-16 w-16 rotate-45 bg-white/15" />
            </>
          )}
          
          {pattern === 'mesh' && (
            <>
              <div className="absolute -left-6 top-10 h-24 w-24 rounded-full bg-white/20 blur-sm" />
              <div className="absolute right-2 top-24 h-16 w-16 rounded-full bg-white/15 blur-sm" />
              <div className="absolute left-24 bottom-6 h-20 w-20 rounded-full bg-white/15 blur-sm" />
              <div className="absolute right-8 bottom-16 h-12 w-12 rounded-full bg-white/20 blur-sm" />
            </>
          )}
          
          {pattern === 'rings' && (
            <>
              <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full border-2 border-white/30" />
              <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full border border-white/30" />
              <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full border-2 border-white/30" />
              <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full border border-white/30" />
            </>
          )}
          
          {pattern === 'gradient' && (
            <div className="absolute inset-0 opacity-5">
              <div className="h-full w-full" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
            </div>
          )}

          {/* Variant decorations */}
          {template.variant === 'split' && <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-black/20 to-transparent" />}
          {template.variant === 'ribbon' && <div className="absolute right-0 top-0 h-12 w-40 -translate-y-3 translate-x-10 rotate-12 bg-gradient-to-r from-white/30 to-white/10 shadow-lg" />}
          {template.variant === 'panel' && <div className="absolute left-0 top-0 h-full w-4 bg-gradient-to-b from-white/40 to-white/20" />}
          {template.variant === 'wave' && (
            <>
              <div className="absolute -bottom-12 -right-10 h-32 w-32 rounded-full bg-white/15" />
              <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-white/10" />
            </>
          )}
          {template.variant === 'duotone' && <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/25 to-transparent" />}
          {template.variant === 'frame' && <div className="absolute inset-2 border-2 border-white/20 rounded-xl" />}
          {template.variant === 'badge' && (
            <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: template.accent }} />
            </div>
          )}
          {template.variant === 'minimal' && <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: template.accent }} />}
          {template.variant === 'clean' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/40" />}

          <div className="relative z-10 h-full flex flex-col p-6">
            {/* Header */}
            <div className={`flex items-center mb-6 ${settings.logoPosition === 'top-center' ? 'justify-center' : settings.logoPosition === 'top-right' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-center gap-3 ${settings.textAlignment === 'center' ? 'text-center' : settings.textAlignment === 'right' ? 'text-right' : 'text-left'}`}>
                <SchoolLogo />
                <div>
                  <h1
                    className={`font-bold tracking-wider leading-tight ${textButtonClass}`}
                    style={typography.schoolName}
                    onClick={() => setActiveTypoTarget('schoolName')}
                  >
                    {settings.customSchoolName || 'School Name'}
                  </h1>
                  <p
                    className={`opacity-80 font-medium ${textButtonClass}`}
                    style={typography.cardTitle}
                    onClick={() => setActiveTypoTarget('cardTitle')}
                  >
                    {settings.customTitle || 'Card Title'}
                  </p>
                </div>
              </div>
            </div>

            {/* Photo and Info */}
            <div className="flex items-start gap-4 mb-6">
              {settings.showPhoto && (
                <div className="relative">
                  <div className={`${photoSizeMap[settings.photoSize]} overflow-hidden ${photoShapeMap[settings.photoShape]} border-3 border-white/60 bg-white/20 shadow-lg`}>
                    {photoUrl ? (
                      <img src={photoUrl} alt={record.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-bold bg-gradient-to-br from-white/30 to-white/10">
                        {initials || 'NA'}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white/60" style={{ backgroundColor: template.accent }} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h2
                  className={`font-bold leading-tight mb-1 ${textButtonClass}`}
                  style={typography.personName}
                  onClick={() => setActiveTypoTarget('personName')}
                >
                  {settings.customName || 'Name'}
                </h2>
                <p
                  className={`font-semibold opacity-90 mb-1 ${textButtonClass}`}
                  style={typography.personRole}
                  onClick={() => setActiveTypoTarget('personRole')}
                >
                  {settings.customRole || 'Role'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                    {record.admissionNo ? `ADM: ${record.admissionNo}` : record.employeeNo ? `EMP: ${record.employeeNo}` : 'ID: ' + record.id.slice(-6).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="flex-1">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 mb-4 border border-white/20">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-semibold opacity-80">Phone:</span>
                    <p
                      className={`font-medium truncate ${textButtonClass}`}
                      style={typography.phoneValue}
                      onClick={() => setActiveTypoTarget('phoneValue')}
                    >
                      {settings.customPhone || 'Phone number'}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold opacity-80">Blood:</span>
                    <p
                      className={`font-medium ${textButtonClass}`}
                      style={typography.bloodValue}
                      onClick={() => setActiveTypoTarget('bloodValue')}
                    >
                      {settings.customBloodGroup || 'Blood group'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-semibold opacity-80">Email:</span>
                    <p
                      className={`font-medium truncate ${textButtonClass}`}
                      style={typography.emailValue}
                      onClick={() => setActiveTypoTarget('emailValue')}
                    >
                      {settings.customEmail || 'Email address'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div className="text-xs">
                <p
                  className={`font-semibold opacity-90 ${textButtonClass}`}
                  style={typography.dobValue}
                  onClick={() => setActiveTypoTarget('dobValue')}
                >
                  {record.dob ? `DOB: ${new Date(record.dob).toLocaleDateString()}` : 'Valid Academic Year'}
                </p>
              </div>
              {settings.showQR && (
                <div className="flex items-center gap-2">
                  <QRCode size={28} />
                  <div className="text-[10px] font-mono font-bold px-2 py-1 rounded-md border border-white/30" style={{ backgroundColor: template.accent, color: '#0f172a' }}>
                    {record.id.slice(-8).toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        <div
          className={`absolute inset-0 overflow-hidden shadow-2xl transition-all duration-300 ${textClass}`}
          style={{
            background: `linear-gradient(145deg, ${template.bgTo}, ${template.bgFrom})`,
            borderRadius: template.variant === 'badge' ? '1.75rem' : template.variant === 'wave' ? '1.5rem' : '1rem',
            border: settings.borderWidth > 0 ? `${settings.borderWidth}px ${settings.borderStyle} ${settings.borderColor}` : 'none',
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            opacity: showBackSide ? 1 : 0,
            zIndex: showBackSide ? 2 : 0,
            pointerEvents: showBackSide ? 'auto' : 'none',
          }}
        >
          <div className="relative z-10 h-full flex flex-col p-6">
            <div className="flex items-center gap-3 border-b border-white/30 pb-4">
              <div className="h-14 w-14 overflow-hidden rounded-full border border-white/40 bg-white/15">
                {settings.customSchoolLogoUrl ? (
                  <img src={settings.customSchoolLogoUrl} alt="School logo" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold">TS</div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold">{settings.customSchoolName || 'School Name'}</h3>
                <p className="text-xs opacity-80">Official School Details</p>
              </div>
            </div>

            <div className="mt-5 flex-1 space-y-4 text-sm">
              <div className="rounded-xl bg-white/15 p-3">
                <p className="text-xs font-semibold uppercase opacity-80">Address</p>
                <p className="mt-1 leading-relaxed">{settings.customSchoolAddress || '—'}</p>
              </div>
              <div className="rounded-xl bg-white/15 p-3">
                <p className="text-xs font-semibold uppercase opacity-80">Contact</p>
                <p className="mt-1">Phone: {settings.customSchoolPhone || '—'}</p>
                <p className="mt-1">Email: {settings.customSchoolEmail || '—'}</p>
              </div>
              <div className="rounded-xl bg-white/15 p-3">
                <p className="text-xs font-semibold uppercase opacity-80">Instructions</p>
                <p className="mt-1 leading-relaxed text-xs opacity-90">
                  If found, please return this card to the school office. Unauthorized use is prohibited.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-white/30 text-[11px] opacity-90">
              Issued for: {settings.customName || record.name}
            </div>
          </div>
        </div>
        </div>
      </div>
      </div>

      {activeTypoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-900">Typography - {typoLabel[activeTypoTarget]}</h4>
              <button
                type="button"
                onClick={() => setActiveTypoTarget(null)}
                className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">Font Size</span>
                <input
                  type="number"
                  min={8}
                  max={64}
                  value={typography[activeTypoTarget].fontSize}
                  onChange={(e) => updateTypography('fontSize', Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">Weight</span>
                <input
                  type="number"
                  min={100}
                  max={900}
                  step={100}
                  value={typography[activeTypoTarget].fontWeight}
                  onChange={(e) => updateTypography('fontWeight', Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                />
              </label>
              <label className="col-span-2 text-sm">
                <span className="mb-1 block text-slate-700">Font Family</span>
                <select
                  value={typography[activeTypoTarget].fontFamily}
                  onChange={(e) => updateTypography('fontFamily', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                >
                  <option value="Inter">Inter</option>
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Roboto">Roboto</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">Color</span>
                <input
                  type="color"
                  value={typography[activeTypoTarget].color}
                  onChange={(e) => updateTypography('color', e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">Letter Space</span>
                <input
                  type="number"
                  min={-2}
                  max={10}
                  step={0.2}
                  value={typography[activeTypoTarget].letterSpacing}
                  onChange={(e) => updateTypography('letterSpacing', Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                />
              </label>
              <label className="col-span-2 text-sm">
                <span className="mb-1 block text-slate-700">Transform</span>
                <select
                  value={typography[activeTypoTarget].textTransform}
                  onChange={(e) => updateTypography('textTransform', e.target.value as TypographyStyle['textTransform'])}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5"
                >
                  <option value="none">None</option>
                  <option value="uppercase">Uppercase</option>
                  <option value="capitalize">Capitalize</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
