
import { Monitor } from "lucide-react";

import { _buyVisionClient, setBuyVisionClient } from "./_buyVisionClient.jsx";

export async function getGeminiVisionClient(){
  const apiKey = import.meta.env?.VITE_GEMINI_KEY || import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY || process?.env?.VITE_GEMINI_KEY || process?.env?.GEMINI_API_KEY;
  if(!apiKey) return null;
  if(!_buyVisionClient){
    const { GoogleGenAI } = await import("@google/genai");
    if(!_buyVisionClient) setBuyVisionClient(new GoogleGenAI({apiKey}));
  }
  return _buyVisionClient;
}


export function parseJsonResponse(text){
  const raw=String(text||"").trim();
  try{return JSON.parse(raw);}catch{}
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if(fenced){try{return JSON.parse(fenced[1]);}catch{}}
  const first=raw.indexOf("{");
  const last=raw.lastIndexOf("}");
  if(first>=0&&last>first){try{return JSON.parse(raw.slice(first,last+1));}catch{}}
  return null;
}


export function dataUrlParts(dataUrl){
  const match=String(dataUrl||"").match(/^data:([^;]+);base64,(.+)$/s);
  if(!match) throw new Error("Invalid image data");
  return {mimeType:match[1],data:match[2]};
}

async function analyzeBuyImage(dataUrl,{mode="single",existingRows=[]}={}){
  const ai=await getGeminiVisionClient();
  if(!ai) throw new Error("Gemini API key is not configured");
  const {mimeType,data}=dataUrlParts(dataUrl);
  const categories=["GPU","CPU","Motherboard","CPU+MB","RAM","PSU","Storage","Cooler","Case","Monitor","Mouse","Keyboard","Other"];
  const prompt=mode==="bundle"
    ? `Analyze this PC hardware buying/listing photo quickly and return ONLY valid JSON. Identify every distinct PC part that is visibly present. Do not invent model numbers or prices. If text from a marketplace listing, receipt, label, or screenshot visibly shows a seller/source or total purchase price, extract it; otherwise use null. For each visible part, use one of these categories: ${categories.join(", ")}.\nReturn exactly this shape:\n{"source":string|null,"purchasePrice":number|null,"parts":[{"name":string,"category":string,"notes":string,"marketValue":number|null,"confidence":number}]}\n` 
    : `Analyze this single PC hardware item photo and return ONLY valid JSON. Read visible brand/model/spec labels. Do not invent details that are not visible. Use one of these categories: ${categories.join(", ")}. If a price is visibly shown, extract it as marketValue; otherwise marketValue must be null.\nReturn exactly this shape:\n{"name":string,"category":string,"notes":string,"marketValue":number|null,"quantity":1,"confidence":number}\n`;
  const result=await ai.models.generateContent({
    model:"gemini-2.5-flash",
    contents:[{role:"user",parts:[{inlineData:{mimeType,data}},{text:prompt}]}],
    config:{temperature:0.1,responseMimeType:"application/json"},
  });
  const parsed=parseJsonResponse(result?.text);
  if(!parsed) throw new Error("AI returned an unreadable result");
  if(mode==="bundle"){
    const parts=Array.isArray(parsed.parts)?parsed.parts.map((p)=>({
      name:String(p?.name||"").trim(),
      category:categories.includes(p?.category)?p.category:"Other",
      notes:String(p?.notes||"").trim(),
      marketValue:Number.isFinite(Number(p?.marketValue))&&Number(p.marketValue)>0?Number(p.marketValue):"",
      confidence:Number.isFinite(Number(p?.confidence))?Math.max(0,Math.min(1,Number(p.confidence))):0,
    })).filter(p=>p.name):[];
    return {
      source:String(parsed.source||"").trim(),
      purchasePrice:Number.isFinite(Number(parsed.purchasePrice))&&Number(parsed.purchasePrice)>0?Number(parsed.purchasePrice):"",
      parts,
    };
  }
  return {
    name:String(parsed.name||"").trim(),
    category:categories.includes(parsed.category)?parsed.category:"Other",
    notes:String(parsed.notes||"").trim(),
    marketValue:Number.isFinite(Number(parsed.marketValue))&&Number(parsed.marketValue)>0?Number(parsed.marketValue):"",
    quantity:Math.max(1,Math.floor(Number(parsed.quantity)||1)),
    confidence:Number.isFinite(Number(parsed.confidence))?Math.max(0,Math.min(1,Number(parsed.confidence))):0,
  };
}


export function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Could not read image"));
    reader.onload=()=>resolve(reader.result);
    reader.readAsDataURL(file);
  });
}


export function compressImage(file,maxDimension=1280,quality=0.82){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Could not read file"));
    reader.onload=()=>{
      img.onerror=()=>reject(new Error("Could not decode image"));
      img.onload=()=>{
        let {width,height}=img;
        if(width>maxDimension||height>maxDimension){
          if(width>height){height=Math.round(height*(maxDimension/width));width=maxDimension;}
          else{width=Math.round(width*(maxDimension/height));height=maxDimension;}
        }
        const canvas=document.createElement("canvas");
        canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,width,height);
        canvas.toBlob(blob=>{
          if(!blob){reject(new Error("Compression failed"));return;}
          resolve(new File([blob],file.name.replace(/\.(png|heic|heif)$/i,".jpg"),{type:"image/jpeg"}));
        },"image/jpeg",quality);
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

