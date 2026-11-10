import { inventoryReducer } from "./inventoryReducer.js";
import { salesReducer } from "./salesReducer.js";
import { financeReducer } from "./financeReducer.js";

export function reducer(state, action) {
  for (const handle of [inventoryReducer, salesReducer, financeReducer]) {
    const next = handle(state, action);
    if (next !== undefined) return next;
  }
  return state;
}
