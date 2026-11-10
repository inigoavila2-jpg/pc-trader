import { handleNavigationTool } from "./tools/navigation.js";
import { handleNetWorthTool } from "./tools/netWorth.js";
import { handleBusinessTool } from "./tools/business.js";
import { handleHistoryTool } from "./tools/history.js";
import { handleActionsTool } from "./tools/actions.js";

const handlers = [handleNavigationTool, handleBusinessTool, handleHistoryTool, handleActionsTool];

export async function executeChatTool(toolName, toolInput, context) {
  try {
    if (toolName === 'calculate_net_worth_growth') return await handleNetWorthTool(toolInput, context.liveState);
    for (const handler of handlers) {
      const result = await handler(toolName, toolInput, context);
      if (result !== undefined) return result;
    }
    return `Unknown tool: ${toolName}`;
  } catch (err) {
    console.error(`Error executing tool ${toolName}:`, err);
    return `Error running ${toolName}: ${err.message}`;
  }
}
