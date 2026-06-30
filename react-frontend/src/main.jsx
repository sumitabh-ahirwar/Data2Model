import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  CloudUpload,
  Database,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  Logs,
  LogOut,
  Mail,
  Play,
  ShieldCheck,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";
import {
  clearStoredToken,
  createSubmission,
  downloadSubmission,
  getMe,
  getStoredToken,
  getSubmissions,
  getTrainingLogs,
  loginUser,
  registerUser,
  setStoredToken,
  trainSubmission,
} from "./api";
import "./styles.css";

function App() {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(token));
  const [view, setView] = useState(token ? "dashboard" : "login");

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }

    getMe(token)
      .then((profile) => {
        setUser(profile);
        setView("dashboard");
      })
      .catch(() => {
        clearStoredToken();
        setToken(null);
        setUser(null);
        setView("login");
      })
      .finally(() => setBooting(false));
  }, [token]);

  function handleAuthenticated(auth) {
    setStoredToken(auth.access_token);
    setToken(auth.access_token);
    setUser(auth.user);
    setView("dashboard");
  }

  function handleLogout() {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setView("login");
  }

  if (booting) {
    return <LoadingScreen />;
  }

  if (!token || view === "login" || view === "signup") {
    return (
      <AuthPage
        mode={view === "signup" ? "signup" : "login"}
        onModeChange={setView}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return <Dashboard token={token} user={user} onLogout={handleLogout} />;
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <div className="loading-mark">
        <Brain size={34} />
      </div>
      <p>Preparing your model workspace</p>
    </main>
  );
}

function AuthPage({ mode, onModeChange, onAuthenticated }) {
  const isSignup = mode === "signup";
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    identifier: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignup) {
        await registerUser({
          full_name: form.full_name,
          username: form.username,
          email: form.email,
          password: form.password,
        });
        const auth = await loginUser({ identifier: form.username, password: form.password });
        onAuthenticated(auth);
      } else {
        const auth = await loginUser({ identifier: form.identifier, password: form.password });
        onAuthenticated(auth);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <nav className="brand-row">
          <div className="brand-mark">
            <Brain size={26} />
          </div>
          <span>ModelSmith</span>
        </nav>

        <div className="hero-copy">
          <p className="eyebrow">Dataset to deployable neural model</p>
          <h1>Forge trained models from raw CSV data.</h1>
          <p>
            Upload a dataset, describe the prediction goal, and let the platform design,
            train, track, and package a neural network workflow.
          </p>
        </div>

        <div className="pipeline-strip" aria-hidden="true">
          <StepPill icon={<FileSpreadsheet size={18} />} label="CSV" />
          <StepPill icon={<Wand2 size={18} />} label="Constraints" />
          <StepPill icon={<Activity size={18} />} label="Optuna" />
          <StepPill icon={<Brain size={18} />} label="Model" />
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <p>{isSignup ? "Create account" : "Welcome back"}</p>
            <h2>{isSignup ? "Start building models" : "Sign in to ModelSmith"}</h2>
          </div>

          <div className="segmented">
            <button className={!isSignup ? "active" : ""} onClick={() => onModeChange("login")}>Login</button>
            <button className={isSignup ? "active" : ""} onClick={() => onModeChange("signup")}>Sign up</button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {isSignup ? (
              <>
                <Field icon={<User size={18} />} label="Full name">
                  <input
                    value={form.full_name}
                    onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                    placeholder="Aarav Sharma"
                    autoComplete="name"
                  />
                </Field>
                <Field icon={<ShieldCheck size={18} />} label="Username">
                  <input
                    required
                    value={form.username}
                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                    placeholder="aarav_ml"
                    autoComplete="username"
                  />
                </Field>
                <Field icon={<Mail size={18} />} label="Email">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </Field>
              </>
            ) : (
              <Field icon={<User size={18} />} label="Username or email">
                <input
                  required
                  value={form.identifier}
                  onChange={(event) => setForm({ ...form, identifier: event.target.value })}
                  placeholder="you@example.com"
                  autoComplete="username"
                />
              </Field>
            )}

            <Field icon={<ShieldCheck size={18} />} label="Password">
              <div className="password-row">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  minLength={isSignup ? 8 : 1}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder={isSignup ? "At least 8 chars, letter and number" : "Your password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />
                <button type="button" className="icon-button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            {error && <div className="form-error">{error}</div>}

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
              {isSignup ? "Create workspace" : "Open dashboard"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Dashboard({ token, user, onLogout }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      setSubmissions(await getSubmissions(token));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const hasActiveJob = submissions.some((item) => ["queued", "training"].includes(item.status));
    if (!hasActiveJob) {
      return undefined;
    }

    const intervalId = window.setInterval(refresh, 3000);
    return () => window.clearInterval(intervalId);
  }, [submissions]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const completed = submissions.filter((item) => item.status === "completed").length;
    const training = submissions.filter((item) => item.status === "training").length;
    return { total, completed, training };
  }, [submissions]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">
            <Brain size={24} />
          </div>
          <span>ModelSmith</span>
        </div>

        <div className="profile-block">
          <div className="avatar">{(user?.full_name || user?.username || "U").slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user?.full_name || user?.username}</strong>
            <span>{user?.email}</span>
          </div>
        </div>

        <div className="sidebar-nav">
          <button className="active"><Sparkles size={18} /> Workspace</button>
          <button><Database size={18} /> Datasets</button>
          <button><Activity size={18} /> Training</button>
        </div>

        <button className="logout-button" onClick={onLogout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">AutoML command center</p>
            <h1>Build a model from a dataset</h1>
          </div>
          <button className="ghost-button" onClick={refresh}>
            <Activity size={18} />
            Refresh
          </button>
        </header>

        <section className="metrics-grid">
          <Metric label="Submissions" value={stats.total} icon={<FileSpreadsheet size={20} />} />
          <Metric label="Training" value={stats.training} icon={<Loader2 size={20} />} />
          <Metric label="Completed" value={stats.completed} icon={<CheckCircle2 size={20} />} />
        </section>

        <section className="work-grid">
          <SubmissionForm token={token} onCreated={refresh} setMessage={setMessage} />
          <SubmissionList token={token} loading={loading} submissions={submissions} refresh={refresh} setMessage={setMessage} />
        </section>

        {message && (
          <div className="toast" onAnimationEnd={() => setMessage("")}>
            {message}
          </div>
        )}
      </section>
    </main>
  );
}

function SubmissionForm({ token, onCreated, setMessage }) {
  const [dataset, setDataset] = useState(null);
  const [targetColumn, setTargetColumn] = useState("");
  const [useCase, setUseCase] = useState("");
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!dataset) {
      setMessage("Select a CSV dataset first.");
      return;
    }

    setLoading(true);
    try {
      await createSubmission(token, { dataset, targetColumn, useCase, requirement });
      setDataset(null);
      setTargetColumn("");
      setUseCase("");
      setRequirement("");
      setMessage("Dataset submitted successfully.");
      onCreated();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel upload-panel" onSubmit={submit}>
      <div className="panel-heading">
        <CloudUpload size={22} />
        <div>
          <h2>New model job</h2>
          <p>Send a CSV and goal to the FastAPI pipeline.</p>
        </div>
      </div>

      <label className="dropzone">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setDataset(event.target.files?.[0] || null)}
        />
        <FileSpreadsheet size={34} />
        <strong>{dataset ? dataset.name : "Drop or choose a CSV file"}</strong>
        <span>{dataset ? `${Math.ceil(dataset.size / 1024)} KB ready` : "The backend will clean, encode, scale, and store it."}</span>
      </label>

      <Field label="Target column">
        <input required value={targetColumn} onChange={(event) => setTargetColumn(event.target.value)} placeholder="Price" />
      </Field>

      <Field label="Use case">
        <textarea required value={useCase} onChange={(event) => setUseCase(event.target.value)} placeholder="Predict customer churn from account activity and support history." />
      </Field>

      <Field label="Training requirement">
        <textarea required value={requirement} onChange={(event) => setRequirement(event.target.value)} placeholder="Optimize for recall, avoid overfitting, prefer compact architecture." />
      </Field>

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
        Submit model job
      </button>
    </form>
  );
}

function SubmissionList({ token, loading, submissions, refresh, setMessage }) {
  const [activeLogs, setActiveLogs] = useState({});
  const [downloading, setDownloading] = useState({});

  async function train(id) {
    try {
      const result = await trainSubmission(token, id);
      setMessage(result.message || "Training queued.");
      await refresh();
      await loadLogs(id);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function loadLogs(id) {
    try {
      const logs = await getTrainingLogs(token, id);
      setActiveLogs((current) => ({ ...current, [id]: logs }));
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function downloadArtifact(submission) {
    const id = submission._id || submission.id;
    if (submission.status !== "completed") {
      return;
    }

    setDownloading((current) => ({ ...current, [id]: true }));
    try {
      const { blob, fileName } = await downloadSubmission(token, id);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName || `${submission.target_column.replace(/\s+/g, "_").toLowerCase()}_model_artifacts.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setDownloading((current) => ({ ...current, [id]: false }));
    }
  }

  useEffect(() => {
    submissions
      .filter((submission) => ["queued", "training", "failed", "completed"].includes(submission.status))
      .slice(0, 6)
      .forEach((submission) => {
        const id = submission._id || submission.id;
        loadLogs(id);
      });
  }, [submissions]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <Brain size={22} />
        <div>
          <h2>Model jobs</h2>
          <p>Track created datasets, training status, and artifacts.</p>
        </div>
      </div>

      <div className="job-list">
        {loading ? (
          <div className="empty-state"><Loader2 className="spin" size={22} /> Loading jobs</div>
        ) : submissions.length === 0 ? (
          <div className="empty-state">No jobs yet. Submit a CSV to begin.</div>
        ) : (
          submissions.map((submission) => (
            <article className={`job-card ${["queued", "training"].includes(submission.status) ? "is-active" : ""}`} key={submission._id || submission.id}>
              <div>
                <span className={`status-badge ${submission.status}`}>{submission.status}</span>
                <h3>{submission.target_column}</h3>
                <p>{submission.use_case}</p>
                {["queued", "training"].includes(submission.status) && (
                  <div className="training-inline">
                    <Loader2 className="spin" size={16} />
                    {submission.status === "queued" ? "Waiting for a Celery worker" : "Model is training on your dataset"}
                  </div>
                )}
                {submission.error_message && <div className="inline-error">{submission.error_message}</div>}
              </div>
              <div className="job-actions">
                <button className="ghost-button" onClick={() => train(submission._id || submission.id)} disabled={["queued", "training"].includes(submission.status)}>
                  <Play size={16} />
                  {submission.status === "failed" ? "Retry" : "Train"}
                </button>
                <button className="ghost-button" onClick={() => loadLogs(submission._id || submission.id)}>
                  <Logs size={16} />
                  Logs
                </button>
                <button
                  type="button"
                  className="download-link"
                  onClick={() => downloadArtifact(submission)}
                  disabled={submission.status !== "completed" || downloading[submission._id || submission.id]}
                >
                  {downloading[submission._id || submission.id] ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
                  Download
                </button>
              </div>
              <LogPanel logs={activeLogs[submission._id || submission.id] || submission.training_logs || []} />
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function LogPanel({ logs }) {
  const visibleLogs = logs.slice(-8);

  if (!visibleLogs.length) {
    return (
      <div className="log-panel muted">
        <span>No training logs yet.</span>
      </div>
    );
  }

  return (
    <div className="log-panel">
      {visibleLogs.map((entry, index) => (
        <div className="log-line" key={`${entry.timestamp}-${index}`}>
          <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
          <code>{entry.message}</code>
        </div>
      ))}
    </div>
  );
}

function Field({ icon, label, children }) {
  return (
    <label className="field">
      <span>{icon}{label}</span>
      {children}
    </label>
  );
}

function StepPill({ icon, label }) {
  return (
    <div className="step-pill">
      {icon}
      {label}
    </div>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
