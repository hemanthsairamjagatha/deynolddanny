import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  $consent,
  $consentDialogOpen,
  acceptAllConsent,
  acceptEssentialOnly,
  closeConsentPreferences,
  hasRecordedConsent,
  initConsentStore,
  openConsentPreferences,
  saveConsentPreferences
} from '../../../lib/consent/consent.store';

export const CookieConsentBanner: React.FC = () => {
  const consent = useStore($consent);
  const dialogOpen = useStore($consentDialogOpen);
  const [hydrated, setHydrated] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  useEffect(() => {
    const initial = initConsentStore();
    setAnalyticsEnabled(initial.analytics);
    setMarketingEnabled(initial.marketing);
    setHydrated(true);

    const handleOpenPreferences = () => openConsentPreferences();
    window.addEventListener('dd:open-consent-preferences', handleOpenPreferences);
    return () => {
      window.removeEventListener('dd:open-consent-preferences', handleOpenPreferences);
    };
  }, []);

  useEffect(() => {
    setAnalyticsEnabled(consent.analytics);
    setMarketingEnabled(consent.marketing);
  }, [consent]);

  useEffect(() => {
    if (!dialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeConsentPreferences();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialogOpen]);

  if (!hydrated) return null;

  const showBanner = !hasRecordedConsent(consent) && !dialogOpen;

  return (
    <>
      {showBanner && (
        <aside
          aria-label="Privacy and cookie preferences"
          className="fixed bottom-4 left-4 right-4 z-[900] mx-auto max-w-4xl border border-neutral-200 bg-white/95 p-4 text-neutral-900 shadow-lg backdrop-blur-md sm:p-5"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-xs leading-relaxed text-neutral-600">
              <p className="font-semibold uppercase tracking-[0.14em] text-neutral-900">
                Privacy &amp; Cookie Notice
              </p>
              <p>
                We use strictly necessary cookies for shopping bag security, session authentication, and fraud prevention.
                Optional analytics and personalised styling cookies stay disabled unless you choose to enable them under{' '}
                <a href="/legal/privacy-policy" className="underline underline-offset-2 hover:text-black">
                  our Privacy Policy
                </a>
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openConsentPreferences()}
                className="min-h-[40px] border border-neutral-300 bg-white px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-800 transition-colors hover:border-black hover:text-black"
              >
                Preferences
              </button>
              <button
                type="button"
                onClick={() => acceptEssentialOnly()}
                className="min-h-[40px] border border-neutral-900 bg-white px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-900 transition-colors hover:bg-neutral-100"
              >
                Essential Only
              </button>
              <button
                type="button"
                onClick={() => acceptAllConsent()}
                className="min-h-[40px] border border-neutral-900 bg-neutral-900 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
              >
                Accept All
              </button>
            </div>
          </div>
        </aside>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-[950] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConsentPreferences();
          }}
        >
          <div className="w-full max-w-lg border border-neutral-200 bg-white p-6 text-neutral-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
              <div>
                <h2 id="consent-dialog-title" className="text-sm font-semibold uppercase tracking-[0.14em]">
                  Privacy &amp; Consent Preferences
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Manage optional cookie categories in line with India DPDP notice standards.
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeConsentPreferences()}
                aria-label="Close privacy preferences"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center border border-transparent text-neutral-500 hover:border-neutral-300 hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="divide-y divide-neutral-200 py-2">
              <div className="flex items-start justify-between gap-4 py-3.5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider">Strictly Necessary</p>
                  <p className="mt-1 text-xs text-neutral-600">
                    Required for HttpOnly session continuity, checkout bag integrity, and CSRF/security protections.
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                  Always On
                </span>
              </div>

              <label className="flex cursor-pointer items-start justify-between gap-4 py-3.5">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider">Storefront Analytics</span>
                  <p className="mt-1 text-xs text-neutral-600">
                    Helps improve collection discovery, fit guidance, and navigation speed without selling personal data.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-neutral-900"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-4 py-3.5">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider">Personalised Editorial</span>
                  <p className="mt-1 text-xs text-neutral-600">
                    Used only if enabled for seasonal lookbook highlights and styling communications.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={marketingEnabled}
                  onChange={(e) => setMarketingEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-neutral-900"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
              <button
                type="button"
                onClick={() => acceptEssentialOnly()}
                className="min-h-[40px] border border-neutral-300 bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-800 hover:border-black"
              >
                Essential Only
              </button>
              <button
                type="button"
                onClick={() =>
                  saveConsentPreferences({
                    analytics: analyticsEnabled,
                    marketing: marketingEnabled
                  })
                }
                className="min-h-[40px] border border-neutral-900 bg-neutral-900 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-black"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CookieConsentBanner;
