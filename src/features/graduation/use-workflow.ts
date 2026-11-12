"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSession, postJson, request } from "@/features/shared/api-client";
import { emptyCollaboration, type CollaborationCommand, type CollaborationState } from "./workflow-model";

const empty=emptyCollaboration();
export const formalDraftKey=(student:string,mentor:string)=>`graduation:formal-draft:${student}:${mentor}`;
export function useWorkflow(studentId:string,mentorId:string,role:"student"|"mentor") {
  const key=studentId+":"+mentorId;
  const current=useRef(key);
  useEffect(()=>{current.current=key;},[key]);
  const version=useRef(0),mutating=useRef(false);
  const [data,setData]=useState<{key:string;state:CollaborationState}>({key:"",state:empty});
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    async function refresh(){
      if(mutating.current)return;
      const generation=version.current;
      const session=await ensureSession();if(!active)return;
      if(!session.ok){setError(session.message);return;}
      const result=await request<CollaborationState>(`/api/graduation/workflow?studentId=${encodeURIComponent(studentId)}&mentorId=${encodeURIComponent(mentorId)}`);
      if(!active||generation!==version.current)return;
      if(result.ok){setData({key,state:result.data});setError("");}else setError(result.message);
    }
    void refresh();const timer=setInterval(()=>{if(document.visibilityState==="visible")void refresh();},2000);
    return()=>{active=false;clearInterval(timer);};
  },[key,studentId,mentorId]);
  const act=useCallback(async(command:CollaborationCommand)=>{
    if(mutating.current)return false;
    mutating.current=true;version.current++;setBusy(true);setError("");
    try{
      const session=await ensureSession();if(!session.ok){setError(session.message);return false;}
      const result=await postJson<CollaborationState>("/api/graduation/workflow",{studentId,mentorId,senderRole:role,command});
      if(current.current!==key)return false;
      if(!result.ok){setError(result.message);return false;}
      version.current++;setData({key,state:result.data});return true;
    }finally{mutating.current=false;setBusy(false);}
  },[key,studentId,mentorId,role]);
  return {state:data.key===key?data.state:empty,loading:data.key!==key,error,busy,act};
}
