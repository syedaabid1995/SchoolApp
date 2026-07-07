import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = {
  impersonatedByUserId?: string | null;
  impersonatedByRole?: string | null;
  impersonatedByEmail?: string | null;
};

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, callback: () => T) =>
  storage.run(context, callback);

export const getRequestContext = () => storage.getStore() ?? {};
