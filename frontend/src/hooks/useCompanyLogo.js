import { useState, useEffect, useRef } from 'react';
import { companyAPI } from '../services/api';

// ============================================================
// LAYER 1: Module-level memory cache (instant for same session)
// ============================================================
let cachedLogoUrl = null;
let fetchPromise = null;
let fetchFailed = false;

// ============================================================
// LAYER 2: localStorage cache (instant across page reloads)
// ============================================================
const LOGO_CACHE_KEY = 'imeetpro_logo_url';
const LOGO_CACHE_EXPIRY_KEY = 'imeetpro_logo_expiry';
const CACHE_DURATION_MS = 50 * 60 * 1000; // 50 minutes (presigned URL lasts 60 min)

function getLocalStorageCache() {
  try {
    const url = localStorage.getItem(LOGO_CACHE_KEY);
    const expiry = localStorage.getItem(LOGO_CACHE_EXPIRY_KEY);
    if (url && expiry && Date.now() < parseInt(expiry, 10)) {
      return url;
    }
    // Expired or missing — clear it
    localStorage.removeItem(LOGO_CACHE_KEY);
    localStorage.removeItem(LOGO_CACHE_EXPIRY_KEY);
    return null;
  } catch {
    return null;
  }
}

function setLocalStorageCache(url) {
  try {
    localStorage.setItem(LOGO_CACHE_KEY, url);
    localStorage.setItem(LOGO_CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION_MS));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

// ============================================================
// LAYER 3: Preload image into browser cache
// ============================================================
function preloadImage(url) {
  const img = new Image();
  img.src = url;
}

// ============================================================
// Initialize from localStorage on module load (before any render)
// ============================================================
if (!cachedLogoUrl) {
  const stored = getLocalStorageCache();
  if (stored) {
    cachedLogoUrl = stored;
    preloadImage(stored); // Start downloading immediately
  }
}

export const useCompanyLogo = (filename = 'IMeetPro.png') => {
  const [logoUrl, setLogoUrl] = useState(cachedLogoUrl);
  const [loading, setLoading] = useState(!cachedLogoUrl);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Already have a cached URL — use it instantly
    if (cachedLogoUrl) {
      setLogoUrl(cachedLogoUrl);
      setLoading(false);

      // Background refresh if cache is older than 45 minutes
      const expiry = localStorage.getItem(LOGO_CACHE_EXPIRY_KEY);
      const remaining = expiry ? parseInt(expiry, 10) - Date.now() : 0;
      if (remaining < 5 * 60 * 1000) {
        // Less than 5 min left — silently refresh in background
        companyAPI.getCompanyLogo(filename).then((url) => {
          if (url && mounted.current) {
            cachedLogoUrl = url;
            setLocalStorageCache(url);
            preloadImage(url);
            setLogoUrl(url);
          }
        }).catch(() => {});
      }
      return;
    }

    // No cache — fetch from API
    if (fetchFailed) {
      fetchPromise = null;
      fetchFailed = false;
    }

    if (!fetchPromise) {
      fetchPromise = companyAPI.getCompanyLogo(filename);
    }

    fetchPromise
      .then((url) => {
        if (!mounted.current) return;
        if (url) {
          cachedLogoUrl = url;
          setLocalStorageCache(url);
          preloadImage(url);
          setLogoUrl(url);
          fetchFailed = false;
        } else {
          fetchFailed = true;
          fetchPromise = null;
        }
        setLoading(false);
      })
      .catch(() => {
        if (!mounted.current) return;
        fetchFailed = true;
        fetchPromise = null;
        setLoading(false);
      });

    return () => { mounted.current = false; };
  }, [filename]);

  return { logoUrl, loading };
};

export const getCompanyLogoUrl = async (filename = 'IMeetPro.png') => {
  if (cachedLogoUrl) return cachedLogoUrl;
  const stored = getLocalStorageCache();
  if (stored) {
    cachedLogoUrl = stored;
    return stored;
  }
  const url = await companyAPI.getCompanyLogo(filename);
  if (url) {
    cachedLogoUrl = url;
    setLocalStorageCache(url);
  }
  return url;
};