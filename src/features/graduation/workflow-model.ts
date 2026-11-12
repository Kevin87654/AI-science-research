export interface ReportSource { id: string; date: string; title: string; note: string | null }
export interface WeeklyRevision { sourceNodes?: ReportSource[]; id: string; title: string; content: string; submittedAt: string; decision?: "approved" | "revision"; feedback?: string; reviewedAt?: string }
export interface WeeklyReport { id: string; studentId: string; mentorId: string; week: string; revisions: WeeklyRevision[] }
export interface MeetingProposal { id: string; authorId: string; start: string; end: string; place: string; createdAt: string }
export interface QuestionReply { id:string; authorId:string; body:string; createdAt:string }
export interface MeetingRequest { resolved?:boolean; replies?:QuestionReply[]; id: string; studentId: string; mentorId: string; title: string; question: string; status: "open" | "pending" | "confirmed" | "declined" | "cancelled" | "completed" | "answered"; proposals: MeetingProposal[]; response: string; updatedAt: string }
export interface CollaborationState { version: 1; reports: WeeklyReport[]; meetings: MeetingRequest[] }
export interface CollaborationActor { id: string; role: "student" | "mentor"; students: string[] }
export type CollaborationCommand =
  | {type:"question-reply";id:string;meetingId:string;body:string}
  | {type:"question-status";meetingId:string;resolved:boolean}
  | { type: "report-submit"; id: string; mentorId: string; week: string; title: string; content: string; sourceNodes?: ReportSource[]; reportId?: string; revisionId?: string }
  | { type: "report-review"; reportId: string; revisionId: string; decision: "approved" | "revision"; feedback: string }
  | { type: "meeting-create"; id: string; mentorId: string; title: string; question: string; start?: string; end?: string; place?: string }
  | { type: "meeting-propose"; id: string; meetingId: string; proposalId: string; start: string; end: string; place: string }
  | { type: "meeting-respond"; meetingId: string; proposalId: string; action: "confirm" | "decline" | "cancel" | "complete" | "answer"; response: string };
export const emptyCollaboration = (): CollaborationState => ({version:1,reports:[],meetings:[]});
export function mondayOf(date: string) { const value=new Date(date+"T00:00:00Z");value.setUTCDate(value.getUTCDate()-(value.getUTCDay()+6)%7);return value.toISOString().slice(0,10); }
export function shanghaiDate(time: string) { return new Date(Date.parse(time)+8*3600000).toISOString().slice(0,10); }
export function reportStatus(report: WeeklyReport) { return report.revisions.at(-1)?.decision || "submitted"; }
function fail(message:string):never { throw new Error(message); }
function text(value:string,max:number,label:string,required=false) { if(typeof value!=="string" || value.trim().length>max || (required&&!value.trim()))fail(`${label}${required?"必填，":""}最多 ${max} 字。`);return value.trim(); }
function student(actor:CollaborationActor) { if(actor.role!=="student")fail("仅学生可以提交。 "); }
function access(actor:CollaborationActor,item:{studentId:string;mentorId:string}) {
  if(actor.role==="student" ? actor.id!==item.studentId : actor.id!==item.mentorId || !actor.students.includes(item.studentId))fail("该记录不属于当前账号或导师小组。");
}
function proposal(input:{id:string;start:string;end:string;place:string},actor:CollaborationActor,now:string):MeetingProposal {
  for(const value of [input.start,input.end]) if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))fail("会面时间无效。");
  const start=new Date(input.start).toISOString(),end=new Date(input.end).toISOString();
  if(start<=now || end<=start)fail("请选择未来时间，结束须晚于开始。");
  return {id:input.id,authorId:actor.id,start,end,place:text(input.place,200,"地点",true),createdAt:now};
}
/** Framework-independent transitions. The server repository applies each command to its latest state. */
export function applyCollaboration(state:CollaborationState,command:CollaborationCommand,actor:CollaborationActor,now:string):CollaborationState {
  const next=structuredClone(state);
  if(command.type==="report-submit") {
    student(actor);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(command.week) || !Number.isFinite(Date.parse(command.week+"T00:00:00Z")) || new Date(command.week+"T00:00:00Z").toISOString().slice(0,10)!==command.week || mondayOf(command.week)!==command.week || command.week>mondayOf(shanghaiDate(now)))fail("请选择本周或往周的周一。");
    if (command.sourceNodes && (!Array.isArray(command.sourceNodes) || command.sourceNodes.length>100)) fail("每次最多关联 100 条进展。");
    const sources=command.sourceNodes?.map(node=>({id:text(node.id,150,"记录编号",true),date:text(node.date,10,"记录日期",true),title:text(node.title,100,"记录标题",true),note:text(node.note || "",20000,"记录内容")}));
    const written=text(command.content,20000,"补充说明",!sources?.length);
    const revision:WeeklyRevision={sourceNodes:sources,id:command.id,title:text(command.title,100,"标题"),content:written,submittedAt:now};
    if(command.reportId) {
      const report=next.reports.find(item=>item.id===command.reportId) ?? fail("周记录不存在。");access(actor,report);
      if(reportStatus(report)!=="revision" || report.revisions.at(-1)?.id!==command.revisionId)fail("记录状态已变化，请刷新后再提交。");
      if(report.week!==command.week)fail("返修不能改变所属周。");
      report.revisions.push(revision);
    } else {
      if(next.reports.some(item=>item.id===command.id)) return next;
      next.reports.push({id:command.id,studentId:actor.id,mentorId:command.mentorId,week:command.week,revisions:[revision]});
    }
  } else if(command.type==="report-review") {
    const report=next.reports.find(item=>item.id===command.reportId) ?? fail("周记录不存在。");access(actor,report);
    if(actor.role!=="mentor")fail("只有导师可以审阅。");
    if(!["approved","revision"].includes(command.decision))fail("审阅状态无效。");
    const revision=report.revisions.at(-1)!;
    if(revision.id!==command.revisionId || revision.decision)fail("这轮已处理，请刷新后查看。");
    revision.feedback=text(command.feedback,4000,"导师意见",command.decision==="revision");revision.decision=command.decision;revision.reviewedAt=now;
  } else if(command.type==="meeting-create") {
    student(actor);
    if(next.meetings.some(item=>item.id===command.id)) return next;
    const first=command.start || command.end || command.place ? proposal({...command,start:command.start || "",end:command.end || "",place:command.place || ""},actor,now) : null;
    next.meetings.push({id:command.id,studentId:actor.id,mentorId:command.mentorId,title:text(command.title,100,"问题标题",true),question:text(command.question,10000,"问题说明",true),status:first?"pending":"open",proposals:first?[first]:[],replies:[],resolved:false,response:"",updatedAt:now});
  } else {
    const meeting=next.meetings.find(item=>item.id===command.meetingId) ?? fail("问题不存在。");access(actor,meeting);
    if(command.type==="question-reply") {
      if(meeting.resolved)fail("请先重新打开问题再继续讨论。");
      (meeting.replies ??= []).push({id:command.id,authorId:actor.id,body:text(command.body,10000,"回复",true),createdAt:now});meeting.updatedAt=now;return next;
    }
    if(command.type==="question-status") {
      student(actor);meeting.resolved=command.resolved;
      if(command.resolved&&meeting.status==="pending")meeting.status="cancelled";
      meeting.updatedAt=now;return next;
    }
    const latest=meeting.proposals.at(-1);
    if((latest?.id || "")!==command.proposalId)fail("已有新时间提议，请刷新后查看。");
    if(command.type==="meeting-propose") {
      if(meeting.resolved)fail("请先重新打开问题再约定会面。");
      if(meeting.status==="confirmed")fail("已确认会面请先取消或完成，再约定新时间。");
      meeting.proposals.push(proposal(command,actor,now));meeting.status="pending";
    } else {
      const response=text(command.response,4000,"答复",["decline","answer"].includes(command.action));
      if(["confirm","decline","answer"].includes(command.action)) {
        if(meeting.status!=="pending")fail("申请已处理，请刷新后查看。");
        if(command.action==="confirm") {
          if(!latest)fail("请先共同约定时间地点。");
          if(latest.authorId===actor.id)fail("需要对方确认时间地点。");
          if(latest.start<=now)fail("提议已过期，请重新约定。");
          if(next.meetings.some(item=>item.id!==meeting.id&&item.status==="confirmed"&&(item.studentId===meeting.studentId||item.mentorId===meeting.mentorId)&&item.proposals.at(-1)!.start<latest.end&&item.proposals.at(-1)!.end>latest.start))fail("学生或导师在该时段已有会面，请另约时间。");
        } else if(actor.role!=="mentor")fail("只有导师可以答复或拒绝申请。");
        meeting.status=command.action==="confirm"?"confirmed":command.action==="answer"?"answered":"declined";
      } else if(command.action==="cancel") {
        if(!["pending","confirmed"].includes(meeting.status))fail("该会面安排已结束。");meeting.status="cancelled";
      } else if(command.action==="complete") {
        if(meeting.status!=="confirmed" || !latest || latest.start>now)fail("会面尚未开始或尚未确认。");meeting.status="completed";
      } else fail("操作无效。");
      meeting.response=response || meeting.response;
    }
    meeting.updatedAt=now;
  }
  return next;
}
