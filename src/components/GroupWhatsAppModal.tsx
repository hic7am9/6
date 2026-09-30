import { useState } from 'react';
import { MessageCircle, Copy, Send, MapPin, UserCheck } from 'lucide-react';
import { Modal } from './Modal';
import type { Apartment, Booking, Location } from '@/types';
import { copyToClipboard, sendWhatsApp } from '@/lib/whatsapp';
import { whatsappLink, formatDateShort } from '@/lib/utils';

interface GroupWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  apartments: Apartment[];
  locations: Location[];
}

const AREA_NAMES = ['جدة', 'الخبر', 'المروة', 'الواحة'];
const GROUP_PHONE = '0554363516';

function isDepartureTomorrow(checkOutDate: string): boolean {
  const now = new Date();
  const checkout = new Date(checkOutDate);
  const nightBefore = new Date(checkout);
  nightBefore.setHours(19, 0, 0, 0);
  nightBefore.setDate(nightBefore.getDate() - 1);
  return now >= nightBefore && now < checkout;
}

export function GroupWhatsAppModal({ isOpen, onClose, apartments, locations }: GroupWhatsAppModalProps) {
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const locMap = new Map(locations.map((l) => [l.id, l.name]));

  const buildMessage = (area: string): string => {
    const areaApartments = apartments.filter((apt) => {
      const locName = apt.location_id ? locMap.get(apt.location_id) : null;
      return locName === area;
    });

    if (area === 'الواحة') {
      return [
        'طلب موعد تنظيف',
        'الاسم: سامر بامفلح',
        'رقم العميل: 12',
        'نوع الوحدة: استديو',
        'رقم العمارة: 88A',
        'الدور : 6',
        'رقم الشقة: 2',
        'وقت الخروج : 12:00 PM',
        'وقت دخول الضيف الجديد اذا وجد: [وقت الدخول إن وجد]',
        'اللوكيشن:',
        'https://maps.app.goo.gl/RmuSwSrfion9EiLy5?g_st=ic',
      ].join('\n');
    }

    const departing = areaApartments.filter(
      (apt) => apt.current_booking && isDepartureTomorrow(apt.current_booking.check_out)
    );

    if (departing.length === 0) {
      return `تقرير الخروج غداً - ${area}:\nلا توجد مغادرات غداً`;
    }

    const lines = [`تقرير الخروج غداً - ${area}:`];
    for (const apt of departing) {
      lines.push(`• شقة ${apt.apt_number ?? apt.name} - ${apt.name}`);
    }
    return lines.join('\n');
  };

  const message = selectedArea ? buildMessage(selectedArea) : '';
  const hasDepartures = selectedArea && selectedArea !== 'الواحة'
    ? apartments.some((apt) => {
        const locName = apt.location_id ? locMap.get(apt.location_id) : null;
        return locName === selectedArea && apt.current_booking && isDepartureTomorrow(apt.current_booking.check_out);
      })
    : true;

  const handleCopy = () => {
    copyToClipboard(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    sendWhatsApp(GROUP_PHONE, message);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="واتساب الجروبات" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AREA_NAMES.map((area) => (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-xs font-semibold transition-all ${
                selectedArea === area
                  ? 'bg-whatsapp text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MapPin size={18} />
              {area}
            </button>
          ))}
        </div>

        {selectedArea && (
          <>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
                {message}
              </pre>
            </div>

            {selectedArea !== 'الواحة' && !hasDepartures && (
              <p className="text-xs text-amber-600 text-center">
                لا توجد شقق بمغادرة غداً في هذه المنطقة
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn-secondary flex-1">
                {copied ? <UserCheck size={18} /> : <Copy size={18} />}
                {copied ? 'تم النسخ' : 'نسخ النص'}
              </button>
              <button onClick={handleSend} className="btn-success flex-1">
                <Send size={18} />
                إرسال مباشر للجروب
              </button>
            </div>

            <a
              href={whatsappLink(GROUP_PHONE)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-whatsapp-dark hover:underline"
            >
              <MessageCircle size={16} />
              فتح محادثة الجروب
            </a>
          </>
        )}
      </div>
    </Modal>
  );
}
