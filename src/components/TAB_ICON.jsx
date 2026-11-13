

import { LayoutDashboard, ShoppingCart, Boxes, Wrench, Banknote, History as HistoryIcon, Settings as SettingsIcon, TrendingUp } from "lucide-react";

import { Dashboard } from "../pages/Dashboard.jsx";
import { Buy } from "../pages/Buy.jsx";
import { Inventory } from "../pages/Inventory.jsx";
import { Builds } from "../pages/Builds.jsx";
import { Sell } from "../pages/Sell.jsx";
import { History } from "../pages/History.jsx";
import { Settings } from "../pages/Settings.jsx";

export const TAB_ICON={Dashboard:LayoutDashboard,Buy:ShoppingCart,Inventory:Boxes,Builds:Wrench,Sell:Banknote,History:HistoryIcon,"Net Worth":TrendingUp,Settings:SettingsIcon};

/* ═══════════════════════════════════════════
   GLOBAL SEARCH — the fix for "finding things is clunky": one search box, reachable from
   anywhere (header icon or Ctrl/Cmd+K), that looks across parts, builds, and sales at once
   and jumps straight to the right tab with the result already filtered in.
═══════════════════════════════════════════ */
