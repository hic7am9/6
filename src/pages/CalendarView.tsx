import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, CalendarDays, Download, Upload, X } from 'lucide-react';
import type { Apartment, Location, Booking } from '@/types';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/context/I18nContext';
import { Modal } from '@/components/Modal';

interface CalendarProps {
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
}

const DAY_WIDTH = 56;
const CHECK_IN_RATIO = 16 / 24;   // 4 PM
const CHECK_OUT_RATIO = 12 / 24;  // noon

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function CalendarView({ apartments, locations, bookings }: CalendarProps) {
  const { triggerRefresh } = useApp();
  const { t } = useI18n();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [icalModal, setIcalModal] = useState<Apartment | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 30; i++) arr.push(addDays(startDate, i));
    return arr;
  }, [startDate]);

  const todayIndex = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return days.findIndex((d) => d.getTime() === today.getTime());
  }, [days]);

  useEffect(() => {
    if (scrollRef.current && todayIndex >= 0) {
      scrollRef.current.scrollLeft = todayIndex * DAY_WIDTH;
    }
  }, [todayIndex]);

  const bookingsByApartment = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (b.archived) continue;
      if (!map.has(b.apartment_id)) map.set(b.apartment_id, []);
      map.get(b.apartment_id)!.push(b);
    }
    return map;
  }, [bookings]);

  const monthLabel = useMemo(() => {
    const first = days[0];
    const last = days[days.length - 1];
    const sameMonth = first.getMonth() === last.getMonth();
    const fmt = (d: Date) => d.toLocaleDateString('ar-SA-u-nu-latn', { month: 'long', year: 'numeric' });
    return sameMonth ? fmt(first) : `${fmt(first)} - ${fmt(last)}`;
  }, [days]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('calendar')}</h1>
          <p className="text-sm text-slate-400 mt-1">Airbnb style</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setStartDate((d) => addDays(d, -7))} className="btn-secondary p-2.5">
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">{monthLabel}</span>
          <button onClick={() => setStartDate((d) => addDays(d, 7))} className="btn-secondary p-2.5">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 3); d.setHours(0,0,0,0); setStartDate(d); }} className="btn-secondary text-xs">
            <CalendarDays size={16} />
            اليوم
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-airbnb" />
          <span className="text-slate-600">Airbnb</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-whatsapp" />
          <span className="text-slate-600">{t('whatsapp')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-purple-600" />
          <span className="text-slate-600">{t('gathern')}</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex">
          <div className="shrink-0 w-32 sm:w-44 border-l border-slate-200 bg-slate-50/50">
            <div className="h-14 flex items-center px-3 text-xs font-bold text-slate-400 border-b border-slate-200">
              {t('apt_name')}
            </div>
            {apartments.map((apt) => (
              <div key={apt.id} className="h-11 flex items-center px-3 border-b border-slate-100">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{apt.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{apt.location?.name ?? ''}</p>
                </div>
              </div>
            ))}
            {apartments.length === 0 && (
              <div className="h-20 flex items-center justify-center text-xs text-slate-400">{t('no_apartments')}</div>
            )}
          </div>

          <div className="flex-1 overflow-x-auto scrollbar-thin" ref={scrollRef} dir="ltr">
            <div className="flex border-b border-slate-200" style={{ minWidth: days.length * DAY_WIDTH }}>
              {days.map((d, i) => {
                const isToday = i === todayIndex;
                const isWeekend = d.getDay() === 5 || d.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={`shrink-0 h-14 flex flex-col items-start justify-start px-1.5 pt-1 ${
                      isToday ? 'bg-blue-50' : isWeekend ? 'bg-slate-50' : ''
                    }`}
                    style={{ width: DAY_WIDTH }}
                  >
                    <span className={`text-[9px] leading-none ${isToday ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                      {d.toLocaleDateString('ar-SA-u-nu-latn', { weekday: 'short' })}
                    </span>
                    <span className={`text-sm font-bold leading-none mt-0.5 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {apartments.map((apt) => {
              const aptBookings = bookingsByApartment.get(apt.id) ?? [];
              const visibleStart = dateStr(days[0]);
              const visibleEnd = dateStr(days[days.length - 1]);
              const overlapping = aptBookings.filter(
                (b) => b.check_in <= visibleEnd && b.check_out > visibleStart
              );
              return (
                <div
                  key={apt.id}
                  className="relative border-b border-slate-100"
                  style={{ minWidth: days.length * DAY_WIDTH, height: 44 }}
                >
                  <div className="flex absolute inset-0">
                    {days.map((d, i) => {
                      const isToday = i === todayIndex;
                      const isWeekend = d.getDay() === 5 || d.getDay() === 6;
                      return (
                        <div
                          key={i}
                          className={`shrink-0 border-l border-slate-100 ${
                            isToday ? 'bg-blue-50/30' : isWeekend ? 'bg-slate-50/50' : ''
                          }`}
                          style={{ width: DAY_WIDTH }}
                        />
                      );
                    })}
                  </div>
                  {overlapping.map((booking) => (
                    <BookingBar
                      key={booking.id}
                      booking={booking}
                      days={days}
                      visibleStart={visibleStart}
                      visibleEnd={visibleEnd}
                    />
                  ))}
                </div>
              );
            })}
            {apartments.length === 0 && (
              <div className="flex items-center justify-center h-32 text-sm text-slate-400">{t('no_apartments')}</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => apartments[0] && setIcalModal(apartments[0])} className="btn-secondary text-xs">
          <Download size={16} />
          iCal
        </button>
      </div>

      {icalModal && (
        <IcalModal
          apartment={icalModal}
          apartments={apartments}
          onClose={() => setIcalModal(null)}
          onRefresh={triggerRefresh}
        />
      )}
    </div>
  );
}

function BookingBar({
  booking,
  days,
  visibleStart,
  visibleEnd,
}: {
  booking: Booking;
  days: Date[];
  visibleStart: string;
  visibleEnd: string;
}) {
  const isAirbnb = booking.source === 'airbnb';
  const isGathern = booking.source === 'gathern';
  const bg = isAirbnb ? 'bg-airbnb' : isGathern ? 'bg-purple-600' : 'bg-whatsapp';

  const startsBeforeView = booking.check_in < visibleStart;
  const endsAfterView = booking.check_out > visibleEnd;

  // Column index for check-in day (clamped to 0 if before visible range)
  const checkInIdx = startsBeforeView
    ? 0
    : days.findIndex((d) => dateStr(d) === booking.check_in);

  // Column index for check-out day (clamped to days.length if after visible range)
  const checkOutIdx = endsAfterView
    ? days.length
    : days.findIndex((d) => dateStr(d) === booking.check_out);

  if (checkInIdx < 0 || checkOutIdx < 0) return null;

  // The scroll container is dir="ltr" (we force it) so left=0 is the first visible day.
  // check-in bar starts at 4PM = 16/24 of the way through check-in cell
  const barStart = checkInIdx * DAY_WIDTH + (startsBeforeView ? 0 : DAY_WIDTH * CHECK_IN_RATIO);
  // check-out bar ends at noon = 12/24 of the way through checkout cell
  const barEnd = checkOutIdx * DAY_WIDTH + (endsAfterView ? 0 : DAY_WIDTH * CHECK_OUT_RATIO);

  const width = barEnd - barStart;
  if (width <= 0) return null;

  const radiusLeft = startsBeforeView ? '' : 'rounded-l-md';
  const radiusRight = endsAfterView ? '' : 'rounded-r-md';

  return (
    <div
      className={`absolute top-1.5 ${bg} ${radiusLeft} ${radiusRight} text-white px-1.5 text-[10px] font-bold flex items-center shadow-sm overflow-hidden`}
      style={{ left: barStart, width, height: 28, zIndex: 10 }}
      title={`${booking.guest_name} · ${booking.check_in} → ${booking.check_out}`}
    >
      <span className="truncate whitespace-nowrap">{booking.guest_name}</span>
    </div>
  );
}

function IcalModal({ apartment, apartments, onClose, onRefresh }: {
  apartment: Apartment;
  apartments: Apartment[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [selectedApt, setSelectedApt] = useState(apartment.id);
  const [url, setUrl] = useState('');
  const [direction, setDirection] = useState<'import' | 'export'>('import');
  const [syncs, setSyncs] = useState<{ id: string; url: string; direction: string; last_synced: string | null }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSyncs(selectedApt);
  }, [selectedApt]);

  const loadSyncs = async (aptId: string) => {
    const { data } = await supabase.from('ical_sync').select('*').eq('apartment_id', aptId);
    setSyncs(data ?? []);
  };

  const handleAdd = async () => {
    if (!url) return;
    setSaving(true);
    const { error } = await supabase.from('ical_sync').insert({
      apartment_id: selectedApt,
      url,
      direction,
    });
    if (error) console.error(error);
    else { setUrl(''); loadSyncs(selectedApt); onRefresh(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('ical_sync').delete().eq('id', id);
    loadSyncs(selectedApt);
  };

  return (
    <Modal isOpen onClose={onClose} title="iCal" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">الشقة</label>
          <select value={selectedApt} onChange={(e) => setSelectedApt(e.target.value)} className="input">
            {apartments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setDirection('import')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${direction === 'import' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            <Upload size={16} className="inline ml-1" />
            استيراد
          </button>
          <button
            onClick={() => setDirection('export')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${direction === 'export' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            <Download size={16} className="inline ml-1" />
            تصدير
          </button>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">رابط iCal</label>
          <div className="flex gap-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="input" placeholder="https://..." dir="ltr" />
            <button onClick={handleAdd} disabled={saving} className="btn-primary shrink-0">إضافة</button>
          </div>
        </div>

        <div className="space-y-2">
          {syncs.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400">{s.direction === 'import' ? 'استيراد' : 'تصدير'}</p>
                <p className="text-sm text-slate-700 truncate" dir="ltr">{s.url}</p>
              </div>
              <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                <X size={16} />
              </button>
            </div>
          ))}
          {syncs.length === 0 && <p className="text-center text-sm text-slate-400 py-4">لا توجد روابط مزامنة</p>}
        </div>
      </div>
    </Modal>
  );
}
