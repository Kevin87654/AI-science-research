"use client";
import { useEffect, useState } from "react";
import type { StudentNode } from "@/contracts";
import { formalDraftKey, useWorkflow } from "./use-workflow";
import { mondayOf, shanghaiDate, reportStatus, type CollaborationCommand, type WeeklyReport, type MeetingRequest, type ReportSource } from "./workflow-model";
import { StudentNodeTimeline } from "./timeline";

type Act=(command:CollaborationCommand)=>Promise<boolean>;
type Draft={type:"report"|"question";id:string;title:string;content:string;sources:ReportSource[];reportId?:string;revisionId?:string;week?:string};
const stamp=(value:string)=>new Intl.DateTimeFormat("zh-CN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Shanghai"}).format(new Date(value));
const labels={submitted:"待导师反馈",revision:"待修改",approved:"已通过",open:"讨论中",pending:"会面待确认",confirmed:"会面已确认",cancelled:"会面已取消",completed:"会面已完成",declined:"提议未接受",answered:"已有在线答复"};
function Badge({value}:{value:keyof typeof labels}){return <span className="status-pill">{labels[value]}</span>;}
function Sources({items}:{items:ReportSource[]}){return <div className="wf-sources">{items.map(node=><div key={node.id}><strong>{node.date} · {node.title}</strong><p>{node.note}</p></div>)}</div>;}
function SubmissionCard({report,role,act,busy,onEdit}:{report:WeeklyReport;role:"student"|"mentor";act:Act;busy:boolean;onEdit:(draft:Draft)=>void}) {
  const latest=report.revisions.at(-1)!;const [feedback,setFeedback]=useState("");
  return <details className="wf-card"><summary><strong>正式提交 · {latest.title || "进展汇报"}</strong><Badge value={reportStatus(report)}/></summary><div className="wf-card-body"><p className="section-note">第 {report.revisions.length} 轮 · {stamp(latest.submittedAt)}</p>{latest.sourceNodes?.length?<Sources items={latest.sourceNodes}/>:null}<p className="wf-prose">{latest.content}</p>
    {latest.decision?<div className="wf-feedback"><strong>导师反馈</strong><p>{latest.feedback || "已通过本轮提交。"}</p></div>:null}
    {role==="mentor"&&!latest.decision?<form onSubmit={async event=>{event.preventDefault();const button=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;if(await act({type:"report-review",reportId:report.id,revisionId:latest.id,decision:button.value as "approved"|"revision",feedback}))setFeedback("");}}><label>导师意见<textarea className="field-input" rows={3} maxLength={4000} value={feedback} onChange={event=>setFeedback(event.target.value)} placeholder="要求修改时填写具体建议。"/></label><div className="form-actions"><button className="button-small" disabled={busy} value="approved">通过</button><button className="button-ghost" disabled={busy} value="revision">要求修改</button></div></form>:null}
    {role==="student"&&latest.decision==="revision"?<button className="button-small" disabled={busy} onClick={()=>onEdit({type:"report",id:crypto.randomUUID(),title:latest.title,content:latest.content,sources:latest.sourceNodes || [],reportId:report.id,revisionId:latest.id,week:report.week})}>修改并重新提交</button>:null}
    {report.revisions.length>1?<details className="wf-history"><summary>历史提交与反馈（{report.revisions.length-1} 轮）</summary>{report.revisions.slice(0,-1).map((item,index)=><article key={item.id}><strong>第 {index+1} 轮 · {stamp(item.submittedAt)}</strong>{item.sourceNodes?.length?<Sources items={item.sourceNodes}/>:null}<p className="wf-prose">{item.content}</p><p>导师意见：{item.feedback || "无补充意见"}</p></article>)}</details>:null}
  </div></details>;
}
function QuestionCard({question,role,actorId,act,busy}:{question:MeetingRequest;role:"student"|"mentor";actorId:string;act:Act;busy:boolean}) {
  const [reply,setReply]=useState(""),[proposing,setProposing]=useState(false),[start,setStart]=useState(""),[end,setEnd]=useState(""),[place,setPlace]=useState("");
  const latest=question.proposals.at(-1);
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const respond=(action:"confirm"|"cancel"|"complete")=>act({type:"meeting-respond",meetingId:question.id,proposalId:latest?.id || "",action,response:""});
  return <details className="wf-card"><summary><strong>解惑 · {question.title}</strong><span className="status-pill">{question.resolved?"已解决":"讨论中"}</span>{latest?<Badge value={question.status}/>:null}</summary><div className="wf-card-body"><p className="wf-prose">{question.question}</p>
    {(question.replies || []).map(message=><article className="wf-reply" key={message.id}><strong>{message.authorId===question.studentId?"学生":"导师"}</strong><small> · {stamp(message.createdAt)}</small><p className="wf-prose">{message.body}</p></article>)}
    {!question.resolved?<form onSubmit={async event=>{event.preventDefault();if(await act({type:"question-reply",id:crypto.randomUUID(),meetingId:question.id,body:reply}))setReply("");}}><label>问题内回复<textarea className="field-input" rows={3} value={reply} maxLength={10000} onChange={event=>setReply(event.target.value)} required/></label><button className="button-small" disabled={busy} type="submit">发送问题回复</button></form>:null}
    {role==="student"?<button className="button-ghost" disabled={busy} onClick={()=>act({type:"question-status",meetingId:question.id,resolved:!question.resolved})}>{question.resolved?"重新打开问题":"标记问题已解决"}</button>:null}
    <div className="wf-meeting"><h4>会面安排（按需）</h4>{latest?<><p>{stamp(latest.start)} — {stamp(latest.end)}</p><p>地点：{latest.place} · {latest.authorId===actorId?"你":"对方"}提出</p></>:<p className="section-note">先在线讨论，需要深入探讨时再共同商议时间地点。</p>}
      {question.status==="pending"&&latest?<><p className="section-note">{Date.parse(latest.start)<=clock?"提议已过期，请重新商议。":latest.authorId===actorId?"等待对方确认，尚未进入个人进度。":"请确认时间地点，或提出其他安排。"}</p>{latest.authorId!==actorId&&Date.parse(latest.start)>clock&&!question.resolved?<button className="button-small" disabled={busy} onClick={()=>respond("confirm")}>确认会面</button>:null}</>:null}
      {!question.resolved&&question.status!=="confirmed"?<button className="button-ghost" onClick={()=>setProposing(!proposing)}>{latest?"重新商议会面":"需要面谈，商议时间地点"}</button>:null}
      {proposing&&!question.resolved&&question.status!=="confirmed"?<form className="wf-form" onSubmit={async event=>{event.preventDefault();if(await act({type:"meeting-propose",id:crypto.randomUUID(),meetingId:question.id,proposalId:latest?.id || "",start:start+"+08:00",end:end+"+08:00",place}))setProposing(false);}}><label>开始时间（北京时间）<input className="field-input" type="datetime-local" value={start} onChange={event=>setStart(event.target.value)} required/></label><label>结束时间（北京时间）<input className="field-input" type="datetime-local" value={end} onChange={event=>setEnd(event.target.value)} required/></label><label>会面地点<input className="field-input" maxLength={200} value={place} onChange={event=>setPlace(event.target.value)} required/></label><button className="button-small" disabled={busy}>发送会面提议</button></form>:null}
      {["pending","confirmed"].includes(question.status)?<button className="button-ghost" disabled={busy} onClick={()=>respond("cancel")}>取消会面安排</button>:null}
      {question.status==="confirmed"&&latest&&Date.parse(latest.start)<=clock?<button className="button-small" disabled={busy} onClick={()=>respond("complete")}>标记会面完成</button>:null}
      {question.proposals.length>1?<details><summary>此前的时间提议（{question.proposals.length-1} 次）</summary>{question.proposals.slice(0,-1).map(item=><p key={item.id}>{stamp(item.start)} · {item.place}</p>)}</details>:null}
    </div></div></details>;
}

export function WorkflowPanel({role,studentId,mentorId,nodes=[]}:{role:"student"|"mentor";studentId:string;mentorId:string;nodes?:readonly StudentNode[]}) {
  const {state,loading,error,busy,act}=useWorkflow(studentId,mentorId,role);
  const [draft,setDraft]=useState<Draft|null>(()=>{
    if(role!=="student"||typeof window==="undefined")return null;
    try{const raw=sessionStorage.getItem(formalDraftKey(studentId,mentorId));if(!raw)return null;const value=JSON.parse(raw);if(typeof value.title!=="string"||typeof value.content!=="string"||!Array.isArray(value.sources))return null;return {type:"report",id:crypto.randomUUID(),...value};}catch{return null;}
  });
  const [notice,setNotice]=useState("");
  function compose(type:"report"|"question") {setDraft({type,id:crypto.randomUUID(),title:"",content:"",sources:type==="report"?nodes.map(item=>({id:item.id,date:item.date,title:item.title,note:item.note})):[]});setNotice("");}
  return <section className="wf-panel" aria-label="提交与解惑"><header className="wf-head"><strong>提交与解惑</strong><span className="section-note">{loading?"正在同步记录…":`${state.reports.length} 份正式提交 · ${state.meetings.length} 个问题`}</span></header>
    {role==="student"?<div className="form-actions"><button className="button-ghost" onClick={()=>compose("report")}>正式提交进展</button><button className="button-ghost" onClick={()=>compose("question")}>发起解惑</button></div>:null}
    {draft&&role==="student"?<form className="wf-form" onSubmit={async event=>{event.preventDefault();const command:CollaborationCommand=draft.type==="report"?{type:"report-submit",id:draft.id,mentorId,week:draft.week || mondayOf(shanghaiDate(new Date().toISOString())),title:draft.title,content:draft.content,sourceNodes:draft.sources,reportId:draft.reportId,revisionId:draft.revisionId}:{type:"meeting-create",id:draft.id,mentorId,title:draft.title,question:draft.content};if(await act(command)){setNotice(draft.type==="report"?"正式提交已送达，导师可在记录卡片中反馈。":"问题已发出，可以继续在线交流。");setDraft(null);sessionStorage.removeItem(formalDraftKey(studentId,mentorId));}}}><h4>{draft.type==="report"?"确认正式提交":"发起解惑"}</h4><label>{draft.type==="report"?"提交标题（选填）":"问题标题"}<input className="field-input" value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})} maxLength={100} required={draft.type==="question"}/></label>
    {draft.type==="report"&&draft.sources.length?<details open><summary>随本次提交保存的进展快照（{draft.sources.length} 条）</summary><Sources items={draft.sources}/><button type="button" className="button-ghost" onClick={()=>setDraft({...draft,sources:[]})}>仅提交说明，不附带进展</button></details>:null}
    <label>{draft.type==="report"?"补充说明":"问题说明"}<textarea aria-label={draft.type==="report"?"补充说明":"问题说明"} className="field-input" value={draft.content} onChange={event=>setDraft({...draft,content:event.target.value})} rows={5} maxLength={draft.type==="report"?20000:10000} required={draft.type==="question"||!draft.sources.length}/></label><p className="section-note">{draft.type==="report"?"提交后保存独立快照；后续修改日常节点不会改写本次提交。":"先在线交流，不要求现在决定是否面谈或填写时间地点。"}</p><div className="form-actions"><button className="button-small" disabled={busy}>{draft.reportId?"重新提交给导师":draft.type==="report"?"确认提交给导师":"发送问题"}</button><button type="button" className="button-ghost" onClick={()=>{setDraft(null);sessionStorage.removeItem(formalDraftKey(studentId,mentorId));}}>取消编辑</button></div></form>:null}
    {notice?<p role="status">{notice}</p>:null}{error?<p className="error-text" role="alert">{error}</p>:null}
    <div className="wf-records">{state.reports.toReversed().map(report=><SubmissionCard key={report.id} report={report} role={role} busy={busy} act={act} onEdit={setDraft}/>)}{state.meetings.toReversed().map(question=><QuestionCard key={question.id} question={question} role={role} actorId={role==="student"?studentId:mentorId} busy={busy} act={act}/>)}</div>
  </section>;
}

export function ProgressWithMeetings({nodes,studentId,mentorId,onRemove,onOpenContact}:{nodes:readonly StudentNode[];studentId:string;mentorId:string;onRemove:(id:string)=>void;onOpenContact:()=>void}) {
  const {state}=useWorkflow(studentId,mentorId,"student");
  const meetings:StudentNode[]=state.meetings.filter(item=>["confirmed","completed"].includes(item.status)).map(item=>{const proposal=item.proposals.at(-1)!;return {id:"meeting:"+item.id,date:shanghaiDate(proposal.start),title:"会面 · "+item.title,note:stamp(proposal.start)+" · "+proposal.place+" · "+labels[item.status],createdAt:item.updatedAt};});
  return <StudentNodeTimeline nodes={[...nodes,...meetings].sort((a,b)=>a.date.localeCompare(b.date))} emptyHint="先记录一条进度；已确认会面也会显示在这里。" onRemove={onRemove} canRemove={node=>!node.id.startsWith("meeting:")} onOpen={onOpenContact}/>;
}
