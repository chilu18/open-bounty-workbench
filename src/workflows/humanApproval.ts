import { requireHumanApproval } from "../policy/gates.js";

export async function externalActionGateWorkflow(action: string) {
  "use workflow";

  return requireApprovalStep(action);
}

async function requireApprovalStep(action: string) {
  "use step";

  return requireHumanApproval(action);
}
