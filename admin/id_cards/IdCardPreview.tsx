'use client';

import type { IdCardRecord, IdCardTemplate } from './types';

type Props = {
  template: IdCardTemplate;
  record: IdCardRecord;
  photoUrl: string | null;
  size?: 'small' | 'medium' | 'large';
  customSettings?: {
    borderWidth?: number;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
    showQR?: boolean;
    showPhoto?: boolean;
    customSchoolName?: string;
    photoShape?: 'square' | 'circle' | 'rounded';
  };
};

const sizeMap = {
  small: { width: 280, height: 440, padding: 'p-4' },
  medium: { width: 340, height: 540, padding: 'p-6' },
  large: { width: 400, height: 640, padding: 'p-8' }
};

const photoShapeMap = { square: 'rounded-lg', circle: 'rounded-full', rounded: 'rounded-2xl' };

export default function IdCardPreview({ template, record, photoUrl, size = 'medium', customSettings = {} }: Props) {
  const textClass = template.text === 'dark' ? 'text-slate-900' : 'text-white';
  const pattern = template.backgroundPattern ?? 'gradient';
  const cardSize = sizeMap[size];
  const {
    borderWidth = 0,
    borderColor = '#ffffff',
    borderStyle = 'solid',
    showQR = true,
    showPhoto = true,
    customSchoolName = 'TechStage School',
    photoShape = 'rounded'
  } = customSettings;

  const initials = record.name.split(' ').filter(Boolean).slice(0, 2).map(chunk => chunk.charAt(0).toUpperCase()).join('');
  const isStudent = record.role === 'STUDENT' || record.admissionNo;
  const currentYear = new Date().getFullYear();

  const SchoolLogo = () => (
    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
      <span className="text-xs font-bold text-white">TS</span>
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
    <div
      className={`relative overflow-hidden shadow-2xl transition-all duration-300 ${textClass}`}
      style={{
        width: cardSize.width,
        height: cardSize.height,
        background: `linear-gradient(145deg, ${template.bgFrom}, ${template.bgTo})`,
        borderRadius: template.variant === 'badge' ? '1.75rem' : template.variant === 'wave' ? '1.5rem' : '1rem',
        border: borderWidth > 0 ? `${borderWidth}px ${borderStyle} ${borderColor}` : 'none'
      }}
    >
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

      {/* Background patterns */}
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

      <div className={`relative z-10 h-full flex flex-col ${cardSize.padding}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <SchoolLogo />
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wider leading-tight">{customSchoolName}</h1>
              <p className="text-xs opacity-80 font-medium">{record.schoolName || 'Main Campus'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold opacity-90">{isStudent ? 'STUDENT' : 'STAFF'}</p>
            <p className="text-xs opacity-70">{currentYear}-{currentYear + 1}</p>
          </div>
        </div>

        {/* Photo and Info */}
        <div className="flex items-start gap-4 mb-4">
          {showPhoto && (
            <div className="relative">
              <div className={`h-20 w-20 overflow-hidden ${photoShapeMap[photoShape]} border-3 border-white/60 bg-white/20 shadow-lg`}>
                {photoUrl ? (
                  <img src={photoUrl} alt={record.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold bg-gradient-to-br from-white/30 to-white/10">
                    {initials || 'NA'}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white/60" style={{ backgroundColor: template.accent }} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight mb-1 truncate">{record.name}</h2>
            <p className="text-sm font-semibold opacity-90 mb-1 capitalize">{record.role.toLowerCase().replace('_', ' ')}</p>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm">
              {record.admissionNo ? `ADM: ${record.admissionNo}` : record.employeeNo ? `EMP: ${record.employeeNo}` : 'ID: ' + record.id.slice(-6).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 mb-3 border border-white/20">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="font-semibold opacity-80">Phone:</span>
                <p className="font-medium truncate">{record.phone || 'Not provided'}</p>
              </div>
              <div>
                <span className="font-semibold opacity-80">Blood:</span>
                <p className="font-medium">{record.bloodGroup || 'Unknown'}</p>
              </div>
              <div className="col-span-2">
                <span className="font-semibold opacity-80">Email:</span>
                <p className="font-medium truncate">{record.email || 'Not provided'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/20">
          <div className="text-xs">
            <p className="font-semibold opacity-90">
              {record.dob ? `DOB: ${new Date(record.dob).toLocaleDateString()}` : 'Valid Academic Year'}
            </p>
          </div>
          {showQR && (
            <div className="flex items-center gap-2">
              <QRCode size={24} />
              <div className="text-[10px] font-mono font-bold px-2 py-1 rounded-md border border-white/30" style={{ backgroundColor: template.accent, color: '#0f172a' }}>
                {record.id.slice(-8).toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
