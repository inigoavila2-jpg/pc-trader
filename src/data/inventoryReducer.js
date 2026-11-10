import { fmt, today, uid, normalizeAccount, withAccountDelta } from "./model.js";

export function inventoryReducer(state, action) {
  switch (action.type) {
    case "ADD_BUNDLE": {
          const amount=Number(action.bundle.purchasePrice||0);
          const account=normalizeAccount(action.paymentAccount||action.account);
          const txn={id:uid(),type:"PURCHASE",amount,description:`Bought bundle: ${action.bundle.name||"Untitled bundle"}`,wallet:"business",account,date:today()};
          const base={...state,bundles:[...state.bundles,action.bundle],parts:[...state.parts,...action.parts],transactions:[txn,...(state.transactions||[])]};
          return withAccountDelta(base,account,-amount);
        }
    case "ADD_PARTS": {
          const totalCost=action.parts.reduce((sum,p)=>sum+(p.allocatedCost||0),0);
          const allSameName=action.parts.length>1&&action.parts.every(p=>p.name===action.parts[0].name);
          const description=action.parts.length===1?`Bought ${action.parts[0].name}`:allSameName?`Bought ${action.parts.length}× ${action.parts[0].name}`:`Bought ${action.parts.length} items`;
          const account=normalizeAccount(action.paymentAccount||action.account);
          const txn={id:uid(),type:"PURCHASE",amount:totalCost,description,wallet:"business",account,date:today()};
          const base={...state,parts:[...state.parts,...action.parts],transactions:[txn,...(state.transactions||[])]};
          return withAccountDelta(base,account,-totalCost);
        }
    case "UPDATE_PART": {
          return {...state, parts: state.parts.map(p => p.id === action.id
            ? {...p, ...action.changes, history:[...p.history,{date:today(),event:`Edited: ${action.desc}`}]}
            : p
          )};
        }
    case "CREATE_BUILD": {
          const {build} = action;
          // Defense in depth: only ever claim parts that are truly available right now. The UI
          // picker already filters to status==="available", but the reducer shouldn't blindly
          // trust whatever partIds it's handed — if a part is already sold or claimed by another
          // build, silently exclude it here rather than letting two builds reference the same part.
          const validPartIds = build.partIds.filter(id => {
            const p = state.parts.find(pp => pp.id === id);
            return p && p.status === "available";
          });
          if (validPartIds.length === 0) return state; // nothing valid to build with — no-op
          const safeBuild = { ...build, partIds: validPartIds };
          return {...state, builds:[...state.builds,safeBuild],
            parts: state.parts.map(p => validPartIds.includes(p.id)
              ? {...p,status:"in_build",history:[...p.history,{date:today(),event:`Added to build: ${build.name}`}]}
              : p
            )};
        }
    case "DISSOLVE_BUILD": {
          const build = state.builds.find(b=>b.id===action.buildId);
          return {...state,
            builds: state.builds.map(b=>b.id===action.buildId?{...b,dissolved:true}:b),
            parts: state.parts.map(p=>build?.partIds.includes(p.id)&&p.status==="in_build"
              ? {...p,status:"available",history:[...p.history,{date:today(),event:`Removed from build: ${build.name}`}]}
              : p
            )};
        }
    case "EDIT_BUILD_PARTS": {
          // Adds and/or removes parts on a build that's already assembled (and possibly already
          // listed) — without dissolving it first. Same defense-in-depth as CREATE_BUILD: only ever
          // claim parts that are genuinely available right now, and only ever release parts that are
          // genuinely still in_build and actually belong to this specific build. This is what stops
          // an edit from accidentally grabbing a part another build already claims, or releasing a
          // part that was already sold out from under this build some other way.
          const {buildId, addPartIds=[], removePartIds=[]} = action;
          const build = state.builds.find(b=>b.id===buildId);
          if(!build) return state;
    
          const validAdds = addPartIds.filter(id=>{
            const p = state.parts.find(pp=>pp.id===id);
            return p && p.status==="available";
          });
          const validRemoves = removePartIds.filter(id=>{
            const p = state.parts.find(pp=>pp.id===id);
            return p && p.status==="in_build" && build.partIds.includes(id);
          });
          if(validAdds.length===0 && validRemoves.length===0) return state; // nothing valid to change
    
          const newPartIds = [...build.partIds.filter(id=>!validRemoves.includes(id)), ...validAdds];
    
          return {...state,
            builds: state.builds.map(b=>b.id===buildId?{...b,partIds:newPartIds}:b),
            parts: state.parts.map(p=>{
              if(validAdds.includes(p.id))
                return {...p,status:"in_build",history:[...p.history,{date:today(),event:`Added to build: ${build.name}`}]};
              if(validRemoves.includes(p.id))
                return {...p,status:"available",history:[...p.history,{date:today(),event:`Removed from build: ${build.name}`}]};
              return p;
            })
          };
        }
    case "DELETE_PART": {
          const target=state.parts.find(p=>p.id===action.id);
          // A part inside an active build must be removed from that build first (dissolve, or
          // remove it from the build) before it can be deleted — otherwise the build's partIds
          // would point at a part that no longer exists, breaking its cost basis and profit math.
          if(target?.status==="in_build")return state;
          return {...state, parts: state.parts.filter(p=>p.id!==action.id)};
        }
    case "DUPLICATE_PART": {
          const src=state.parts.find(p=>p.id===action.id);
          if(!src)return state;
          const copy={...src,id:uid(),status:"available",soldTo:"",
            history:[{date:today(),event:`Duplicated from "${src.name}"`}]};
          return {...state, parts:[...state.parts,copy]};
        }
    case "DELETE_BUILD": {
          const {buildId,returnParts}=action;
          const build=state.builds.find(b=>b.id===buildId);
          return {...state,
            builds: state.builds.filter(b=>b.id!==buildId),
            parts: returnParts
              ? state.parts.map(p=>build?.partIds.includes(p.id)
                  ? {...p,status:"available",history:[...p.history,{date:today(),event:`Build "${build.name}" deleted — returned to inventory`}]}
                  : p)
              : state.parts.filter(p=>!build?.partIds.includes(p.id))
          };
        }
    
        // mode "parts-too" removes the bundle and every part that came from it.
        // mode "keep-loose" removes only the bundle record, leaving its parts in inventory as untracked single parts.
    case "DELETE_BUNDLE": {
          const {bundleId,mode}=action;
          if(mode==="parts-too"){
            return {...state,
              bundles: state.bundles.filter(b=>b.id!==bundleId),
              parts: state.parts.filter(p=>p.bundleId!==bundleId)
            };
          }
          return {...state,
            bundles: state.bundles.filter(b=>b.id!==bundleId),
            parts: state.parts.map(p=>p.bundleId===bundleId?{...p,bundleId:null,source:"Untracked (bundle deleted)"}:p)
          };
        }
    
        // Logs a capital loss and removes the part from active inventory, keeping a record in sales
        // (as a zero/negative-revenue "sale") so it still shows up in Dashboard/History analytics.
    case "MARK_DEFECTIVE": {
          const {id,reason}=action;
          const part=state.parts.find(p=>p.id===id);
          if(!part)return state;
          const loss={id:uid(),partId:part.id,name:part.name,cost:part.allocatedCost,salePrice:0,profit:-part.allocatedCost,
            buyerName:"",date:today(),writeOff:true,reason:reason||""};
          return {...state,
            sales:[...state.sales,loss],
            parts: state.parts.map(p=>p.id===id
              ? {...p,status:"defective",history:[...p.history,{date:today(),event:`Marked defective/write-off${reason?`: ${reason}`:""} — loss of ${fmt(part.allocatedCost)}`}]}
              : p)
          };
        }
    default: return undefined;
  }
}
