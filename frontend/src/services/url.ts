export const resolveBaseUrl = (value?: string) => {
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
};
