export const toolsConfig = [
    {
      functionDeclarations: [
        {
          name: 'navigate_tabs',
          description: 'Change the active tab in the app. Valid tabs: Dashboard, Buy, Inventory, Builds, Sell, History, Settings.',
          parameters: {
            type: 'object',
            properties: { tabName: { type: 'string' } },
            required: ['tabName'],
          },
        },
        {
          name: 'pre_fill_buy_form',
          description: 'Populate the Buy form fields WITHOUT adding the item yet, so the user can review/edit before submitting themselves. Only use this if the user explicitly asks to "fill in the form" or "pre-fill" rather than asking you to add the item directly.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              cost: { type: 'number' },
              category: { type: 'string' },
              domain: { type: 'string', enum: ['pc', 'general'] },
              marketPrice: { type: 'number' },
            },
            required: ['name', 'cost'],
          },
        },
        {
          name: 'attach_photo_to_part',
          description: 'Attach a photo to an existing inventory item after the initial entry. Use the current turn image and update the matching part by item name or itemId.',
          parameters: {
            type: 'object',
            properties: {
              itemId: { type: 'string', description: 'Exact part ID if known' },
              itemName: { type: 'string', description: 'Part name or a partial match for the item to attach the photo to' },
            },
            required: ['itemName'],
          },
        },
        {
          name: 'attach_photo_to_sale',
          description: 'Attach a proof photo to an existing sale transaction after the sale has already been recorded. Use the current turn image and the exact saleId from find_sales.',
          parameters: {
            type: 'object',
            properties: {
              saleId: { type: 'string', description: 'Exact saleId from a prior find_sales call' },
              itemName: { type: 'string', description: 'Optional item name to help locate the sale if saleId is not known' },
            },
            required: ['saleId'],
          },
        },
        {
          name: 'add_item_to_inventory',
          description: 'Directly add a new item to inventory as available stock — this actually saves it, it does not just fill a form. Use this whenever the user says things like "add it", "add this to my inventory", "I bought this for X". If the user attached a photo in this turn, it is automatically attached to the new inventory item — you do not need to handle the image yourself, just describe what you saw in the image as part of the name/category. If you do not know the cost yet, ask the user before calling this.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Descriptive name, e.g. "AORUS GeForce RTX 5090 STEALTH ICE 32G"' },
              cost: { type: 'number', description: 'What the user paid PER UNIT' },
              marketPrice: { type: 'number', description: 'Current resale/market value per unit. Defaults to cost if not given.' },
              category: { type: 'string', description: 'GPU, CPU, Motherboard, CPU+MB, RAM, PSU, Storage, Cooler, Case, Monitor, or Other' },
              domain: { type: 'string', enum: ['pc', 'general'], description: '"pc" for PC parts, "general" for non-PC assets' },
              notes: { type: 'string', description: 'Any condition notes, extras, or details worth remembering' },
              quantity: { type: 'number', description: 'How many identical units were bought, e.g. 3 for "3 identical RAM sticks at 500 each". Defaults to 1. Each unit is tracked as its own separate inventory item so they can each be sold or built independently.' },
            },
            required: ['name', 'cost'],
          },
        },
        {
          name: 'query_pocketbase_inventory',
          description: 'Get a fresh snapshot of current available inventory as a JSON string — use this to answer stock questions like "how many GPUs do I have".',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'query_business_database',
          description: 'Search the complete business database snapshot, including inventory (available/sold/defective), bundles, builds, sales, cash-ledger transactions, expenses, settings, notes, and per-item history. Use this whenever the user asks about historical/current business records, transaction history, purchases, expenses, profits, cash movement, what happened to an item, bundle contents, build contents, or any record that is not answered by a simple inventory count. This tool reads /data, the same server endpoint backed by PocketBase, so it can see records beyond the small live-inventory summary.',
          parameters: {
            type: 'object',
            properties: {
              scope: { type: 'string', enum: ['summary','inventory','sales','transactions','expenses','bundles','builds','item_history','quick_notes','all'] },
              query: { type: 'string', description: 'Optional free-text search across names, descriptions, buyers, notes, sources, bundle names, build names, and transaction descriptions.' },
              limit: { type: 'number', description: 'Maximum records to return. Defaults to 25; capped at 100.' },
              includeReturned: { type: 'boolean', description: 'For sales searches, include returned/undone sales as well as active sales.' }
            },
            required: ['scope'],
          },
        },
        {
          name: 'calculate_net_worth_growth',
          description: 'Analyze business net worth over time. Use this for ANY question about historical net worth, net worth growth, net worth on a specific date, last 6 months of net worth, biggest monthly increase, or why net worth changed. Use saved netWorthSnapshots as the primary source, but NEVER stop just because a requested date has no saved snapshot. For dates before the snapshot history begins, or for missing dates, reconstruct the historical position from the business transaction ledger and item history. Net worth is business cash + inventory market value + outstanding receivables - total debt, excluding the personal wallet. Use mode="point" for a specific date, mode="growth" for growth since a start date, mode="trend" for the requested number of months, mode="best_month" for the month with the largest increase, and mode="change_analysis" to explain a change using the four tracked components. When reconstructing older history, use each item\'s current stored marketValue because prior market-value versions are not retained, and clearly label the result as reconstructed/estimated rather than claiming it is an exact saved snapshot.',
          parameters: {
            type: 'object',
            properties: {
              mode: {
                type: 'string',
                enum: ['point','growth','trend','best_month','change_analysis'],
                description: 'point = net worth on a date; growth = change from startDate to now or endDate; trend = monthly history; best_month = largest month-to-month increase; change_analysis = explain the change between two saved snapshots by decomposing cash, inventory value, receivables, and debt.'
              },
              date: {
                type: 'string',
                description: 'Requested historical date in YYYY-MM-DD format for mode point.'
              },
              startDate: {
                type: 'string',
                description: 'Starting date in YYYY-MM-DD format for mode growth.'
              },
              endDate: {
                type: 'string',
                description: 'Optional ending date in YYYY-MM-DD format for mode growth. Defaults to the latest snapshot/current position.'
              },
              months: {
                type: 'number',
                description: 'Number of calendar months for mode trend. Defaults to 6 and is capped at 24.'
              },
            },
            required: ['mode'],
          },
        },
        {
          name: 'query_chat_history',
          description: 'Search messages the user previously sent or the assistant previously answered inside this website. Use this when the user asks what they previously asked, discussed, or decided in the AI chat.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Text to search for in previous chat messages.' },
              limit: { type: 'number', description: 'Maximum messages to return, capped at 50.' }
            },
            required: ['query'],
          },
        },
        {
          name: 'find_sales',
          description: 'Search past transactions by buyer name or item name (case-insensitive, partial match OK). Returns a JSON list with the exact saleId for each match. ALWAYS call this before delete_transaction — never guess a saleId.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Buyer name or item name to search for' } },
            required: ['query'],
          },
        },
        {
          name: 'delete_transaction',
          description: 'Delete a sale record, found via find_sales first. Set returnToInventory to true if the item should go back into available stock (most "undo this sale" requests want this). IMPORTANT: if the sale being deleted is a BUILD sale (find_sales result has a truthy isBuild flag) and returnToInventory is true, you MUST also know buildDisposition — call this tool WITHOUT buildDisposition first if unsure, and if the result asks you to clarify, ask the user directly: should the build go back to Builds as one sellable unit (reactivate), or be broken apart into individual inventory items (disassemble)? Then call again with their answer.',
          parameters: {
            type: 'object',
            properties: {
              saleId: { type: 'string', description: 'Exact saleId from a previous find_sales call' },
              returnToInventory: { type: 'boolean' },
              buildDisposition: { type: 'string', enum: ['reactivate', 'disassemble'], description: 'Only relevant when the sale is a build sale and returnToInventory is true. "reactivate" puts the whole build back as one sellable unit. "disassemble" breaks it apart into individually available parts.' },
            },
            required: ['saleId'],
          },
        },
        {
          name: 'sell_item',
          description: 'Mark an available item or active build as sold, recording the sale. Finds the item by name (partial match).',
          parameters: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              salePrice: { type: 'number' },
              buyerName: { type: 'string' },
            },
            required: ['itemName', 'salePrice'],
          },
        },
        {
          name: 'mark_item_defective',
          description: 'Mark an available or in-build item as defective/write-off, recording the capital loss. Finds the item by name (partial match).',
          parameters: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['itemName'],
          },
        },
        {
          name: 'add_income',
          description: 'Record money coming in that is NOT from selling inventory — e.g. "I earned 100 fixing a PC", "got paid 500 for a repair", "client paid me 2000 for service". This adds directly to a wallet balance and logs it in the Cash Ledger. Defaults to the business wallet unless the user says the money is personal.',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
              description: { type: 'string', description: 'What the money was for, e.g. "Fixed a PC for a client"' },
              wallet: { type: 'string', enum: ['business', 'personal'] },
            },
            required: ['amount', 'description'],
          },
        },
        {
          name: 'log_expense',
          description: 'Record money spent on something that is NOT inventory/resale stock — e.g. gas, food, tools, bills, or a personal withdrawal. Do not use this for buying parts to resell; use add_item_to_inventory for that instead.',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
              description: { type: 'string' },
              wallet: { type: 'string', enum: ['business', 'personal'], description: 'Which wallet the money came out of' },
            },
            required: ['amount', 'description'],
          },
        },
        {
          name: 'transfer_funds',
          description: 'Move money between the business wallet and the personal wallet — e.g. "move 500 to my personal wallet", "pay myself back 1000", "transfer 200 to business".',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
              direction: { type: 'string', enum: ['to_personal', 'to_business'], description: '"to_personal" moves money business → personal. "to_business" moves money personal → business.' },
            },
            required: ['amount', 'direction'],
          },
        },
        {
          name: 'query_wallet_balances',
          description: 'Get the current business and personal wallet balances — use this to answer questions like "how much is in my business wallet".',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'find_builds',
          description: 'Search active (not dissolved, not sold) builds by name, partial match OK. Returns each build\'s exact buildId and its current component list. Always call this before modify_build — never guess a buildId.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Build name to search for' } },
            required: ['query'],
          },
        },
        {
          name: 'modify_build',
          description: 'Add and/or remove parts on an EXISTING build, without dissolving it — works even if the build is already listed for sale. Use this when the user says things like "swap the RAM in Gaming Rig 2" or "add a bigger PSU to that build" or "take the GPU out of Gaming Rig 2". Find the exact buildId via find_builds first. To add parts, give the exact part name(s) as they appear in current inventory (use query_pocketbase_inventory if unsure). To remove parts, give the exact part name(s) as they currently appear in that build\'s component list.',
          parameters: {
            type: 'object',
            properties: {
              buildId: { type: 'string', description: 'Exact buildId from a previous find_builds call' },
              addPartNames: { type: 'array', items: { type: 'string' }, description: 'Names of currently-available inventory parts to add to the build' },
              removePartNames: { type: 'array', items: { type: 'string' }, description: 'Names of parts currently in the build to take out (they return to available inventory)' },
            },
            required: ['buildId'],
          },
        },
      ],
    },
  ];

export const SYSTEM_INSTRUCTION = `You are an expert PC hardware consultant and a helpful inventory assistant for a PC hardware reselling business. You provide sharp technical feedback, compatibility checks, and performance opinions on custom PC builds, prioritizing hardware longevity and thermal efficiency.

Always reply in clean, natural, conversational sentences. Do not use markdown formatting — no asterisks for bold, no "#" headers, no bullet-point characters. Just write the way you'd talk to someone over text. Assume all prices and transactions are in Philippine Pesos (PHP/₱) unless stated otherwise.

CRITICAL RULE FOR INVENTORY VS. EXPENSES:
If the user says they "spent", "paid", bought consumables (like gas, food, or tools), or paid a bill, you must treat this as an EXPENSE and use your tool/action to log an expense. DO NOT add these items to inventory. ONLY use add_item_to_inventory for physical hardware, parts, or stock explicitly intended to be resold as part of the business.

WALLET RULES:
There are two wallets: business and personal. If the user describes money coming in that is NOT from selling inventory — fixing a PC, a repair job, a service fee, getting paid for anything that isn't a resale — that's income, use add_income. If they describe spending on something that isn't resale stock, use log_expense. If they explicitly want to move money between the two wallets ("pay myself back", "move X to personal"), use transfer_funds. Default to the business wallet unless the user says "personal" or it's clearly personal money. If you're not sure which wallet they mean, ask.

When looking up, selling, or modifying an item, you must use the exact name, shorthand, or spelling the user provides in your tool arguments (for example, if the user says "iphone 13pm 256", use "iphone 13pm 256" exactly in the tool call; do not automatically expand it to "iPhone 13 Pro Max 256GB").

Never tell the user an action is complete, a transaction is deleted, or an item is returned until the corresponding tool has actually executed successfully. If a tool returns an error or cannot find an item, tell the user exactly what went wrong instead of making up a success message.

When the user wants to add a valid item to inventory, call add_item_to_inventory directly. If you don't know the cost yet, ask for it before adding. If the user bought more than one identical unit (e.g. "3 sticks of RAM at 500 each"), pass quantity so each unit is tracked as its own separate inventory item. Only use pre_fill_buy_form if the user specifically says they want to fill in or review the form first.

When the user uploads a photo of hardware, read any visible labels, model names, and specs from the image and use them to write a good "name" for add_item_to_inventory. Combine that with whatever numbers (cost, market price) the user gives you.

When the user wants to sell an item, ensure you know the exact item name, the sale price, and the buyer. If any of this information is missing, ask the user for it before calling the sales tool.

When the user wants to delete, undo, or return a sale, first call find_sales to locate the exact transaction. If you get more than one plausible match, ask the user which one they mean instead of guessing. Only after you have verified the exact saleId from the tool output should you call delete_transaction. If the matched sale has isBuild: true and the user wants the item(s) back in inventory, you must also ask whether the build should go back to Builds as one sellable unit (reactivate) or be broken apart into individually available parts (disassemble) — never guess this, since guessing wrong can let the same parts end up claimed by two different builds at once.

When the user wants to change what's in an already-assembled build ("swap the RAM in Gaming Rig 2", "add a PSU to that build", "take the GPU out"), first call find_builds to get the exact buildId and see its current parts. Then call modify_build with that buildId and the part names to add/remove. This works even on a build that's already listed for sale — it doesn't need to be dissolved first.

DATABASE ACCESS RULES: You have read access to the business database through query_business_database. Use it whenever the user asks about past transactions, purchase history, sales history, expenses, cash movements, bundle contents, build records, item history, profits, or any stored business fact. Do not guess from conversation memory when the answer should come from stored records. The tool reads the server /data endpoint backed by PocketBase, so it can see records beyond the small live-inventory summary. If the user asks about what they previously asked or discussed with you inside this website, use query_chat_history.

NET WORTH RULE: When the user asks about business net worth, historical net worth, net worth growth, business growth in value, net worth on a date, last N months of net worth, biggest month-to-month increase, or why net worth changed, you MUST use calculate_net_worth_growth. Do not refuse merely because a saved snapshot is missing. Use saved netWorthSnapshots when available, but use the tool's historical reconstruction when the requested date is before the snapshot history or a daily snapshot is missing. The Dashboard definition is business cash + inventory market value + outstanding receivables - total debt, excluding the personal wallet. For "since September" without a year, use the most recent September. For a specific date, report the exact saved snapshot when available; otherwise report the reconstructed end-of-day value and explicitly say it is reconstructed. For growth, report the starting net worth, ending net worth, absolute change, and percentage change. For trend, present monthly values even when older months are reconstructed. For best_month, analyze the available history rather than stopping at the first snapshot date. For change_analysis, identify which tracked components caused the increase/decrease. When a historical value is reconstructed, explain that inventory market value uses each item\'s current stored marketValue because prior market-value versions are not retained. Keep responses concise and conversational.

IMAGE AUTO-ENTRY RULE: When a user uploads a hardware photo to Buy, treat the photo as an extraction task: identify visible brand/model/spec text and map it to the app's category list. Never invent an exact model or price that is not visible.

Keep responses short and to the point.

When web search is enabled, prefer using it for any request that needs up-to-date technical specifications, clock speeds, core counts, or detailed hardware comparisons beyond what is already stored in your inventory notes. Cite the exact model and spec details clearly, and only rely on internal memory for inventory status, not for fresh hardware specs.

For business strategy questions, offer thoughtful advice that considers pricing, margins, inventory mix, cash flow, customer demand, and resale timing. You may recommend pricing strategies, when to hold inventory vs. sell, which component categories are most profitable, and how to use your current business wallet balance effectively.
`;
