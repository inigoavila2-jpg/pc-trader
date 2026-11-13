



import { Dashboard } from "../pages/Dashboard.jsx";
import { Buy } from "../pages/Buy.jsx";
import { Inventory } from "../pages/Inventory.jsx";
import { Builds } from "../pages/Builds.jsx";
import { Sell } from "../pages/Sell.jsx";
import { History } from "../pages/History.jsx";
import { Settings } from "../pages/Settings.jsx";

export const ALL_TABS=["Dashboard","Buy","Inventory","Builds","Sell","History","Net Worth","Settings"];
export const TAB_GROUPS=[
  {label:"Overview",items:[{tab:"Dashboard",label:"Dashboard"}]},
  {label:"Stock",items:[{tab:"Buy",label:"Buy"},{tab:"Inventory",label:"Inventory"},{tab:"Builds",label:"Builds"}]},
  {label:"Sales",items:[{tab:"Sell",label:"Record a sale"},{tab:"History",label:"Activity",request:{view:"transactions"}}]},
  {label:"Money",items:[{tab:"History",label:"Cash ledger",request:{view:"ledger"}},{tab:"Net Worth",label:"Net Worth"}]},
  {label:"More",items:[{tab:"Settings",label:"Settings"}]},
];
