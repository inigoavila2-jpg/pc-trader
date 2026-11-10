import { useState, useEffect, useRef, useCallback } from "react";
import { initialState, normalizeCategoryRegistry, recordNetWorthSnapshot, localISODate, SNAPSHOT_ACTIONS } from "./model.js";
import { reducer } from "./reducer.js";

export function useAppData() {
  const [state,setState]=useState(null);
  const [loadStatus,setLoadStatus]=useState("loading"); // loading | ready | error
  const [saveStatus,setSaveStatus]=useState("idle"); // idle | saving | error
  const saveTimer=useRef(null);
  const hasLoaded=useRef(false);
  // Theme edits originate on one device; ordinary data writes from another device must not
  // overwrite that shared palette with stale theme values. Incoming theme sync updates also
  // must not trigger an unnecessary full-state POST back to the server.
  const themeWritePending=useRef(false);
  const skipNextStateSave=useRef(false);

  // Load once from the server (which is backed by PocketBase)
  useEffect(()=>{
    fetch("/data")
      .then(r=>{if(!r.ok)throw new Error(`Server returned ${r.status}`);return r.json();})
      .then(json=>{
        let loadedState = json&&Object.keys(json).length?{...initialState,...json}:initialState;
        if(loadedState.businessCash===undefined && loadedState.liquidCash!==undefined) {
          loadedState.businessCash = loadedState.liquidCash;
        }
        // Existing Business wallet is now Business Bank; new physical cash starts at zero.
        // Old personal balances and transaction history remain stored but are hidden from the UI.
        loadedState.businessCash=Number(loadedState.businessCash||loadedState.businessBank||0);
        loadedState.cashOnHand=Number(loadedState.cashOnHand||loadedState.cash||0);
        loadedState=normalizeCategoryRegistry(loadedState);
        // Initialize shared theme slots. If no server-saved custom slot exists yet, allow
        // whichever device has the legacy browser-only palette to migrate it into shared Slot 2.
        const hasAnySavedThemeSlot=Object.values(loadedState.themePaletteSlots||{}).some(slot=>!!slot?.colors);
        if(!hasAnySavedThemeSlot){
          loadedState.themePaletteSlots={2:null,3:null,4:null,5:null,...(loadedState.themePaletteSlots||{})};
          try{
            const legacyMode=JSON.parse(window.localStorage.getItem("pc-trader-theme-mode")||"\"dark\"");
            const legacyColors=JSON.parse(window.localStorage.getItem("pc-trader-theme-colors")||"{}");
            const migrated=legacyColors?.[legacyMode];
            if(migrated&&Object.keys(migrated).length){
              loadedState.themePaletteSlots[2]={name:"Migrated Theme",mode:legacyMode,colors:migrated,updatedAt:new Date().toISOString()};
              loadedState.activeThemeSlot=2;
              // Preserve this device's one-time legacy migration long enough to save it to /data
              // before the first cross-device poll can replace it with the still-empty server slot.
              themeWritePending.current=true;
            }
            loadedState.themeMode=json?.themeMode||legacyMode||"dark";
          }catch{loadedState.themeMode=json?.themeMode||loadedState.themeMode||"dark";}
        }
        loadedState.activeThemeSlot=Number(loadedState.activeThemeSlot||1);
        loadedState.themePaletteSlots={2:null,3:null,4:null,5:null,...(loadedState.themePaletteSlots||{})};
        if(!json?.themeMode){
          const activeSavedMode=loadedState.activeThemeSlot!==1
            ? loadedState.themePaletteSlots?.[loadedState.activeThemeSlot]?.mode
            : null;
          if(activeSavedMode==="light"||activeSavedMode==="dark"){
            loadedState.themeMode=activeSavedMode;
          }else{
            try{loadedState.themeMode=JSON.parse(window.localStorage.getItem("pc-trader-theme-mode")||"\"dark\"");}
            catch{loadedState.themeMode="dark";}
          }
          // If the server has no mode yet, persist the chosen fallback once so other devices
          // don't independently pick their own browser-local theme mode.
          themeWritePending.current=true;
        }
        loadedState.themeMode=loadedState.themeMode||"dark";
        // Start the historical series immediately. Existing accounts will have a current-day
        // baseline created on first load; future changes update that day's snapshot automatically.
        loadedState = recordNetWorthSnapshot(loadedState);
        setState(loadedState);
        setLoadStatus("ready");
        hasLoaded.current=true;
      })
      .catch(err=>{
        console.error("Failed to load data:",err);
        setLoadStatus("error");
      });
  },[]);

  // Keep a daily snapshot even when the app stays open across midnight without a business action.
  useEffect(()=>{
    const timer=setInterval(()=>{
      setState(prev=>{
        if(!hasLoaded.current || !prev) return prev;
        const todayKey=localISODate();
        const existing=(prev.netWorthSnapshots||[]).find(s=>s.date===todayKey);
        return existing ? prev : recordNetWorthSnapshot(prev);
      });
    },60*60*1000);
    return()=>clearInterval(timer);
  },[]);

  const dispatch=useCallback(action=>{
    if(["SET_THEME_MODE","SET_ACTIVE_THEME_SLOT","SAVE_THEME_PALETTE_SLOT"].includes(action?.type)){
      themeWritePending.current=true;
    }
    setState(prev=>{
      const next=reducer(prev,action);
      if(next===prev || !SNAPSHOT_ACTIONS.has(action?.type)) return next;
      return recordNetWorthSnapshot(next);
    });
  },[]);

  // Keep the shared theme as server-owned state. When this device saves unrelated business
  // changes, merge in the latest server theme first so an old phone tab cannot roll back the PC's
  // active slot or saved palettes. Explicit theme edits on this device are allowed to win.
  useEffect(()=>{
    if(!hasLoaded.current||state===null)return;
    if(skipNextStateSave.current){
      skipNextStateSave.current=false;
      return;
    }
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(async()=>{
      setSaveStatus("saving");
      try{
        let payload=state;
        if(!themeWritePending.current){
          try{
            const latestRes=await fetch(`/data?themeSync=${Date.now()}`,{cache:"no-store"});
            if(latestRes.ok){
              const latest=await latestRes.json();
              payload={
                ...state,
                themeMode:latest.themeMode||state.themeMode||"dark",
                activeThemeSlot:Number(latest.activeThemeSlot||state.activeThemeSlot||1),
                themePaletteSlots:latest.themePaletteSlots||state.themePaletteSlots||{2:null,3:null,4:null,5:null},
              };
            }
          }catch(mergeError){
            console.warn("Could not merge latest shared theme before saving:",mergeError);
          }
        }
        const response=await fetch("/data",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(payload),
        });
        if(!response.ok)throw new Error(`Server returned ${response.status}`);
        setSaveStatus("idle");
        if(themeWritePending.current)themeWritePending.current=false;
      }catch(err){
        console.error("Failed to save data:",err);
        setSaveStatus("error");
      }
    },500);
    return()=>clearTimeout(saveTimer.current);
  },[state]);

  // Sync theme changes from other devices while this page is open, and when returning to the tab.
  // Only the theme fields are merged so a polling response never replaces this device's inventory.
  useEffect(()=>{
    if(loadStatus!=="ready"||!hasLoaded.current)return undefined;
    let disposed=false;
    let syncing=false;
    const syncSharedTheme=async()=>{
      if(disposed||syncing||themeWritePending.current||document.visibilityState==="hidden")return;
      syncing=true;
      try{
        const response=await fetch(`/data?themeSync=${Date.now()}`,{cache:"no-store"});
        if(!response.ok)return;
        const remote=await response.json();
        if(disposed)return;
        const remoteMode=remote.themeMode==="light"?"light":"dark";
        const remoteSlot=Number(remote.activeThemeSlot||1);
        const remotePalettes=remote.themePaletteSlots||{2:null,3:null,4:null,5:null};
        setState(prev=>{
          if(!prev)return prev;
          const sameMode=(prev.themeMode||"dark")===remoteMode;
          const sameSlot=Number(prev.activeThemeSlot||1)===remoteSlot;
          const samePalettes=JSON.stringify(prev.themePaletteSlots||{})===JSON.stringify(remotePalettes||{});
          if(sameMode&&sameSlot&&samePalettes)return prev;
          skipNextStateSave.current=true;
          return {
            ...prev,
            themeMode:remoteMode,
            activeThemeSlot:remoteSlot,
            themePaletteSlots:remotePalettes,
          };
        });
      }catch(err){
        console.warn("Shared theme sync unavailable:",err);
      }finally{
        syncing=false;
      }
    };
    const interval=setInterval(syncSharedTheme,4000);
    const onFocus=()=>syncSharedTheme();
    const onVisibility=()=>{if(document.visibilityState==="visible")syncSharedTheme();};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisibility);
    syncSharedTheme();
    return()=>{
      disposed=true;
      clearInterval(interval);
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[loadStatus]);

  return { state, dispatch, loadStatus, saveStatus };
}
