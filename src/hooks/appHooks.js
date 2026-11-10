import { useState, useEffect, useRef, useCallback } from "react";


import { uid } from "../data/model.js";

export function useMediaQuery(query){
  const [matches,setMatches]=useState(()=>typeof window!=="undefined"?window.matchMedia(query).matches:false);
  useEffect(()=>{
    const mql=window.matchMedia(query);
    const handler=e=>setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener?mql.addEventListener("change",handler):mql.addListener(handler);
    return()=>{mql.removeEventListener?mql.removeEventListener("change",handler):mql.removeListener(handler);};
  },[query]);
  return matches;
}


export function usePrefersReducedMotion(){
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/* Remembers a value in this browser across visits — used only for convenience defaults
   (last category picked, last wallet used), never for anything the server should own. */

export function usePersistentState(key,initialValue){
  const [value,setValue]=useState(()=>{
    try{
      const raw=window.localStorage.getItem(key);
      return raw!==null?JSON.parse(raw):initialValue;
    }catch{return initialValue;}
  });
  const setAndPersist=useCallback((next)=>{
    setValue(prev=>{
      const resolved=typeof next==="function"?next(prev):next;
      try{window.localStorage.setItem(key,JSON.stringify(resolved));}catch{}
      return resolved;
    });
  },[key]);
  return [value,setAndPersist];
}

/* ═══════════════════════════════════════════
   MODAL FOCUS TRAP + ESCAPE — previously each
   overlay only closed on backdrop click, which stranded keyboard and screen-reader
   users. One hook, applied everywhere, so the behavior is consistent. */

export function useDialogA11y(onClose, active=true){
  const ref=useRef(null);
  useEffect(()=>{
    if(!active)return;
    const node=ref.current;
    const focusables=()=>node?Array.from(node.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el=>!el.disabled&&el.offsetParent!==null):[];
    const toFocus=focusables();
    (toFocus[0]||node)?.focus?.();
    const onKey=e=>{
      if(e.key==="Escape"){e.stopPropagation();onClose?.();return;}
      if(e.key==="Tab"){
        const items=focusables();
        if(items.length===0)return;
        const first=items[0], last=items[items.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener("keydown",onKey,true);
    return()=>document.removeEventListener("keydown",onKey,true);
  },[active,onClose]);
  return ref;
}
/* ═══════════════════════════════════════════
   TOAST — now announced to assistive tech via a visually-hidden aria-live region,
   not just shown visually. Screen-reader users previously had no idea a sale,
   save, or error had happened.
═══════════════════════════════════════════ */

export function useToast() {
  const [toasts,setToasts] = useState([]);
  const toast = useCallback((message,type="success") => {
    const id=uid();
    setToasts(p=>[...p,{id,message,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3200);
  },[]);
  return {toasts,toast};
}
