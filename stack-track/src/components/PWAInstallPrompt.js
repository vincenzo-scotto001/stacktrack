import React, { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/install';
import { useAuth } from '../context/AuthContext';

const DISMISS_KEY = 'pwaPromptDismissedAt';
const SNOOZE_DAYS = 21;

function snoozed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at && Date.now() - at < SNOOZE_DAYS * 86400000;
  } catch (e) {
    return false;
  }
}

/** Gentle "add to home screen" banner for signed-in players on phones. */
export default function PWAInstallPrompt() {
  const { session } = useAuth();
  const [ready, setReady] = useState(canPromptInstall());
  const [visible, setVisible] = useState(false);
  const ios = isIOS();

  useEffect(() => onInstallChange(() => setReady(canPromptInstall())), []);

  useEffect(() => {
    if (!session || isStandalone() || snoozed()) return undefined;
    if (!ready && !ios) return undefined;
    const t = setTimeout(() => setVisible(true), 20000);
    return () => clearTimeout(t);
  }, [session, ready, ios]);

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) { /* ignore */ }
    setVisible(false);
  };

  return (
    <div className="install-banner" role="dialog" aria-label="Install StackTrack">
      <span className="logo-chip" aria-hidden="true" />
      <p className="grow">
        {ios ? (
          <>Add StackTrack to your home screen: tap <Share size={15} className="inline-icon" aria-label="Share" /> then “Add to Home Screen”.</>
        ) : (
          'Install StackTrack for one-tap access at the table.'
        )}
      </p>
      {!ios && (
        <button type="button" className="btn btn-primary btn-sm" onClick={async () => { await promptInstall(); setVisible(false); }}>
          Install
        </button>
      )}
      <button type="button" className="icon-btn" onClick={dismiss} aria-label="Not now">
        <X size={18} />
      </button>
    </div>
  );
}
