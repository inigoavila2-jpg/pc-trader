import { createNetWorthContext } from "./netWorthContext.js";
import { analyzeNetWorth } from "./analyzeNetWorth.js";

export async function handleNetWorthTool(toolInput, liveState) {
  const context = await createNetWorthContext(liveState);
  return analyzeNetWorth(toolInput, context);
}
