import { findAccountById } from "@/features/auth/demo-accounts";
import type { CollaborationCommand } from "@/features/graduation/workflow-model";
import { workflowRepository } from "@/server/graduation/workflow-store";
import { readSession } from "@/server/services/identity";
import { jsonError, jsonOk, toErrorResponse } from "@/server/services/api-response";

function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==="object"&&!Array.isArray(value);}
function validCommand(value:unknown):value is CollaborationCommand {
  if(!record(value)||typeof value.type!=="string")return false;
  const required:Record<string,string[]>={"report-submit":["id","mentorId","week","title","content"],"report-review":["reportId","revisionId","decision","feedback"],"meeting-create":["id","mentorId","title","question"],"question-reply":["id","meetingId","body"],"question-status":["meetingId"],"meeting-propose":["id","meetingId","proposalId","start","end","place"],"meeting-respond":["meetingId","proposalId","action","response"]};
  if(!Object.hasOwn(required,value.type))return false;
  const fields=required[value.type];
  if(!fields||fields.some(key=>typeof value[key]!=="string"))return false;
  if(value.type==="question-status"&&typeof value.resolved!=="boolean")return false;
  if(value.type==="report-submit") {
    if(value.reportId!==undefined&&typeof value.reportId!=="string" || value.revisionId!==undefined&&typeof value.revisionId!=="string")return false;
    if(value.sourceNodes!==undefined&&(!Array.isArray(value.sourceNodes)||value.sourceNodes.length>100||value.sourceNodes.some(node=>!record(node)||["id","date","title"].some(key=>typeof node[key]!=="string")||(node.note!==null&&typeof node.note!=="string"))))return false;
  }
  return true;
}
function pair(student:unknown,mentor:unknown) {
  if(typeof student!=="string"||typeof mentor!=="string"||student.length>32||mentor.length>32)return null;
  return findAccountById(student)?.role==="student"&&findAccountById(mentor)?.role==="mentor"?{studentId:student,mentorId:mentor}:null;
}
/** Same demo identity boundary as messages: anonymous API cookie + declared demo role. */
export async function handleWorkflowGet(request:Request) {
  try {
    if(!await readSession(request.headers.get("cookie")))return jsonError("UNAUTHORIZED","请先建立会话。");
    const url=new URL(request.url),thread=pair(url.searchParams.get("studentId"),url.searchParams.get("mentorId"));
    if(!thread)return jsonError("BAD_REQUEST","会话双方无效。");
    return jsonOk(workflowRepository.list(thread.studentId,thread.mentorId));
  }catch(error){return toErrorResponse(error);}
}
export async function handleWorkflowPost(request:Request) {
  try {
    if(!await readSession(request.headers.get("cookie")))return jsonError("UNAUTHORIZED","请先建立会话。");
    const origin=request.headers.get("origin");
    if(origin&&new URL(origin).host!==(request.headers.get("host")||new URL(request.url).host))return jsonError("FORBIDDEN","请求来源无效。");
    const raw=await request.text();if(raw.length>1000000)return jsonError("BAD_REQUEST","提交内容过大。");
    let body:unknown;try{body=JSON.parse(raw);}catch{return jsonError("BAD_REQUEST","提交格式无效。");}
    if(!record(body))return jsonError("BAD_REQUEST","提交格式无效。");
    const thread=pair(body.studentId,body.mentorId);
    if(!thread||!["student","mentor"].includes(String(body.senderRole))||!validCommand(body.command))return jsonError("BAD_REQUEST","会话或操作参数无效。");
    try{return jsonOk(workflowRepository.apply(thread.studentId,thread.mentorId,body.senderRole as "student"|"mentor",body.command,new Date().toISOString()));}
    catch(error){return jsonError("CONFLICT",error instanceof Error?error.message:"状态已变化，请刷新。");}
  }catch(error){return toErrorResponse(error);}
}
