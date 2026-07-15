import type { MatchResult } from './matching';

// The in-progress voice order, handed from the recording screen to the review
// screen. Kept in plain module memory (not navigation params — those only
// carry strings, and this is a rich object). Cleared after checkout.
export type OrderDraft = {
  storeId: string;
  transcript: string;
  audioUri: string | null;
  results: MatchResult[];
};

let current: OrderDraft | null = null;

export const setOrderDraft = (draft: OrderDraft) => {
  current = draft;
};
export const getOrderDraft = () => current;
export const clearOrderDraft = () => {
  current = null;
};
