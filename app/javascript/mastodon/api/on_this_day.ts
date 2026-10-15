import api, { apiRequestGet } from '../api';
import type { ApiAccountJSON } from '../api_types/accounts';
import type { ApiStatusJSON } from '../api_types/statuses';

export type ApiOnThisDayState = 'ready' | 'empty' | 'pending' | 'disabled';

export interface ApiOnThisDayStateResponse {
  state: ApiOnThisDayState;
  date: string;
}

export const apiGetOnThisDayState = async () => {
  const response = await api().get<ApiOnThisDayStateResponse>(
    '/api/v1/on_this_day/state',
    { timeout: 15_000 },
  );
  return response.data;
};

export interface ApiOnThisDayResponse {
  date: string;
  data: { years: Record<string, string[]> };
  accounts: ApiAccountJSON[];
  statuses: ApiStatusJSON[];
}

export const apiGetOnThisDay = () =>
  apiRequestGet<ApiOnThisDayResponse>('v1/on_this_day', undefined, {
    timeout: 30_000,
  });
