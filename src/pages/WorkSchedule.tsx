import { useState, useMemo } from 'react';
import { Plus, AlertCircle, MessageCircle, Edit, ChevronDown, ChevronUp, Settings, Search, RefreshCw, LayoutGrid, List, ArrowUp, ArrowDown, CalendarPlus } from 'lucide-react';
import type { Apartment, Location, Booking } from '@/types';
import { isDepartureActive, isDepartureToday, isDepartureTomorrow, formatDate, SOURCE_LABELS } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { useI18n } from '@/context/I18nContext';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { StatusModal, archiveBooking } from '@/components/StatusModal';
import { WhatsAppModal } from '@/components/WhatsAppModal';
import { GroupWhatsAppModal } from '@/components/GroupWhatsAppModal';
import { BookingModal } from '@/components/BookingModal';
import { ManageModal } from '@/components/ManageModal';
import { ExtendModal } from '@/components/ExtendModal';

interface ScheduleProps {
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
}

export function WorkSchedule({ apartments, locations, bookings }: ScheduleProps) {
  const { triggerRefresh } = useApp();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [statusModal, setStatusModal] = useState<Apartment | null>(null);
  const [whatsappModal, setWhatsappModal] = useState<{ apt: Apartment; booking: Booking } | null>(null);
  const [groupWhatsappOpen, setGroupWhatsappOpen] = useState(false);
  const [bookingModal, setBookingModal] = useState<{ apt: Apartment | null; editing: boolean } | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [confirmCheckout, setConfirmCheckout] = useState<Apartment | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [extendModal, setExtendModal] = useState<Apartment | null>(null);

  const filtered = useMemo(() => {
    if (!search) return apartments;
    const q = search.toLowerCase();
    return apartments.filter(
      (apt) =>
        apt.name.toLowerCase().includes(q) ||
        (apt.current_booking?.guest_name ?? '').toLowerCase().includes(q)
    );
  }, [apartments, search]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-ical`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const synced = data.synced ?? 0;
      const results: { apartment: string; events: number; error?: string }[] = data.results ?? [];
      const errors = results.filter((r) => r.error);
      if (synced > 0) {
        setSyncMsg(`تمت مزامنة ${synced} حجز بنجاح`);
      } else if (errors.length > 0) {
        setSyncMsg(`تعذر جلب الحجوزات: ${errors.map((e) => e.apartment).join('، ')}`);
      } else {
        setSyncMsg('لا توجد حجوزات جديدة في تقويم iCal');
      }
      triggerRefresh();
    } catch (err) {
      setSyncMsg('فشل المزامنة: ' + (err instanceof Error ? err.message : 'خطأ غير معروف'));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 6000);
    }
  };

  const handleQuickCheckout = async (apt: Apartment) => {
    if (!apt.current_booking || !apt.current_booking_id) return;
    setCheckoutLoading(apt.id);
    try {
      await archiveBooking(apt.current_booking, apt);
      await supabase
        .from('apartments')
        .update({ status: 'not_ready', current_booking_id: null })
        .eq('id', apt.id);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setCheckoutLoading(null);
      setConfirmCheckout(null);
    }
  };

  const handleMoveOrder = async (apt: Apartment, direction: 'up' | 'down') => {
    const sorted = [...apartments];
    const idx = sorted.findIndex((a) => a.id === apt.id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    const aptOrder = apt.display_order ?? idx;
    const otherOrder = other.display_order ?? swapIdx;
    await Promise.all([
      supabase.from('apartments').update({ display_order: otherOrder }).eq('id', apt.id),
      supabase.from('apartments').update({ display_order: aptOrder }).eq('id', other.id),
    ]);
    triggerRefresh();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('work_schedule')}</h1>
          <p className="text-sm text-slate-400 mt-1">{apartments.length} {t('total_apartments')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleSync} disabled={syncing} className="btn-secondary">
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">مزامنة الحجوزات</span>
          </button>
          <button onClick={() => setGroupWhatsappOpen(true)} className="btn-success">
            <MessageCircle size={18} />
            <span className="hidden sm:inline">واتساب الجروبات</span>
          </button>
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          <button onClick={() => setManageOpen(true)} className="btn-secondary">
            <Settings size={18} />
          </button>
          <button onClick={() => setBookingModal({ apt: null, editing: false })} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">{t('new_booking')}</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pr-10"
          placeholder={t('search') + ' ' + t('apt_name') + '/' + t('guest_name')}
        />
      </div>

      {syncMsg && (
        <div className={`text-sm font-semibold px-4 py-2 rounded-xl ${syncMsg.includes('فشل') || syncMsg.includes('تعذر') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {syncMsg}
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="space-y-2">
          {filtered.map((apt, idx) => {
            const departureActive = apt.current_booking && isDepartureActive(apt.current_booking.check_out);
            const departureToday = apt.current_booking && isDepartureToday(apt.current_booking.check_out);
            const departureTomorrow = apt.current_booking && isDepartureTomorrow(apt.current_booking.check_out);
            const expanded = expandedRows.has(apt.id);
            const locName = apt.location?.name ?? 'بدون موقع';

            let rowClass = 'card overflow-hidden';
            if (departureActive) rowClass += ' row-red pulse-red';
            else if (departureTomorrow) rowClass += ' row-amber';
            else if (apt.status === 'occupied') rowClass += ' row-occupied';
            else if (apt.status === 'not_ready') rowClass += ' row-gray';
            else if (apt.status === 'maintenance') rowClass += ' row-yellow';

            return (
              <div key={apt.id} className={rowClass}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveOrder(apt, 'up')}
                      disabled={idx === 0}
                      className="text-slate-300 hover:text-slate-600 disabled:opacity-30 transition-colors"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(apt, 'down')}
                      disabled={idx === filtered.length - 1}
                      className="text-slate-300 hover:text-slate-600 disabled:opacity-30 transition-colors"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => apt.current_booking && toggleRow(apt.id)}
                    className="text-slate-400"
                    disabled={!apt.current_booking}
                  >
                    {apt.current_booking && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900 truncate">{apt.name}</h3>
                      <span className="text-xs font-extrabold text-indigo-900 shrink-0">{locName}</span>
                    </div>
                    {apt.current_booking ? (
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-sm font-extrabold text-slate-900 truncate">
                          {apt.current_booking.guest_name}
                        </p>
                        {apt.current_booking.guest_phone && (
                          <p className="text-sm font-extrabold text-blue-900 truncate" dir="ltr">
                            {apt.current_booking.guest_phone}
                          </p>
                        )}
                        <span className="text-xs font-extrabold text-rose-800" dir="ltr">
                          {formatDate(apt.current_booking.check_in)} → {formatDate(apt.current_booking.check_out)}
                        </span>
                        {apt.current_booking.source && (
                          <span className={`badge text-[10px] font-extrabold px-2 py-0.5 ${
                            apt.current_booking.source === 'airbnb' ? 'bg-airbnb text-white' :
                            apt.current_booking.source === 'gathern' ? 'bg-purple-600 text-white' :
                            'bg-whatsapp text-black'
                          }`}>
                            {SOURCE_LABELS[apt.current_booking.source]}
                          </span>
                        )}
                      </div>
                    ) : apt.maintenance_note ? (
                      <p className="text-xs text-orange-600 mt-0.5 truncate">{apt.maintenance_note}</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5">—</p>
                    )}
                  </div>

                  {apt.status === 'occupied' ? (
                    <span className="badge bg-emerald-600 text-white shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      {t('occupied')}
                    </span>
                  ) : apt.status === 'not_ready' ? (
                    <span className="badge bg-amber-500 text-white shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      {t('not_ready')}
                    </span>
                  ) : apt.status === 'ready' ? (
                    <span className="badge bg-sky-600 text-white shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      {t('ready')}
                    </span>
                  ) : (
                    <span className="badge bg-orange-600 text-white shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      {t('maintenance')}
                    </span>
                  )}

                  {(departureToday || departureTomorrow) && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold shrink-0">
                      <AlertCircle size={14} />
                      {departureToday ? 'خروج اليوم' : 'خروج غداً'}
                    </div>
                  )}

                  <div className="flex gap-1 shrink-0">
                    {apt.current_booking?.guest_phone && (
                      <button
                        onClick={() => setWhatsappModal({ apt, booking: apt.current_booking! })}
                        className="p-1.5 rounded-lg text-whatsapp-dark hover:bg-whatsapp/10 transition-colors"
                      >
                        <MessageCircle size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => setStatusModal(apt)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                </div>

                {expanded && apt.current_booking && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-100 animate-slide-down">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                      {apt.current_booking.source === 'whatsapp' && apt.current_booking.payment_method && (
                        <DetailItem
                          label={t('payment_method')}
                          value={({ cash: t('cash'), bank_transfer: t('bank_transfer'), visa: t('visa'), mada: t('mada') } as Record<string, string>)[apt.current_booking.payment_method] ?? '—'}
                        />
                      )}
                      {apt.current_booking.source === 'whatsapp' && apt.current_booking.total_price != null && (
                        <DetailItem label={t('total_price')} value={`${apt.current_booking.total_price} ر.س`} />
                      )}
                      {apt.current_booking.source === 'whatsapp' && apt.current_booking.balance > 0 && (
                        <DetailItem label={t('balance')} value={`${apt.current_booking.balance} ر.س`} />
                      )}
                      {apt.current_booking.notes && (
                        <DetailItem label={t('notes')} value={apt.current_booking.notes} />
                      )}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setConfirmCheckout(apt)} className="btn-danger flex-1">
                        <AlertCircle size={16} />
                        خروج الضيف وأرشفة
                      </button>
                      <button onClick={() => setExtendModal(apt)} className="btn bg-sky-100 text-sky-700 hover:bg-sky-200">
                        <CalendarPlus size={16} />
                        تمديد
                      </button>
                      <button onClick={() => setBookingModal({ apt, editing: true })} className="btn-secondary">
                        <Edit size={16} />
                        {t('edit_booking')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="card p-12 text-center">
              <p className="text-slate-400">{t('no_apartments')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-1">
          {filtered.map((apt, idx) => {
            const departureActive = apt.current_booking && isDepartureActive(apt.current_booking.check_out);
            const departureToday = apt.current_booking && isDepartureToday(apt.current_booking.check_out);
            const departureTomorrow = apt.current_booking && isDepartureTomorrow(apt.current_booking.check_out);
            const expanded = expandedRows.has(apt.id);
            let cardClass = 'card p-1 cursor-pointer';
            if (departureActive) cardClass += ' row-red pulse-red';
            else if (departureTomorrow) cardClass += ' row-amber';
            else if (apt.status === 'occupied') cardClass += ' row-occupied';
            else if (apt.status === 'not_ready') cardClass += ' row-gray';
            else if (apt.status === 'maintenance') cardClass += ' row-yellow';

            return (
              <div key={apt.id} className={cardClass} onClick={() => apt.current_booking && toggleRow(apt.id)}>
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-[10px] font-extrabold text-slate-900 truncate flex-1">{apt.name}</h3>
                  <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleMoveOrder(apt, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                      <ArrowUp size={8} />
                    </button>
                    <button onClick={() => handleMoveOrder(apt, 'down')} disabled={idx === filtered.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                      <ArrowDown size={8} />
                    </button>
                  </div>
                </div>
                <p className="text-[9px] font-extrabold text-indigo-900 mb-0.5 truncate leading-none">{apt.location?.name ?? '—'}</p>
                {apt.current_booking ? (
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-extrabold text-slate-900 truncate leading-tight">{apt.current_booking.guest_name}</p>
                    <p className="text-[9px] font-extrabold text-rose-800 truncate leading-none" dir="ltr">{formatDate(apt.current_booking.check_in)} → {formatDate(apt.current_booking.check_out)}</p>
                    {apt.current_booking.source && (
                      <span className={`badge text-[8px] font-extrabold px-1 py-0 ${
                        apt.current_booking.source === 'airbnb' ? 'bg-airbnb text-white' :
                        apt.current_booking.source === 'gathern' ? 'bg-purple-600 text-white' :
                        'bg-whatsapp text-black'
                      }`}>
                        {SOURCE_LABELS[apt.current_booking.source]}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[9px] text-slate-500">—</p>
                )}
                <div className="flex items-center justify-between mt-1" onClick={(e) => e.stopPropagation()}>
                  {apt.status === 'occupied' ? (
                    <span className="badge bg-emerald-600 text-white text-[7px] px-1 py-0">
                      {t('occupied')}
                    </span>
                  ) : apt.status === 'not_ready' ? (
                    <span className="badge bg-amber-500 text-white text-[7px] px-1 py-0">
                      {t('not_ready')}
                    </span>
                  ) : apt.status === 'ready' ? (
                    <span className="badge bg-sky-600 text-white text-[7px] px-1 py-0">
                      {t('ready')}
                    </span>
                  ) : (
                    <span className="badge bg-orange-600 text-white text-[7px] px-1 py-0">
                      {t('maintenance')}
                    </span>
                  )}
                  <div className="flex gap-0.5">
                    {apt.current_booking?.guest_phone && (
                      <button onClick={() => setWhatsappModal({ apt, booking: apt.current_booking! })} className="p-0.5 rounded text-whatsapp-dark hover:bg-whatsapp/10">
                        <MessageCircle size={10} />
                      </button>
                    )}
                    <button onClick={() => setStatusModal(apt)} className="p-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white/50">
                      <Edit size={10} />
                    </button>
                  </div>
                </div>

                {expanded && apt.current_booking && (
                  <div className="mt-1 pt-1 border-t border-slate-200/50 space-y-1 animate-slide-down" onClick={(e) => e.stopPropagation()}>
                    {apt.current_booking.guest_phone && (
                      <p className="text-[9px] font-extrabold text-blue-900 leading-none" dir="ltr">{apt.current_booking.guest_phone}</p>
                    )}
                    {apt.current_booking.source === 'whatsapp' && apt.current_booking.total_price != null && (
                      <p className="text-[9px] font-extrabold text-emerald-800 leading-none">السعر: {apt.current_booking.total_price} ر.س</p>
                    )}
                    {apt.current_booking.source === 'whatsapp' && apt.current_booking.balance > 0 && (
                      <p className="text-[9px] font-extrabold text-red-700 leading-none">رصيد: {apt.current_booking.balance} ر.س</p>
                    )}
                    {apt.current_booking.notes && (
                      <p className="text-[8px] text-slate-600 truncate leading-none">{apt.current_booking.notes}</p>
                    )}
                    <div className="flex gap-0.5 pt-0.5">
                      <button onClick={() => setConfirmCheckout(apt)} className="btn-danger flex-1 text-[8px] px-1 py-1">
                        <AlertCircle size={9} />
                        خروج
                      </button>
                      <button onClick={() => setExtendModal(apt)} className="btn bg-sky-100 text-sky-700 hover:bg-sky-200 text-[8px] px-1 py-1">
                        <CalendarPlus size={9} />
                        تمديد
                      </button>
                      <button onClick={() => setBookingModal({ apt, editing: true })} className="btn-secondary text-[8px] px-1 py-1">
                        <Edit size={9} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full card p-12 text-center">
              <p className="text-slate-400">{t('no_apartments')}</p>
            </div>
          )}
        </div>
      )}

      {confirmCheckout && (
        <Modal isOpen onClose={() => setConfirmCheckout(null)} title="تأكيد الخروج" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-700 text-center font-semibold">
              هل أنت متأكد من رغبتك في تسجيل الخروج وتأكيد هذه الخطوة؟
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmCheckout(null)} className="btn-secondary flex-1">إلغاء</button>
              <button
                onClick={() => handleQuickCheckout(confirmCheckout)}
                disabled={checkoutLoading === confirmCheckout.id}
                className="btn-danger flex-1"
              >
                {checkoutLoading === confirmCheckout.id ? '...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {statusModal && (
        <StatusModal isOpen={!!statusModal} onClose={() => setStatusModal(null)} apartment={statusModal} />
      )}
      {whatsappModal && (
        <WhatsAppModal
          isOpen={!!whatsappModal}
          onClose={() => setWhatsappModal(null)}
          apartment={whatsappModal.apt}
          booking={whatsappModal.booking}
          location={whatsappModal.apt.location ?? null}
        />
      )}
      {groupWhatsappOpen && (
        <GroupWhatsAppModal
          isOpen={groupWhatsappOpen}
          onClose={() => setGroupWhatsappOpen(false)}
          apartments={apartments}
          locations={locations}
        />
      )}
      <BookingModal
        isOpen={!!bookingModal}
        onClose={() => { setBookingModal(null); triggerRefresh(); }}
        apartment={bookingModal?.apt ?? null}
        apartments={apartments}
        locations={locations}
        bookings={bookings}
        editingBooking={bookingModal?.editing && bookingModal.apt?.current_booking ? {
          id: bookingModal.apt.current_booking.id,
          guest_name: bookingModal.apt.current_booking.guest_name,
          guest_phone: bookingModal.apt.current_booking.guest_phone,
          source: bookingModal.apt.current_booking.source,
          check_in: bookingModal.apt.current_booking.check_in,
          check_out: bookingModal.apt.current_booking.check_out,
          total_price: bookingModal.apt.current_booking.total_price,
          balance: bookingModal.apt.current_booking.balance,
          paid: bookingModal.apt.current_booking.paid,
          payment_method: bookingModal.apt.current_booking.payment_method,
          notes: bookingModal.apt.current_booking.notes,
          apartment_id: bookingModal.apt.id,
        } : null}
      />
      <ManageModal
        isOpen={manageOpen}
        onClose={() => setManageOpen(false)}
        apartments={apartments}
        locations={locations}
      />
      <ExtendModal
        isOpen={!!extendModal}
        onClose={() => setExtendModal(null)}
        apartment={extendModal}
        bookings={bookings}
      />
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
    </div>
  );
}
