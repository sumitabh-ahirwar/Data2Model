const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof payload === "object" ? payload.detail : payload;
    throw new Error(Array.isArray(detail) ? detail.map((item) => item.msg).join(", ") : detail || "Request failed");
  }

  return payload;
}

export function getStoredToken() {
  return localStorage.getItem("modelsmith_token");
}

export function setStoredToken(token) {
  localStorage.setItem("modelsmith_token", token);
}

export function clearStoredToken() {
  localStorage.removeItem("modelsmith_token");
}

export async function registerUser(payload) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function loginUser(payload) {
  const response = await fetch(`${API_URL}/auth/login/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function getMe(token) {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function getSubmissions(token) {
  const response = await fetch(`${API_URL}/submit/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function getSubmission(token, submissionId) {
  const response = await fetch(`${API_URL}/submit/${submissionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function getTrainingLogs(token, submissionId) {
  const response = await fetch(`${API_URL}/submit/${submissionId}/logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function createSubmission(token, payload) {
  const formData = new FormData();
  formData.append("target_column", payload.targetColumn);
  formData.append("use_case", payload.useCase);
  formData.append("requirement", payload.requirement);
  formData.append("dataset", payload.dataset);

  const response = await fetch(`${API_URL}/submit/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseResponse(response);
}

export async function trainSubmission(token, submissionId) {
  const response = await fetch(`${API_URL}/submit/${submissionId}/train`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

function getFilenameFromDisposition(disposition) {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || null;
}

export async function downloadSubmission(token, submissionId) {
  const response = await fetch(`${API_URL}/submit/${submissionId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await parseResponse(response);
  }

  return {
    blob: await response.blob(),
    fileName: getFilenameFromDisposition(response.headers.get("content-disposition")),
  };
}
