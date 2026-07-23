'use client';

import { useEffect, useState } from 'react';
import Button from './Button';

type WhatsAppCredentialShareDialogProps = {
  open: boolean;
  message: string;
  onClose: () => void;
};

const normalizeWhatsAppNumber = (value: string) =>
  value
    .trim()
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '');

export default function WhatsAppCredentialShareDialog({
  open,
  message,
  onClose,
}: WhatsAppCredentialShareDialogProps) {
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setMobile('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const share = () => {
    const normalized = normalizeWhatsAppNumber(mobile);
    if (!/^\d{8,15}$/.test(normalized)) {
      setError('Enter a valid WhatsApp number with country code.');
      return;
    }

    window.open(
      `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="whatsapp-share-title">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="whatsapp-share-title" className="text-lg font-bold text-gray-950">
              Share credentials
            </h2>
            <p className="mt-1 text-sm text-gray-600">Enter the recipient WhatsApp number.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close WhatsApp share dialog"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-gray-800">WhatsApp number</span>
          <input
            value={mobile}
            onChange={(event) => {
              setMobile(event.target.value);
              if (error) setError('');
            }}
            placeholder="919876543210"
            inputMode="tel"
            autoFocus
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </label>
        {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="success" size="sm" type="button" onClick={share}>
            Open WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
