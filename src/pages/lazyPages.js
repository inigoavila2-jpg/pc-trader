import { lazy } from "react";

// Load each screen only when it is first opened. App keeps visited screens mounted
// afterward so switching tabs preserves in-progress form state.
export const Dashboard = lazy(() => import("./Dashboard.jsx").then((page) => ({ default: page.Dashboard })));
export const Buy = lazy(() => import("./Buy.jsx").then((page) => ({ default: page.Buy })));
export const Inventory = lazy(() => import("./Inventory.jsx").then((page) => ({ default: page.Inventory })));
export const Builds = lazy(() => import("./Builds.jsx").then((page) => ({ default: page.Builds })));
export const Sell = lazy(() => import("./Sell.jsx").then((page) => ({ default: page.Sell })));
export const History = lazy(() => import("./History.jsx").then((page) => ({ default: page.History })));
export const Settings = lazy(() => import("./Settings.jsx").then((page) => ({ default: page.Settings })));
