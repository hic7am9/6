import { useState } from 'react';
import { MessageCircle, Copy, Send, AlertCircle, UserCheck } from 'lucide-react';
import { Modal } from './Modal';
import type { Apartment, Booking, Location } from '@/types';
import {
  buildCleaningRequest,
  buildImmediateCheckoutAlert,
  buildCheckoutFollowup,
  sendWhatsApp,
  copyToClipboard,
} from '@/lib/whatsapp';
import { whatsappLink } from '@/lib/utils';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  apartment: Apartment;
  booking: Booking;
  location: Location | null;
  nextBooking?: Booking | null;
}

type TemplateKey = 'immediate' | 'followup';

export function WhatsAppModal({ isOpen, onClose, apartment, booking, location, nextBooking }: WhatsAppModalProps) {
  const [active, setActive] = useState<TemplateKey>('immediate');
  const [copied, setCopied] = useState(false);

  const ctx = { apartment, booking, location, nextBooking };
  const templates: Record<TemplateKey, { title: string; icon: typeof AlertCircle; text: string; phone?: string }> = {
    immediate: {
      title: 'إشعار خروج عاجل',
      icon: AlertCircle,
      text: buildImmediateCheckoutAlert(ctx),
    },
    followup: {
      title: 'متابعة الخروج مع الضيف',
      icon: UserCheck,
      text: buildCheckoutFollowup(ctx),
      phone: booking.guest_phone ?? undefined,
    },
  };

  const current = templates[active];
  const phone = current.phone ?? booking.guest_phone ?? '';

  const handleCopy = () => {
    copyToClipboard(current.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    if (phone) sendWhatsApp(phone, current.text);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="قوالب الواتساب" size="md">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(Object.keys(templates) as TemplateKey[]).map((key) => {
            const Icon = templates[key].icon;
            return (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={`flex-1 flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-xs font-semibold transition-all ${
                  active === key
                    ? 'bg-whatsapp text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon size={18} />
                {templates[key].title}
              </button>
            );
          })}
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
            {current.text}
          </pre>
        </div>

        <div className="flex gap-2">
          <button onClick={handleCopy} className="btn-secondary flex-1">
            {copied ? <UserCheck size={18} /> : <Copy size={18} />}
            {copied ? 'تم النسخ' : 'نسخ النص'}
          </button>
          <button
            onClick={handleSend}
            disabled={!phone}
            className="btn-success flex-1"
          >
            <Send size={18} />
            إرسال للواتساب
          </button>
        </div>

        {!phone && (
          <p className="text-xs text-amber-600 text-center">
            لا يوجد رقم هاتف لهذا القالب
          </p>
        )}

        {phone && (
          <a
            href={whatsappLink(phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-whatsapp-dark hover:underline"
          >
            <MessageCircle size={16} />
            فتح محادثة مباشرة
          </a>
        )}
      </div>
    </Modal>
  );
}
