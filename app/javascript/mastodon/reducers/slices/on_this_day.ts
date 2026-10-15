import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import {
  importFetchedAccounts,
  importFetchedStatuses,
} from '@/mastodon/actions/importer';
import type { ApiOnThisDayState } from '@/mastodon/api/on_this_day';
import {
  apiGetOnThisDayState,
  apiGetOnThisDay,
} from '@/mastodon/api/on_this_day';
import { onThisDay as initialOnThisDay } from '@/mastodon/initial_state';
import {
  createAppThunk,
  createAppAsyncThunk,
} from '@/mastodon/store/typed_functions';
import { getOnThisDayDate } from '@/mastodon/utils/on_this_day';

interface OnThisDaySliceState {
  state?: ApiOnThisDayState;
  date?: string;
  data?: { years: Record<string, string[]> };
  error: boolean;
  stateRequestId?: string;
  dataRequestId?: string;
  checkedAt?: number;
  failures: number;
}

const initialState: OnThisDaySliceState = {
  state: initialOnThisDay?.state,
  date: initialOnThisDay?.date,
  error: false,
  failures: 0,
};

const onThisDaySlice = createSlice({
  name: 'onThisDay',
  initialState,
  reducers: {
    resetForDate(state, action: PayloadAction<string>) {
      state.date = action.payload;
      state.state = state.state === 'disabled' ? 'disabled' : 'pending';
      state.data = undefined;
      state.error = false;
      state.stateRequestId = undefined;
      state.dataRequestId = undefined;
      state.failures = 0;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchOnThisDayState.pending, (state, action) => {
        state.stateRequestId = action.meta.requestId;
      })
      .addCase(fetchOnThisDayState.fulfilled, (state, action) => {
        if (state.stateRequestId !== action.meta.requestId) return;
        state.stateRequestId = undefined;
        state.checkedAt = Date.now();
        // A response sent just before midnight must not restore yesterday.
        if (action.payload.date !== getOnThisDayDate()) {
          state.failures += 1;
          return;
        }
        if (
          state.date !== action.payload.date ||
          action.payload.state !== 'ready'
        ) {
          state.data = undefined;
          state.dataRequestId = undefined;
        }
        state.state = action.payload.state;
        state.date = action.payload.date;
        state.error = false;
        state.failures = 0;
      })
      .addCase(fetchOnThisDayState.rejected, (state, action) => {
        if (state.stateRequestId !== action.meta.requestId) return;
        state.stateRequestId = undefined;
        state.checkedAt = Date.now();
        state.error = true;
        state.failures += 1;
      })
      .addCase(fetchOnThisDayData.pending, (state, action) => {
        state.dataRequestId = action.meta.requestId;
      })
      .addCase(fetchOnThisDayData.fulfilled, (state, action) => {
        if (state.dataRequestId !== action.meta.requestId) return;
        state.dataRequestId = undefined;
        if (
          action.payload.date !== state.date ||
          action.payload.date !== getOnThisDayDate()
        )
          return;
        state.data = action.payload.data;
        state.state = Object.values(action.payload.data.years).some(
          (ids) => ids.length > 0,
        )
          ? 'ready'
          : 'empty';
        state.error = false;
      })
      .addCase(fetchOnThisDayData.rejected, (state, action) => {
        if (state.dataRequestId !== action.meta.requestId) return;
        state.dataRequestId = undefined;
        state.error = true;
      });
  },
});

export const onThisDay = onThisDaySlice.reducer;
export const { resetForDate } = onThisDaySlice.actions;

export const checkOnThisDay = createAppThunk(
  `${onThisDaySlice.name}/checkOnThisDay`,
  (force: boolean, { dispatch, getState }) => {
    const today = getOnThisDayDate();
    const previousDate = getState().onThisDay.date;
    if (previousDate !== today) dispatch(resetForDate(today));
    const { state, error, failures } = getState().onThisDay;
    if (
      force ||
      previousDate !== today ||
      !state ||
      state === 'pending' ||
      error ||
      failures > 0
    ) {
      void dispatch(fetchOnThisDayState());
    }
  },
);

export const fetchOnThisDayState = createAppAsyncThunk(
  'onThisDay/fetchOnThisDayState',
  async (_, { rejectWithValue }) => {
    try {
      return await apiGetOnThisDayState();
    } catch (error) {
      // Background polling has its own retry path, without repeated alert toasts.
      return rejectWithValue({ error, skipAlert: true });
    }
  },
  { condition: (_, { getState }) => !getState().onThisDay.stateRequestId },
);

export const fetchOnThisDayData = createAppAsyncThunk(
  'onThisDay/fetchOnThisDayData',
  async (_, { dispatch, getState, requestId, rejectWithValue }) => {
    try {
      const data = await apiGetOnThisDay();
      const current = getState().onThisDay;
      if (
        current.dataRequestId === requestId &&
        current.date === data.date &&
        data.date === getOnThisDayDate()
      ) {
        dispatch(importFetchedStatuses(data.statuses));
        dispatch(importFetchedAccounts(data.accounts));
      }
      return data;
    } catch (error) {
      return rejectWithValue({ error, skipAlert: true });
    }
  },
  {
    condition: (_, { getState }) => {
      const { dataRequestId, date, state } = getState().onThisDay;
      return !dataRequestId && date === getOnThisDayDate() && state === 'ready';
    },
  },
);
