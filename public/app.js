const defaultSeeds = [
  {
    id: "oss-security-local",
    name: "Open-source local audit candidates",
    query: "topic:security language:TypeScript stars:>500",
    paid: false,
    safeHarbor: "unknown",
    allowsLocalTesting: true,
    allowsLiveTesting: false,
    requiresEnrollment: false,
    maxResults: 5,
    notes: "Candidate discovery only. Attach official authorization before audit progression."
  }
];

const state = {
  activeTab: "queue",
  lastResult: {},
  approvals: loadApprovals(),
  pipelineRunning: false,
  auditRunning: false
};

const healthStatus = document.querySelector("#healthStatus");
const seedInput = document.querySelector("#seedInput");
const pipelineForm = document.querySelector("#pipelineForm");
const auditForm = document.querySelector("#auditForm");
const repoPathInput = document.querySelector("#repoPathInput");
const clearButton = document.querySelector("#clearButton");
const resultSubtitle = document.querySelector("#resultSubtitle");
const rawPanel = document.querySelector("#rawPanel");
const queuePanel = document.querySelector("#queuePanel");
const approvedPanel = document.querySelector("#approvedPanel");
const rejectedPanel = document.querySelector("#rejectedPanel");
const auditPanel = document.querySelector("#auditPanel");
const tabs = [...document.querySelectorAll(".tab")];
const stages = [...document.querySelectorAll(".stage")];

const metrics = {
  discovered: document.querySelector("#metricDiscovered"),
  enriched: document.querySelector("#metricEnriched"),
  queued: document.querySelector("#metricQueued"),
  rejected: document.querySelector("#metricRejected")
};

seedInput.value = JSON.stringify(defaultSeeds, null, 2);

function loadApprovals() {
  try {
    return JSON.parse(localStorage.getItem("obw.approvals") ?? "{}");
  }
  catch {
    return {};
  }
}

function saveApprovals() {
  localStorage.setItem("obw.approvals", JSON.stringify(state.approvals));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setBusy(form, busy) {
  for (const button of form.querySelectorAll("button")) {
    button.disabled = busy;
  }
}

function setStageStatus(stageName, status) {
  const stage = stages.find((candidate) => candidate.dataset.stage === stageName);
  if (!stage) {
    return;
  }
  stage.classList.remove("active", "done", "blocked");
  if (status) {
    stage.classList.add(status);
  }
}

function resetStages() {
  for (const stage of stages) {
    stage.classList.remove("active", "done", "blocked");
  }
}

function renderMetrics(result) {
  metrics.discovered.textContent = String(result.discoveredCount ?? 0);
  metrics.enriched.textContent = String(result.enrichedCount ?? 0);
  metrics.queued.textContent = String(result.auditQueue?.length ?? 0);
  metrics.rejected.textContent = String(result.rejected?.length ?? 0);
}

function emptyState(title, detail) {
  return `
    <div class="empty">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function renderQueue(queue = []) {
  const pending = queue.filter((item) => !state.approvals[item.programId]);

  if (pending.length === 0) {
    queuePanel.innerHTML = emptyState("No audit queue items", "Run the pipeline or use seeds with stronger authorization signals.");
    return;
  }

  queuePanel.innerHTML = pending.map((item) => `
    <article class="item-card">
      <div class="item-main">
        <div>
          <span class="chip success">Ready for approval</span>
          <h3>${escapeHtml(item.name)}</h3>
        </div>
        <strong class="score">${Math.round((item.score ?? 0) * 100)}%</strong>
      </div>
      <dl>
        <div><dt>Repo</dt><dd><a href="${escapeHtml(item.repoUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.repoUrl)}</a></dd></div>
        <div><dt>Disclosure</dt><dd>${item.disclosureUrl ? `<a href="${escapeHtml(item.disclosureUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.disclosureUrl)}</a>` : "Not attached"}</dd></div>
        <div><dt>Next step</dt><dd>${escapeHtml(item.safeNextStep)}</dd></div>
      </dl>
      <div class="actions">
        <button type="button" data-approve="${escapeHtml(item.programId)}">Approve local audit</button>
      </div>
    </article>
  `).join("");
}

function renderApproved(queue = []) {
  const approved = queue.filter((item) => state.approvals[item.programId]);

  if (approved.length === 0) {
    approvedPanel.innerHTML = emptyState("No approved items", "Approve a queued candidate to get the local audit commands.");
    return;
  }

  approvedPanel.innerHTML = approved.map((item) => {
    const directoryName = item.programId.replace(/[^a-z0-9._-]/gi, "-");
    const command = `mkdir -p ~/obw-targets && cd ~/obw-targets && git clone ${item.repoUrl} ${directoryName} && cd /home/hs-chilu/open-bounty-workbench && npx tsx src/cli/index.ts audit-local ~/obw-targets/${directoryName}`;

    return `
      <article class="item-card approved-card">
        <div class="item-main">
          <div>
            <span class="chip success">Approved</span>
            <h3>${escapeHtml(item.name)}</h3>
          </div>
          <button class="secondary" type="button" data-unapprove="${escapeHtml(item.programId)}">Undo</button>
        </div>
        <dl>
          <div><dt>Repo</dt><dd><a href="${escapeHtml(item.repoUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.repoUrl)}</a></dd></div>
          <div><dt>Approved</dt><dd>${escapeHtml(state.approvals[item.programId].approvedAt)}</dd></div>
          <div><dt>Mac mini</dt><dd><code>${escapeHtml(command)}</code></dd></div>
        </dl>
        <div class="actions">
          <button type="button" data-copy-command="${escapeHtml(command)}">Copy command</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderRejected(rejected = []) {
  if (rejected.length === 0) {
    rejectedPanel.innerHTML = emptyState("No rejected candidates", "Rejected items will appear here when scope or signal is insufficient.");
    return;
  }

  rejectedPanel.innerHTML = rejected.map((item) => `
    <article class="item-card">
      <div class="item-main">
        <div>
          <span class="chip warning">${escapeHtml(item.refusalReason ?? "blocked")}</span>
          <h3>${escapeHtml(item.name)}</h3>
        </div>
      </div>
      <p>${escapeHtml(item.safeNextStep ?? "Add authorization evidence before continuing.")}</p>
    </article>
  `).join("");
}

function renderAudit(result) {
  const findings = result.findings ?? [];
  if (!Array.isArray(findings) || findings.length === 0) {
    auditPanel.innerHTML = emptyState("No audit findings", "Run a local audit on an approved checkout to populate this view.");
    return;
  }

  auditPanel.innerHTML = findings.map((finding) => `
    <article class="item-card">
      <div class="item-main">
        <div>
          <span class="chip ${finding.severity === "high" ? "danger" : "warning"}">${escapeHtml(finding.severity)}</span>
          <h3>${escapeHtml(finding.title)}</h3>
        </div>
        <strong class="rule">${escapeHtml(finding.ruleId)}</strong>
      </div>
      <dl>
        <div><dt>Location</dt><dd>${escapeHtml(finding.file)}:${escapeHtml(finding.line)}</dd></div>
        <div><dt>Evidence</dt><dd><code>${escapeHtml(finding.evidence)}</code></dd></div>
        <div><dt>Next step</dt><dd>${escapeHtml(finding.safeNextStep)}</dd></div>
      </dl>
    </article>
  `).join("");
}

function renderRaw(result) {
  rawPanel.textContent = JSON.stringify(result, null, 2);
}

function renderAll(result) {
  state.lastResult = result;
  renderMetrics(result);
  renderQueue(result.auditQueue ?? []);
  renderApproved(result.auditQueue ?? []);
  renderRejected(result.rejected ?? []);
  renderAudit(result);
  renderRaw(result);
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  for (const tab of tabs) {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  }
  for (const panel of document.querySelectorAll(".tab-panel")) {
    panel.classList.toggle("active", panel.id === `${tabName}Panel`);
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}`);
  }

  return payload;
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error("unhealthy");
    }
    healthStatus.textContent = `Online: ${payload.runtime ?? "local"}`;
    healthStatus.className = "status ok";
  }
  catch {
    healthStatus.textContent = "Offline";
    healthStatus.className = "status error";
  }
}

pipelineForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(pipelineForm, true);
  resetStages();
  setStageStatus("discover", "active");
  resultSubtitle.textContent = "Pipeline running...";

  try {
    const seeds = JSON.parse(seedInput.value);
    const result = await postJson("/api/pipeline", { seeds });
    setStageStatus("discover", "done");
    setStageStatus("enrich", "done");
    setStageStatus("triage", "done");
    setStageStatus("approve", result.auditQueue?.length ? "active" : "blocked");
    renderAll(result);
    setActiveTab(result.auditQueue?.length ? "queue" : "rejected");
    resultSubtitle.textContent = `${result.auditQueue?.length ?? 0} candidate(s) waiting for human approval.`;
  }
  catch (error) {
    resetStages();
    setStageStatus("discover", "blocked");
    const message = error instanceof Error ? error.message : "Unknown error";
    renderAll({ error: message });
    setActiveTab("raw");
    resultSubtitle.textContent = "Pipeline failed.";
  }
  finally {
    setBusy(pipelineForm, false);
  }
});

auditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(auditForm, true);
  setStageStatus("audit", "active");
  resultSubtitle.textContent = "Local static audit running...";

  try {
    const result = await postJson("/api/audit-local", {
      repoPath: repoPathInput.value
    });
    setStageStatus("audit", "done");
    renderAll(result);
    setActiveTab("audit");
    resultSubtitle.textContent = `${result.findings?.length ?? 0} static hypothesis finding(s).`;
  }
  catch (error) {
    setStageStatus("audit", "blocked");
    const message = error instanceof Error ? error.message : "Unknown error";
    renderAll({ error: message });
    setActiveTab("raw");
    resultSubtitle.textContent = "Local audit unavailable or failed.";
  }
  finally {
    setBusy(auditForm, false);
  }
});

for (const tab of tabs) {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const approveId = target.dataset.approve;
  if (approveId) {
    state.approvals[approveId] = {
      approvedAt: new Date().toISOString()
    };
    saveApprovals();
    renderAll(state.lastResult);
    setActiveTab("approved");
    resultSubtitle.textContent = "Candidate approved for local-only audit.";
    return;
  }

  const unapproveId = target.dataset.unapprove;
  if (unapproveId) {
    delete state.approvals[unapproveId];
    saveApprovals();
    renderAll(state.lastResult);
    setActiveTab("queue");
    resultSubtitle.textContent = "Approval removed.";
    return;
  }

  const copyCommand = target.dataset.copyCommand;
  if (copyCommand) {
    await navigator.clipboard.writeText(copyCommand);
    target.textContent = "Copied";
    setTimeout(() => {
      target.textContent = "Copy command";
    }, 1200);
  }
});

clearButton.addEventListener("click", () => {
  resetStages();
  renderAll({});
  setActiveTab("queue");
  resultSubtitle.textContent = "Run a pipeline to populate the queue.";
});

renderAll({});
void checkHealth();
