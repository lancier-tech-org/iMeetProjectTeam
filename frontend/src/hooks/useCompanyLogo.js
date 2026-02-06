import { useState, useEffect } from 'react';
import { companyAPI } from '../services/api';

let cachedLogoUrl = null;
let fetchPromise = null;

export const useCompanyLogo = (filename = 'ImeetPro.png') => {
  const [logoUrl, setLogoUrl] = useState(cachedLogoUrl);
  const [loading, setLoading] = useState(!cachedLogoUrl);

  useEffect(() => {
    if (cachedLogoUrl) {
      setLogoUrl(cachedLogoUrl);
      setLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = companyAPI.getCompanyLogo(filename);
    }

    fetchPromise.then((url) => {
      if (url) {
        cachedLogoUrl = url;
        setLogoUrl(url);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [filename]);

  return { logoUrl, loading };
};

// For non-hook usage (e.g., in utility functions)
export const getCompanyLogoUrl = async (filename = 'ImeetPro.png') => {
  if (cachedLogoUrl) return cachedLogoUrl;
  const url = await companyAPI.getCompanyLogo(filename);
  if (url) cachedLogoUrl = url;
  return url;
};