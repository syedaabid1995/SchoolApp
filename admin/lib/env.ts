import { getClientApiBaseUrl } from './platform-brand';

export const env = {
  get apiBaseUrl() {
    return getClientApiBaseUrl();
  },
};
