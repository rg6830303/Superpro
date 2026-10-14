"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";

/**
 * Themed replacements for the browser's own pickers, platform-wide.
 *
 * Native <select> menus and date/time pickers cannot be styled, so taps on them
 * are taken over: the fields ignore the pointer (CSS below), a document-level
 * click finds which field was tapped, and a club-styled sheet opens instead.
 * The choice is written back through the native value setter plus input and
 * change events, so every existing form, React-controlled or not, keeps working
 * untouched. Keyboard use (Tab, arrows, typing a date) stays native.
 */

type Field = HTMLSelectElement | HTMLInputElement;
const PICKABLE =
  'select:not([multiple]):not([disabled]):not([data-native]), input[type="date"]:not([disabled]):not([readonly]):not([data-native]), input[type="time"]:not([disabled]):not([readonly]):not([data-native]), input[type="datetime-local"]:not([disabled]):not([readonly]):not([data-native])';

function commit(el: Field, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.focus({ preventScroll: true });
}

function labelFor(el: Field): string {
  const id = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
  const text = (id as HTMLElement | null)?.innerText || el.closest("label")?.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
  return text.split("\n")[0].trim().slice(0, 60) || (el instanceof HTMLSelectElement ? "Choose an option" : "Pick a date");
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ThemedPickers() {
  const [field, setField] = useState<Field | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || (e.clientX === 0 && e.clientY === 0)) return;
      if ((e.target as Element | null)?.closest?.(".tp-sheet")) return;
      const hit = [...document.querySelectorAll<Field>(PICKABLE)].find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      if (!hit) return;
      e.preventDefault();
      setField(hit);
    };
    // Enter / Space / Alt+Down on a focused select would open the native menu.
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as Element | null;
      if (!(el instanceof HTMLSelectElement) || !el.matches(PICKABLE)) return;
      if (e.key === "Enter" || e.key === " " || (e.altKey && e.key === "ArrowDown")) {
        e.preventDefault();
        setField(el);
      }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (field && !d.open) d.showModal();
    if (!field && d.open) d.close();
  }, [field]);

  const close = useCallback(() => setField(null), []);
  const choose = useCallback(
    (v: string) => {
      if (field) commit(field, v);
      setField(null);
    },
    [field],
  );

  return (
    <dialog ref={dialog} className="tp-sheet" onCancel={close} onClick={(e) => e.target === e.currentTarget && close()} aria-label={field ? labelFor(field) : "Picker"}>
      {field && (
        <div className="tp-panel">
          <div className="tp-head">
            <p>{labelFor(field)}</p>
            <button type="button" onClick={close} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          {field instanceof HTMLSelectElement ? (
            <OptionList select={field} onChoose={choose} />
          ) : field.type === "date" ? (
            <DatePicker input={field} onChoose={choose} onClear={field.required ? undefined : () => choose("")} />
          ) : field.type === "time" ? (
            <TimePicker input={field} onChoose={choose} />
          ) : (
            <DateTimePicker input={field} onChoose={choose} />
          )}
        </div>
      )}
    </dialog>
  );
}

function OptionList({ select, onChoose }: { select: HTMLSelectElement; onChoose: (v: string) => void }) {
  const groups = useMemo(() => {
    const out: Array<{ label: string | null; options: Array<{ value: string; text: string; disabled: boolean }> }> = [];
    for (const child of [...select.children]) {
      if (child instanceof HTMLOptGroupElement) {
        out.push({ label: child.label, options: [...child.querySelectorAll("option")].map((o) => ({ value: o.value, text: o.text, disabled: o.disabled || child.disabled })) });
      } else if (child instanceof HTMLOptionElement) {
        const last = out[out.length - 1];
        const opt = { value: child.value, text: child.text, disabled: child.disabled };
        if (last && last.label === null) last.options.push(opt);
        else out.push({ label: null, options: [opt] });
      }
    }
    return out;
  }, [select]);
  const total = groups.reduce((n, g) => n + g.options.length, 0);
  const [q, setQ] = useState("");
  const current = select.value;
  return (
    <>
      {total > 10 && (
        <label className="tp-search">
          <Search size={15} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search options" data-native />
        </label>
      )}
      <div className="tp-list" role="listbox">
        {groups.map((g, gi) => {
          const opts = g.options.filter((o) => !q || o.text.toLowerCase().includes(q.toLowerCase()));
          if (!opts.length) return null;
          return (
            <div key={gi}>
              {g.label && <p className="tp-group">{g.label}</p>}
              {opts.map((o) => {
                const selected = o.value === current;
                const placeholder = o.value === "" ;
                return (
                  <button
                    key={`${o.value}-${o.text}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={o.disabled}
                    className={placeholder ? "is-placeholder" : undefined}
                    onClick={() => onChoose(o.value)}
                    autoFocus={selected && total <= 10}
                  >
                    <span>{o.text}</span>
                    {selected && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Calendar({ value, min, max, onPick }: { value: string; min?: string; max?: string; onPick: (v: string) => void }) {
  const selected = parseYmd(value);
  const [view, setView] = useState(() => {
    const base = selected ?? parseYmd(min ?? "") ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const today = ymd(new Date());
  const lead = (view.getDay() + 6) % 7; // weeks start on Monday
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ymd(new Date(view.getFullYear(), view.getMonth(), i + 1)))];
  const allowed = (d: string) => (!min || d >= min.slice(0, 10)) && (!max || d <= max.slice(0, 10));
  const shift = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));
  return (
    <div className="tp-cal">
      <div className="tp-cal-head">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <p>{MONTHS[view.getMonth()]} {view.getFullYear()}</p>
        <button type="button" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>
      <div className="tp-cal-grid">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d} className="tp-dow">{d}</span>)}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              disabled={!allowed(d)}
              aria-pressed={d === value.slice(0, 10)}
              className={d === today ? "is-today" : undefined}
              onClick={() => onPick(d)}
            >
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

function DatePicker({ input, onChoose, onClear }: { input: HTMLInputElement; onChoose: (v: string) => void; onClear?: () => void }) {
  const today = ymd(new Date());
  const ok = (!input.min || today >= input.min) && (!input.max || today <= input.max);
  return (
    <>
      <Calendar value={input.value} min={input.min} max={input.max} onPick={onChoose} />
      <div className="tp-foot">
        {onClear && <button type="button" className="tp-ghost" onClick={onClear}>Clear</button>}
        {ok && <button type="button" className="tp-ghost" onClick={() => onChoose(today)}>Today</button>}
      </div>
    </>
  );
}

function TimeColumns({ value, step, onChange }: { value: string; step: number; onChange: (v: string) => void }) {
  const [h, m] = (value || "18:00").split(":").map(Number);
  const hour12 = h % 12 || 12;
  const pm = h >= 12;
  const minuteStep = Math.max(1, Math.round(step / 60)) >= 60 ? 60 : Math.max(5, Math.round(step / 60) || 5);
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
  const set = (hh: number, mm: number, p: boolean) => onChange(`${pad((hh % 12) + (p ? 12 : 0))}:${pad(mm)}`);
  return (
    <div className="tp-time">
      <div className="tp-col" aria-label="Hour">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((x) => (
          <button key={x} type="button" aria-pressed={x === hour12} onClick={() => set(x, m || 0, pm)}>{x}</button>
        ))}
      </div>
      <div className="tp-col" aria-label="Minute">
        {minutes.map((x) => (
          <button key={x} type="button" aria-pressed={x === m} onClick={() => set(hour12, x, pm)}>{pad(x)}</button>
        ))}
      </div>
      <div className="tp-col tp-col-ampm" aria-label="AM or PM">
        {["AM", "PM"].map((x) => (
          <button key={x} type="button" aria-pressed={(x === "PM") === pm} onClick={() => set(hour12, m || 0, x === "PM")}>{x}</button>
        ))}
      </div>
    </div>
  );
}

function TimePicker({ input, onChoose }: { input: HTMLInputElement; onChoose: (v: string) => void }) {
  const [v, setV] = useState(input.value || "18:00");
  return (
    <>
      <TimeColumns value={v} step={Number(input.step) || 300} onChange={setV} />
      <div className="tp-foot">
        <button type="button" className="tp-primary" onClick={() => onChoose(v)}>Set {v}</button>
      </div>
    </>
  );
}

function DateTimePicker({ input, onChoose }: { input: HTMLInputElement; onChoose: (v: string) => void }) {
  const [date, setDate] = useState(input.value.slice(0, 10));
  const [time, setTime] = useState(input.value.slice(11, 16) || "18:00");
  return (
    <>
      <Calendar value={date} min={input.min} max={input.max} onPick={setDate} />
      <TimeColumns value={time} step={Number(input.step) || 300} onChange={setTime} />
      <div className="tp-foot">
        <button type="button" className="tp-primary" disabled={!date} onClick={() => onChoose(`${date}T${time}`)}>Done</button>
      </div>
    </>
  );
}
