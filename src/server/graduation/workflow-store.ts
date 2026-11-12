import { applyCollaboration, emptyCollaboration, type CollaborationState, type CollaborationCommand } from "../../features/graduation/workflow-model.ts";

/** Storage boundary: replace this repository with database transactions when deploying persistently. */
export class MemoryWorkflowRepository {
  private state: CollaborationState = emptyCollaboration();
  list(studentId:string,mentorId:string):CollaborationState {
    return structuredClone({version:1,reports:this.state.reports.filter(item=>item.studentId===studentId&&item.mentorId===mentorId),meetings:this.state.meetings.filter(item=>item.studentId===studentId&&item.mentorId===mentorId)});
  }
  apply(studentId:string,mentorId:string,role:"student"|"mentor",command:CollaborationCommand,now:string) {
    const recordId="reportId" in command?command.reportId:"meetingId" in command?command.meetingId:command.id;
    const existing=[...this.state.reports,...this.state.meetings].find(item=>item.id===recordId);
    if(existing&&(existing.studentId!==studentId||existing.mentorId!==mentorId))throw new Error("记录不属于当前会话。");
    if((command.type==="report-submit"||command.type==="meeting-create")&&command.mentorId!==mentorId)throw new Error("导师与当前会话不一致。");
    const next=applyCollaboration(this.state,command,{id:role==="student"?studentId:mentorId,role,students:[studentId]},now);
    this.state=next;
    return this.list(studentId,mentorId);
  }
}
const globalStore=globalThis as unknown as {graduationWorkflow?:MemoryWorkflowRepository};
export const workflowRepository=globalStore.graduationWorkflow ??= new MemoryWorkflowRepository();
