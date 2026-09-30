import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function unfoldLines(text: string): string[] {
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (lines.length > 0) lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function parseICal(text: string): { start: string; end: string; summary: string; description: string }[] {
  const events: { start: string; end: string; summary: string; description: string }[] = [];
  const lines = unfoldLines(text);
  let current: { start: string; end: string; summary: string; description: string } | null = null;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      current = { start: "", end: "", summary: "", description: "" };
    } else if (line.startsWith("END:VEVENT") && current) {
      if (current.start && current.end) events.push(current);
      current = null;
    } else if (current) {
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const value = line.slice(colonIdx + 1).trim();
      if (line.startsWith("DTSTART")) current.start = value;
      else if (line.startsWith("DTEND")) current.end = value;
      else if (line.startsWith("SUMMARY")) current.summary = value;
      else if (line.startsWith("DESCRIPTION")) current.description = value;
    }
  }
  return events;
}

function parseICalDate(dateStr: string): string | null {
  const m = dateStr.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function extractGuestInfo(summary: string, description: string): { guestName: string; guestPhone: string | null } {
  let guestName = summary?.trim() || "";
  guestName = guestName.replace(/Airbnb\s*[-:]\s*/gi, "").replace(/Reservation\s*#?\d*/gi, "").trim();
  if (!guestName) guestName = "ضيف Airbnb";
  const phoneMatch = description?.match(/\+?\d[\d\s\-()]{7,}/);
  const guestPhone = phoneMatch ? phoneMatch[0].trim() : null;
  return { guestName, guestPhone };
}

async function fetchICal(url: string): Promise<string | null> {
  // Try direct fetch first (works from Deno server-side, no CORS)
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CalendarSync/1.0)" },
    });
    if (res.ok) {
      const text = await res.text();
      if (text.includes("BEGIN:VCALENDAR")) return text;
    }
  } catch { /* fall through to proxy */ }

  // Fallback: use allorigins proxy
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { redirect: "follow" });
    if (res.ok) {
      const text = await res.text();
      if (text.includes("BEGIN:VCALENDAR")) return text;
    }
  } catch { /* fall through to next proxy */ }

  // Fallback: corsproxy.io
  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { redirect: "follow" });
    if (res.ok) {
      const text = await res.text();
      if (text.includes("BEGIN:VCALENDAR")) return text;
    }
  } catch { /* all proxies failed */ }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: apartments, error: aptError } = await supabase
      .from("apartments")
      .select("id, name, ical_url, airbnb_listing_id, airbnb_account, location_id")
      .not("ical_url", "is", null);

    if (aptError) throw aptError;
    if (!apartments || apartments.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "لا توجد شقق مرتبطة بـ iCal", results: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSynced = 0;
    const results: { apartment: string; events: number; error?: string }[] = [];

    for (const apt of apartments) {
      try {
        if (!apt.ical_url) {
          results.push({ apartment: apt.name, events: 0 });
          continue;
        }

        const icalText = await fetchICal(apt.ical_url);
        if (!icalText) {
          results.push({ apartment: apt.name, events: 0, error: "تعذر جلب تقويم iCal" });
          continue;
        }

        const events = parseICal(icalText);
        const today = new Date().toISOString().split("T")[0];
        let bookingCount = 0;
        let activeBookingId: string | null = null;

        for (const evt of events) {
          const checkIn = parseICalDate(evt.start);
          const checkOut = parseICalDate(evt.end);
          if (!checkIn || !checkOut) continue;

          const { guestName, guestPhone } = extractGuestInfo(evt.summary, evt.description);

          const { data: existing } = await supabase
            .from("bookings")
            .select("id")
            .eq("apartment_id", apt.id)
            .eq("check_in", checkIn)
            .eq("source", "airbnb")
            .maybeSingle();

          let bookingId: string;

          if (existing) {
            bookingId = existing.id;
            await supabase
              .from("bookings")
              .update({ guest_name: guestName, guest_phone: guestPhone, check_out: checkOut })
              .eq("id", existing.id);
          } else {
            const { data: newBooking, error: insertError } = await supabase
              .from("bookings")
              .insert({
                apartment_id: apt.id,
                guest_name: guestName,
                guest_phone: guestPhone,
                source: "airbnb",
                check_in: checkIn,
                check_out: checkOut,
                balance: 0,
                paid: true,
              })
              .select("id")
              .single();

            if (insertError) {
              console.error(`Insert booking for ${apt.name}:`, insertError);
              continue;
            }
            bookingId = newBooking.id;
          }

          // Track if this booking is currently active (today is within check-in..check-out)
          if (checkIn <= today && checkOut > today) {
            activeBookingId = bookingId;
          }

          bookingCount++;
        }

        // Update apartment status only if a booking is currently active
        if (activeBookingId) {
          await supabase
            .from("apartments")
            .update({ status: "occupied", current_booking_id: activeBookingId })
            .eq("id", apt.id);
        }
        // Do NOT auto-change status to ready or auto-archive — that requires manual confirmation

        totalSynced += bookingCount;
        results.push({ apartment: apt.name, events: bookingCount });
      } catch (err) {
        results.push({ apartment: apt.name, events: 0, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ synced: totalSynced, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
