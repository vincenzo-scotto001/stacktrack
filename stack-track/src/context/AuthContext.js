import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { detectCapabilities, getCaps } from '../api/core';
import { ensureOwnProfile, clearProfileCache } from '../api/profiles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still checking, null = signed out
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [caps, setCaps] = useState(getCaps());
  const [profileError, setProfileError] = useState(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session || null);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(next || null);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      clearProfileCache();
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setProfileError(null);
        const detected = await detectCapabilities();
        if (cancelled) return;
        setCaps(detected);
        const p = await ensureOwnProfile(session.user);
        if (!cancelled) setProfile(p);
      } catch (e) {
        if (!cancelled) setProfileError(e.message || "Couldn't load your profile.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when the signed-in user changes, not on token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearProfileCache();
    setProfile(null);
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    profile,
    setProfile,
    caps,
    profileError,
    recovering,
    setRecovering,
    loading: session === undefined || (!!session && !profile && !profileError),
    signOut,
  }), [session, profile, caps, profileError, recovering, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
