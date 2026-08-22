'use client';

import { useState } from 'react';

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY;

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const inputCls =
  'w-full rounded-xl border border-hairline bg-[#0b0d10] px-4 py-3.5 text-[15px] text-parchment placeholder:text-stone/50 outline-none transition-colors focus:border-brass';

/**
 * The pilot form — submits through Web3Forms (key via NEXT_PUBLIC_WEB3FORMS_KEY,
 * see .env.example). If the key isn't configured the form says so honestly
 * instead of pretending to send.
 */
export function PilotForm() {
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ACCESS_KEY) return;
    setState('submitting');
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    data.append('access_key', ACCESS_KEY);
    data.append('subject', 'geosteps — pilot request');
    data.append('from_name', 'geosteps landing page');
    try {
      const res = await fetch(WEB3FORMS_ENDPOINT, { method: 'POST', body: data });
      const json = await res.json();
      if (json.success) {
        setState('success');
        form.reset();
      } else {
        throw new Error(json.message ?? 'Submission was rejected.');
      }
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Something went wrong sending the form.');
    }
  };

  if (state === 'success') {
    return (
      <div className="rounded-2xl border border-moss/30 bg-moss-deep/25 p-8 text-center" data-testid="pilot-success">
        <div className="mb-2 font-display text-2xl text-parchment">Thank you — we&rsquo;ll write back soon.</div>
        <p className="text-sm leading-relaxed text-stone">
          Your note went straight to the team. Expect a reply about a pilot walkthrough, not a
          mailing list.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="text-left" data-testid="pilot-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="name" required placeholder="Your name" aria-label="Your name" className={inputCls} />
        <input name="email" type="email" required placeholder="Email" aria-label="Email" className={inputCls} />
      </div>
      <input
        name="museum"
        required
        placeholder="Museum or site"
        aria-label="Museum or site"
        className={`${inputCls} mt-4`}
      />
      <textarea
        name="message"
        rows={4}
        placeholder="Tell us a little about your space and your languages…"
        aria-label="Message"
        className={`${inputCls} mt-4 resize-y`}
      />
      {/* honeypot */}
      <input type="checkbox" name="botcheck" tabIndex={-1} className="hidden" aria-hidden />

      {!ACCESS_KEY && (
        <p className="mt-4 rounded-xl border border-brass/30 bg-panel px-4 py-3 text-[13px] leading-relaxed text-brass">
          The form isn&rsquo;t wired up yet — set <code className="font-mono">NEXT_PUBLIC_WEB3FORMS_KEY</code>{' '}
          (see .env.example) and it will deliver straight to the team&rsquo;s inbox.
        </p>
      )}
      {state === 'error' && (
        <p className="mt-4 rounded-xl border border-ember/40 bg-ember-deep/40 px-4 py-3 text-[13px] leading-relaxed text-parchment">
          Sending failed: {error} — please try again in a moment.
        </p>
      )}

      <button
        type="submit"
        disabled={!ACCESS_KEY || state === 'submitting'}
        className="mt-6 w-full rounded-xl bg-brass px-6 py-4 text-[15px] font-semibold text-ink shadow-[0_12px_40px_-14px_rgba(210,162,76,.7)] transition-colors hover:bg-brass-bright disabled:opacity-50 sm:w-auto"
      >
        {state === 'submitting' ? 'Sending…' : 'Request a pilot'}
      </button>
      <p className="mt-4 text-xs leading-relaxed text-stone/85">
        Goes straight to the team — no mailing lists, no trackers.
      </p>
    </form>
  );
}
