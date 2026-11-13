import { useState, useEffect, useCallback, useMemo, Suspense } from "react";

import { AIAgentChatbox } from "./components/AIAgentChatbox";
import { fmt } from "./data/model.js";
import { useAppData } from "./data/useAppData.js";
import { Search } from "lucide-react";

import { THEME, buildTheme, FONT_BODY, FONT_MONO, ThemeCtx, ToastContainer, AnimNum, Lightbox, IconBtn, QuickActionsFab, ALL_TABS, TAB_ICON, GlobalSearchModal, BrandMark, SyncStatus, LoadingScreen, ErrorScreen } from "./components/index.js";
import { useMediaQuery, usePersistentState, useToast } from "./hooks/appHooks.js";
import { Dashboard, Buy, Inventory, Builds, Sell, History, Settings, NetWorthHistory } from "./pages/lazyPages.js";

export default function App() {
  const { state, dispatch, loadStatus, saveStatus } = useAppData();

  const [tab,setActiveTab]=useState("Dashboard");
  const [visitedTabs,setVisitedTabs]=useState(["Dashboard"]);
  const setTab=useCallback(nextTab=>{
    setActiveTab(nextTab);
    setVisitedTabs(previous=>previous.includes(nextTab)?previous:[...previous,nextTab]);
  },[]);
  const {toasts,toast}=useToast();
  const [localTheme,setLocalTheme]=usePersistentState("pc-trader-theme-mode","dark");
  const [legacyThemeColors,setLegacyThemeColors]=usePersistentState("pc-trader-theme-colors",{});
  const [themePreviewColors,setThemePreviewColors]=useState(null);
  const theme=state?.themeMode||localTheme;
  const setTheme=useCallback(mode=>{
    const nextMode=typeof mode==="function"?mode(theme):mode;
    setLocalTheme(nextMode);
    dispatch({type:"SET_THEME_MODE",mode:nextMode});
  },[dispatch,theme,setLocalTheme]);
  const [lightboxUrl,setLightboxUrl]=useState(null);
  const openLightbox=useCallback(url=>setLightboxUrl(url),[]);
  const [searchOpen,setSearchOpen]=useState(false);
  const [inventoryJump,setInventoryJump]=useState(null);
  const [historyJump,setHistoryJump]=useState(null);

  // Global search — Ctrl/Cmd+K from anywhere opens it, addressing "finding things is clunky"
  // without adding yet another button to hunt for.
  useEffect(()=>{
    const onKey=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setSearchOpen(o=>!o);}
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[]);
  const jumpTo=useCallback((targetTab,request)=>{
    setTab(targetTab);
    if(targetTab==="Inventory")setInventoryJump(request);
    if(targetTab==="History")setHistoryJump(request);
    setSearchOpen(false);
  },[]);

  // Helper for chatbox to pre-fill form fields on AI commands
  const setFormData=useCallback((formType,data)=>{
    if(formType==="buy"){
      toast(`${data.singleName} - Cost: ${data.singleCost}, Market: ${data.singleMarket}`, "info");
    }
  },[toast]);

  const isDesktop=useMediaQuery("(min-width: 1024px)");
  const activeThemeSlot=Number(state?.activeThemeSlot||1);
  const savedSlotColors=activeThemeSlot===1?{}:(state?.themePaletteSlots?.[activeThemeSlot]?.colors||{});
  const activeThemeColors = themePreviewColors && Object.prototype.hasOwnProperty.call(themePreviewColors,theme)
    ? (themePreviewColors[theme]||{})
    : savedSlotColors;
  const themeColors=useMemo(()=>({[theme]:savedSlotColors}),[theme,activeThemeSlot,state?.themePaletteSlots]);
  const t=buildTheme(theme==="dark"?THEME.dark:THEME.light,activeThemeColors);
  const totalProfit=useMemo(
    ()=> (state?.sales||[]).filter(sale=>!sale.deleted&&!sale.returned).reduce((sum,sale)=>sum+sale.profit,0),
    [state?.sales]
  );

  if(loadStatus==="loading")return <LoadingScreen t={t}/>;
  if(loadStatus==="error")return <ErrorScreen t={t}/>;

  const contentMaxWidth=isDesktop?1120:740;

  const pageContent={
    Dashboard:<Dashboard state={state} dispatch={dispatch} toast={toast} setTab={setTab} openLightbox={openLightbox}/>,
    Buy:<Buy state={state} dispatch={dispatch} toast={toast}/>,
    Inventory:<Inventory state={state} dispatch={dispatch} toast={toast} setTab={setTab} openLightbox={openLightbox} jumpRequest={inventoryJump}/>,
    Builds:<Builds state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox}/>,
    Sell:<Sell state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox}/>,
    History:<History state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox} jumpRequest={historyJump}/>,
    "Net Worth":<NetWorthHistory state={state}/>,
    Settings:<Settings state={state} dispatch={dispatch} toast={toast} theme={theme} setTheme={setTheme} themeColors={themeColors} themePreviewColors={themePreviewColors} setThemePreviewColors={setThemePreviewColors}/>,
  };
  const panels=visitedTabs.map(name=>(
    <div key={name} style={{display:tab===name?"block":"none"}}>
      <Suspense fallback={<LoadingScreen t={t}/>}>{pageContent[name]}</Suspense>
    </div>
  ));

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{minHeight:"100vh",background:t.bg,color:t.text,fontFamily:FONT_BODY,transition:"background 0.3s,color 0.3s"}}>
        <style>{`
          @keyframes blFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes blSlideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
          @keyframes blSlideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
          @keyframes blSpin{to{transform:rotate(360deg)}}
          .bl-spin{animation:blSpin 0.8s linear infinite;display:inline-block}
          *{box-sizing:border-box}
          html,body{background:${t.bg};margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
          input[type=number]::-webkit-inner-spin-button{opacity:0.3}
          ::-webkit-scrollbar{width:5px;height:5px}
          ::-webkit-scrollbar-track{background:transparent}
          ::-webkit-scrollbar-thumb{background:${t.borderStrong};border-radius:99px}
          button{font-family:inherit}
          .bl-focusable{outline:none}
          .bl-focusable:focus-visible{box-shadow:0 0 0 3px ${t.focusRing};border-radius:9px}
          .bl-card-btn:focus-visible{box-shadow:0 0 0 3px ${t.focusRing} !important;border-color:${t.accent} !important;}
          a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid ${t.accent};outline-offset:1px;}
          @media (prefers-reduced-motion: reduce){
            *,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important;}
          }
          @media (max-width:640px){
            .responsive-grid{grid-template-columns:1fr !important;gap:8px !important;}
            .part-row{grid-template-columns:1fr !important;gap:8px !important;}
          }
        `}</style>
        <ToastContainer toasts={toasts}/>

        {isDesktop?(
          <div style={{display:"flex",minHeight:"100vh"}}>
            {/* Sidebar — the desktop-width fix: this app was previously capped at a 740px column
                on every screen size, leaving most of a desktop viewport empty. A persistent
                sidebar plus a wider content column (below) is what actually uses that space. */}
            <nav aria-label="Primary" style={{width:232,flexShrink:0,borderRight:`1px solid ${t.border}`,background:t.bgElevated,
              display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"}}>
              <div style={{padding:"20px 18px"}}><BrandMark t={t}/></div>
              <div style={{padding:"0 10px 10px"}}>
                <button onClick={()=>setSearchOpen(true)} className="bl-focusable" style={{width:"100%",display:"flex",alignItems:"center",gap:8,
                  background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 10px",cursor:"pointer",color:t.textFaint,
                  fontFamily:FONT_BODY,fontSize:12.5}}>
                  <Search size={14}/><span style={{flex:1,textAlign:"left"}}>Search…</span>
                  <span style={{fontSize:10,border:`1px solid ${t.border}`,borderRadius:4,padding:"1px 5px",fontFamily:FONT_MONO}}>⌘K</span>
                </button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:2,padding:"6px 10px",flex:1,overflowY:"auto"}}>
                {ALL_TABS.map(name=>{
                  const Icon=TAB_ICON[name];
                  const active=tab===name;
                  return (
                    <button key={name} onClick={()=>setTab(name)} aria-current={active?"page":undefined} className="bl-focusable"
                      style={{display:"flex",alignItems:"center",gap:11,padding:"10px 12px",borderRadius:9,border:"none",cursor:"pointer",
                        background:active?t.accentSoft:"transparent",color:active?t.accent:t.textMuted,fontSize:13.5,fontWeight:600,
                        fontFamily:FONT_BODY,textAlign:"left",transition:"background 0.12s,color 0.12s"}}
                      onMouseEnter={e=>{if(!active)e.currentTarget.style.background=t.surfaceHover;}}
                      onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
                      <Icon size={17} strokeWidth={2}/>{name}
                    </button>
                  );
                })}
              </div>
              <div style={{padding:"14px 18px",borderTop:`1px solid ${t.border}`,display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5}}>
                  <span style={{color:t.textMuted}}>Parts</span>
                  <span style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text}}><AnimNum value={state.parts.length}/></span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5}}>
                  <span style={{color:t.textMuted}}>Profit</span>
                  <span style={{fontFamily:FONT_MONO,fontWeight:700,color:t.positive}}>{fmt(totalProfit)}</span>
                </div>
                <SyncStatus saveStatus={saveStatus} t={t}/>
              </div>
            </nav>

            <main style={{flex:1,minWidth:0,overflowY:"auto"}}>
              <div style={{maxWidth:contentMaxWidth,margin:"0 auto",padding:"32px 32px 60px"}}>
                {panels}
              </div>
            </main>
          </div>
        ):(
          <>
            {/* Header */}
            <div style={{borderBottom:`1px solid ${t.border}`,padding:"calc(13px + env(safe-area-inset-top)) 16px 13px",background:t.bgElevated}}>
              <div style={{maxWidth:contentMaxWidth,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <BrandMark t={t} compact/>
                <div style={{display:"flex",gap:14,alignItems:"center",flexShrink:0}}>
                  <IconBtn icon={Search} label="Search (Ctrl/Cmd+K)" onClick={()=>setSearchOpen(true)} variant="surface" size={32} iconSize={15}/>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:9.5,color:t.textFaint,fontWeight:600}}>Parts</div>
                    <div style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text,fontSize:13}}><AnimNum value={state.parts.length}/></div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:9.5,color:t.textFaint,fontWeight:600}}>Profit</div>
                    <div style={{fontFamily:FONT_MONO,fontWeight:700,color:t.positive,fontSize:13}}>{fmt(totalProfit)}</div>
                  </div>
                  <SyncStatus saveStatus={saveStatus} t={t} compact/>
                </div>
              </div>
            </div>

            {/* Tab bar — kept as a horizontally-scrolling top bar per preference, restyled with
                icons, a sliding underline, and no more of the max-width:640px font-shrink hack. */}
            <div role="tablist" aria-label="Sections" style={{borderBottom:`1px solid ${t.border}`,overflowX:"auto",background:t.bgElevated,WebkitOverflowScrolling:"touch"}}>
              <div style={{maxWidth:contentMaxWidth,margin:"0 auto",display:"flex"}}>
                {ALL_TABS.map(name=>{
                  const Icon=TAB_ICON[name];
                  const active=tab===name;
                  return (
                    <button key={name} role="tab" aria-selected={active} onClick={()=>setTab(name)} className="bl-focusable" style={{
                      display:"flex",alignItems:"center",gap:6,padding:"12px 13px",fontSize:12.5,fontWeight:600,border:"none",cursor:"pointer",background:"none",
                      whiteSpace:"nowrap",transition:"color 0.15s",flexShrink:0,fontFamily:FONT_BODY,
                      color:active?t.accent:t.textMuted,
                      borderBottom:`2px solid ${active?t.accent:"transparent"}`,
                    }}
                      onMouseEnter={e=>{if(!active)e.currentTarget.style.color=t.text;}}
                      onMouseLeave={e=>{if(!active)e.currentTarget.style.color=t.textMuted;}}>
                      <Icon size={14} strokeWidth={2.1}/>{name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{maxWidth:contentMaxWidth,margin:"0 auto",padding:"22px 16px calc(90px + env(safe-area-inset-bottom))"}}>
              {panels}
            </div>
          </>
        )}

        <QuickActionsFab state={state} dispatch={dispatch} toast={toast}/>
        <AIAgentChatbox state={state} dispatch={dispatch} setTab={setTab} setFormData={setFormData} toast={toast} theme={t}/>
        <Lightbox url={lightboxUrl} onClose={()=>setLightboxUrl(null)}/>
        {searchOpen&&<GlobalSearchModal state={state} onClose={()=>setSearchOpen(false)} onJump={jumpTo}/>}
      </div>
    </ThemeCtx.Provider>
  );
}
