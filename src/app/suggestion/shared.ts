import type { FormState } from "../admin/shared";

/** Shared by the suggestion form and the action that sends it. */

export const SUGGESTION_EMAIL = "jobhunters.ai.pro@gmail.com";
export const SUGGESTION_FROM = "Running Doc Suggestions <running-doc-suggestions@kim-brothers.com>";
export const MAX_IMAGES = 3;

export const SUGGESTION_TYPES = [
  { value: "Feature request", label: "Feature request", hint: "What were you trying to do, what got in the way, and how would the change help you plan or run your race?" },
  { value: "Bug", label: "Bug", hint: "What you did, what you expected, what happened instead, and which race, browser and device you were on." },
  { value: "Other", label: "Other", hint: "A race to add, a question, or anything else. A few sentences of context go a long way." },
];

export type SuggestionState = FormState & { sent?: boolean };
