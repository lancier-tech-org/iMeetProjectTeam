import { useState, useEffect } from 'react';
import { companyAPI } from '../services/api';

let cachedLogoUrl = null;
let fetchPromise = null;
let fetchFailed = false;

export const useCompanyLogo = (filename = 'IMeetPro.png') => {
  const [logoUrl, setLogoUrl] = useState(cachedLogoUrl);
  const [loading, setLoading] = useState(!cachedLogoUrl);

  useEffect(() => {
    if (cachedLogoUrl) {
      setLogoUrl(cachedLogoUrl);
      setLoading(false);
      return;
    }

    // CRITICAL FIX: Reset promise if previous fetch failed so it retries
    if (fetchFailed) {
      fetchPromise = null;
      fetchFailed = false;
    }

    if (!fetchPromise) {
      fetchPromise = companyAPI.getCompanyLogo(filename);
    }

    fetchPromise
      .then((url) => {
        if (url) {
          console.log('✅ useCompanyLogo: Logo cached successfully');
          cachedLogoUrl = url;
          setLogoUrl(url);
          fetchFailed = false;
        } else {
          console.warn('⚠️ useCompanyLogo: No URL returned, will retry next mount');
          fetchFailed = true;
          fetchPromise = null;
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('❌ useCompanyLogo: Fetch failed:', err);
        fetchFailed = true;
        fetchPromise = null;
        setLoading(false);
      });
  }, [filename]);

  return { logoUrl, loading };
};

export const getCompanyLogoUrl = async (filename = 'IMeetPro.png') => {
  if (cachedLogoUrl) return cachedLogoUrl;
  const url = await companyAPI.getCompanyLogo(filename);
  if (url) cachedLogoUrl = url;
  return url;
};