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

const healthStatus = document.querySelector("#healthStatus");
const seedInput = document.querySelector("#seedInput");
const pipelineForm = document.querySelector("#pipelineForm");
const auditForm = document.querySelector("#auditForm");
const repoPathInput = document.querySelector("#repoPathInput");
const output = document.querySelector("#output");
const clearButton = document.querySelector("#clearButton");

seedInput.value = JSON.stringify(defaultSeeds, null, 2);

function setOutput(value) {
  output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function setBusy(form, busy) {
  for (const button of form.querySelectorAll("button")) {
    button.disabled = busy;
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
    if (!response.ok) {
      throw new Error("unhealthy");
    }
    healthStatus.textContent = "Online";
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
  setOutput("Running pipeline...");

  try {
    const seeds = JSON.parse(seedInput.value);
    const result = await postJson("/api/pipeline", { seeds });
    setOutput(result);
  }
  catch (error) {
    setOutput({ error: error instanceof Error ? error.message : "Unknown error" });
  }
  finally {
    setBusy(pipelineForm, false);
  }
});

auditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(auditForm, true);
  setOutput("Running local static audit...");

  try {
    const result = await postJson("/api/audit-local", {
      repoPath: repoPathInput.value
    });
    setOutput(result);
  }
  catch (error) {
    setOutput({ error: error instanceof Error ? error.message : "Unknown error" });
  }
  finally {
    setBusy(auditForm, false);
  }
});

clearButton.addEventListener("click", () => setOutput({}));

void checkHealth();
