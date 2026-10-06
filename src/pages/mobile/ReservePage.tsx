import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { translateApiError } from "@/lib/translateApiError";
import { useOperatingPeriods } from "@/context/OperatingPeriodsContext";
import { buildReservationSlots } from "@/lib/reservationSlots";
import { CaptchaImage } from "@/components/CaptchaImage";
import { CAPTCHA_LENGTH, randomCaptchaCode } from "@/lib/captcha";

function localTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hmToMinutes(hm: string): number {
  const p = hm.trim().split(":");
  const h = Number.parseInt(p[0] ?? "0", 10);
  const m = Number.parseInt(p[1] ?? "0", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function ReservePage() {
  const { t } = useTranslation();
  const { data: op } = useOperatingPeriods();
  const timeSlots = useMemo(() => buildReservationSlots(op), [op]);
  const minDate = useMemo(() => localTodayISO(), []);
  const [date, setDate] = useState(minDate);
  const [time, setTime] = useState("12:30");
  /** 当日剔除已过时时刻，与后端「不得早于当前时间」一致 */
  const visibleTimeSlots = useMemo(() => {
    if (!timeSlots.length) return [];
    if (date !== minDate) return timeSlots;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    return timeSlots.filter((s) => hmToMinutes(s) >= cur);
  }, [timeSlots, date, minDate]);
  const [party, setParty] = useState("2");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [captcha, setCaptcha] = useState(() => randomCaptchaCode());
  const [captchaInput, setCaptchaInput] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const noteChips = useMemo(
    () => [
      t("mobile.reserve.chipWindow"),
      t("mobile.reserve.chipQuiet"),
      t("mobile.reserve.chipChild"),
      t("mobile.reserve.chipBirthday"),
      t("mobile.reserve.chipAllergy"),
      t("mobile.reserve.chipStroller"),
    ],
    [t],
  );
  function appendNoteChip(chip: string) {
    const cur = note.trim();
    if (!cur) {
      setNote(chip);
      return;
    }
    if (cur.includes(chip)) return;
    setNote(`${cur}；${chip}`);
  }


  useEffect(() => {
    if (!visibleTimeSlots.length) return;
    if (!visibleTimeSlots.includes(time)) setTime(visibleTimeSlots[0]!);
  }, [visibleTimeSlots, time]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const digits = phone.replace(/\s/g, "");
    if (!name.trim() || !/^1\d{10}$/.test(digits)) {
      setErr(t("mobile.reserve.errContact"));
      return;
    }
    let partySize = Number.parseInt(party, 10);
    if (captchaInput.trim().toUpperCase() !== captcha) {
      setErr(t("mobile.reserve.errCaptcha"));
      setCaptcha(randomCaptchaCode());
      setCaptchaInput("");
      return;
    }
    if (party === "12+" || Number.isNaN(partySize)) partySize = 12;
    const noteFinal =
      party === "12+"
        ? [note.trim(), t("mobile.reserve.noteParty12")].filter(Boolean).join("\n")
        : note.trim() || null;

    setBusy(true);
    try {
      await apiFetch("/api/reservations", {
        method: "POST",
        json: {
          customer_name: name.trim(),
          phone: digits,
          reservation_date: date,
          time_slot: time,
          party_size: partySize,
          note: noteFinal,
        },
      });
      localStorage.setItem("rr_last_phone", digits);
      setDone(true);
    } catch (ex) {
      setErr(ex instanceof Error ? translateApiError(t, ex.message) : t("mobile.reserve.submitFail"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center animate-fade-up">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
          ✓
        </div>
        <h1 className="font-display text-xl font-semibold text-ink-900">{t("mobile.reserve.doneTitle")}</h1>
        <p className="mt-2 text-sm text-stone-600">{t("mobile.reserve.doneBody")}</p>
        <Link
          to="/me"
          className="mt-8 w-full max-w-xs rounded-2xl bg-brand-coral py-3 text-center text-sm font-semibold text-white"
        >
          {t("mobile.reserve.goMe")}
        </Link>
        <Link to="/" className="mt-3 text-sm text-stone-500 underline-offset-4 hover:underline">
          {t("mobile.reserve.backHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-up px-4 pb-8 pt-2">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-ink-900">{t("mobile.reserve.title")}</h1>
        <Link to="/" className="text-sm text-stone-500">
          {t("mobile.reserve.back")}
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-stone-200/80 bg-white p-5 shadow-soft">
        <label className="block">
          <span className="text-xs font-medium text-stone-500">{t("mobile.reserve.date")}</span>
          <input
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-cream-50 px-3 py-2.5 text-sm outline-none ring-brand-coral/0 transition focus:ring-2 focus:ring-brand-coral/40"
            required
          />
        </label>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block">
            <span className="text-xs font-medium text-stone-500">{t("mobile.reserve.captcha")}</span>
            <input
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              maxLength={CAPTCHA_LENGTH}
              autoComplete="off"
              placeholder={t("mobile.reserve.captchaPh", { n: CAPTCHA_LENGTH })}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-cream-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-coral/40"
              required
            />
          </label>
          <button
            type="button"
            title={t("mobile.reserve.refreshCaptcha")}
            onClick={() => setCaptcha(randomCaptchaCode())}
            className="mt-6 flex flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-0.5 shadow-inner"
          >
            <CaptchaImage code={captcha} width={136} height={48} />
          </button>
        </div>

        <div>
          <span className="text-xs font-medium text-stone-500">{t("mobile.reserve.time")}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleTimeSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setTime(slot)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  time === slot
                    ? "bg-ink-900 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
          {date === minDate && timeSlots.length > 0 && visibleTimeSlots.length === 0 ? (
            <p className="mt-2 text-xs text-amber-800">{t("mobile.reserve.noSlotsToday")}</p>
          ) : null}
        </div>

        <label className="block">
          <span className="text-xs font-medium text-stone-500">{t("mobile.reserve.party")}</span>
          <select
            value={party}
            onChange={(e) => setParty(e.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-cream-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-coral/40"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={String(n)}>
                {n}
                {t("mobile.reserve.guestsSuffix")}
              </option>
            ))}
            <option value="12+">{t("mobile.reserve.party12")}</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-stone-500">{t("mobile.reserve.contact")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("mobile.reserve.contactPh")}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-cream-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-coral/40"
            required
            autoComplete="name"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-stone-500">{t("mobile.reserve.phone")}</span>
          <input
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("mobile.reserve.phonePh")}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-cream-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-coral/40"
            required
            autoComplete="tel"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-stone-500">{t("mobile.reserve.note")}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {noteChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => appendNoteChip(chip)}
                className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-700 hover:bg-stone-100"
              >
                {chip}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={t("mobile.reserve.notePh")}
            className="mt-1 w-full resize-none rounded-xl border border-stone-200 bg-cream-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-coral/40"
          />
        </label>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-gradient-to-r from-brand-coral to-orange-600 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/15 active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? t("mobile.reserve.submitting") : t("mobile.reserve.submit")}
        </button>
      </form>
    </div>
  );
}
