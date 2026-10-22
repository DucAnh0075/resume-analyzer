export interface AgentElement {
  id: string;
  kind: "field" | "button" | "link" | "file";
  label: string;
  name?: string;
  type?: string; // input type, "textarea", "select", "radio", "checkbox"
  autocomplete?: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  value?: string;
  checked?: boolean;
  submit?: boolean; // button that submits a form
}

export type AgentAction =
  | { type: "fill"; id: string; value: string; label?: string; generated?: boolean }
  | { type: "select"; id: string; option: string; label?: string }
  | { type: "check"; id: string; checked: boolean; label?: string }
  | { type: "upload"; id: string; doc: "cv" | "cover"; label?: string }
  | { type: "click"; id: string; label?: string };

export interface AgentStepInput {
  jobId?: string;
  url: string;
  title: string;
  text: string;
  elements: AgentElement[];
  /** ids the agent already tried; never acted on twice */
  done?: string[];
  /** user answers to an earlier `ask` */
  answers?: { id: string; label: string; value: string; remember?: boolean }[];
}

export type AgentStatus = "continue" | "ready_to_submit" | "need_user" | "ask" | "done" | "blocked";

export interface AgentStepResult {
  status: AgentStatus;
  actions: AgentAction[];
  message?: string;
  submitId?: string;
  question?: { id: string; label: string; options?: string[] };
}
