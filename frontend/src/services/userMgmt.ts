import { resolveBaseUrl } from './url';

const USER_MGMT_BASE_URL = resolveBaseUrl(import.meta.env.VITE_USER_MGMT_BASE_URL);

export const buildUserMgmtUrl = (
  path: string,
  returnTo?: string,
  extraParams?: Record<string, string | undefined>
) => {
  const url = new URL(
    path.replace(/^\//, ''),
    USER_MGMT_BASE_URL.endsWith('/') ? USER_MGMT_BASE_URL : `${USER_MGMT_BASE_URL}/`
  );
  if (returnTo) {
    url.searchParams.set('returnTo', returnTo);
  }
  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }
  return url.toString();
};
