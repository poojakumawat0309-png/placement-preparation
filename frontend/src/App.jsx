
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

const navItems = [
  ["dashboard", "Dashboard", "▦"],
  ["job", "Job Description", "⇧"],
  ["tests", "Assessments", "✓"],
  ["coding", "Coding Practice", "</>"],
  ["interview", "Interview Practice", "◉"],
  ["plan", "Preparation Plan", "▤"],
  ["history", "Assessment History", "◷"],
];

function App() {
  const [page, setPage] = useState("dashboard");
  const [job, setJob] = useState(null);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [interviewIndex, setInterviewIndex] = useState(0);

  async function loadHistory() {
    try {
      const response = await fetch(`${API}/api/history`);
      if (response.ok) setHistory(await response.json());
    } catch {
      // History will load when the backend is available.
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function analyzeJD(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const form = new FormData();
      form.append("title", title);
      form.append("company", company);
      form.append("description", description);
      if (file) form.append("file", file);

      const response = await fetch(`${API}/api/analyze`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not analyze the job description.");
      }

      setJob(data);
      setAssessment(null);
      setResult(null);
      setPage("dashboard");
    } catch (err) {
      setError(err.message || "Cannot connect to the backend. Is it running?");
    } finally {
      setBusy(false);
    }
  }

  function startAssessment(name, questions) {
    setAssessment({ name, questions });
    setAnswers({});
    setResult(null);
    setPage("test");
  }

  async function finishAssessment() {
    const questions = assessment.questions;
    const score = questions.filter(
      (q, index) => answers[index] === q.answer
    ).length;

    setResult({ score, total: questions.length });
    try {
      await fetch(`${API}/api/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.job_id,
          assessment: assessment.name,
          score,
          total: questions.length,
        }),
      });
      await loadHistory();
    } catch {
      setError("Your score is visible, but saving it failed. Check the backend.");
    }
  }

  function navTo(id) {
    setError("");
    if (!job && !["job", "history"].includes(id)) {
      setPage("job");
      setError("Upload and analyze a job description before starting preparation.");
      return;
    }
    setPage(id);
    setAssessment(null);
    setResult(null);
  }

  const completed = history.filter((item) => job && item.job_id === job.job_id);
  const average = completed.length
    ? Math.round(
        completed.reduce((sum, item) => sum + (item.score / item.total) * 100, 0)
        / completed.length
      )
    : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div><strong>PlacementPilot</strong><small>CAREER PREPARATION</small></div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => navTo(id)}
            >
              <span className="nav-icon">{icon}</span>{label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-avatar">S</div>
          <div><strong>Candidate</strong><small>Placement journey</small></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><span className="muted">Workspace / </span>{navItems.find(x => x[0] === page)?.[1] || "Assessment"}</div>
          <span className={`connection ${error ? "connection-error" : ""}`}>
            <span /> Local preparation system
          </span>
        </header>

        <div className="content">
          {error && <div className="alert">{error}</div>}

          {page === "job" && (
            <>
              <div className="page-heading">
                <div><div className="eyebrow">START HERE</div><h1>Job Description</h1>
                  <p>Upload the role you want to prepare for. Your practice will be based on its requirements.</p>
                </div>
              </div>

              <form className="panel upload-panel" onSubmit={analyzeJD}>
                <div className="upload-heading"><div className="upload-symbol">↑</div>
                  <div><h2>Upload your target role</h2><p>PDF or TXT, up to 5 MB</p></div>
                </div>

                <div className="form-grid">
                  <label>Job title <span>Optional</span>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Junior Python Developer" />
                  </label>
                  <label>Company <span>Optional</span>
                    <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. ABC Technologies" />
                  </label>
                </div>

                <label className="file-drop">
                  <span className="file-symbol">⇧</span>
                  <strong>{file ? file.name : "Choose a job description file"}</strong>
                  <span>Click to browse · PDF or TXT</span>
                  <input type="file" accept=".pdf,.txt" onChange={e => setFile(e.target.files?.[0] || null)} />
                </label>

                <div className="separator"><span>OR PASTE TEXT</span></div>
                <label>Job description
                  <textarea rows="8" value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Paste the job responsibilities, required skills, qualifications and experience here..." />
                </label>

                <button className="primary-button" disabled={busy}>
                  {busy ? "Analyzing job description..." : "Analyze JD and Build My Plan →"}
                </button>
              </form>
            </>
          )}

          {page === "dashboard" && (
            <>
              <div className="page-heading heading-row">
                <div><div className="eyebrow">YOUR PERSONAL WORKSPACE</div>
                  <h1>Preparation Dashboard</h1>
                  <p>Everything you practise is connected to your target job.</p>
                </div>
                <button className="primary-button compact" onClick={() => navTo("job")}>＋ {job ? "Change Job" : "Upload JD"}</button>
              </div>

              {!job ? (
                <div className="empty-state panel">
                  <div className="empty-icon">⇧</div><h2>Your preparation starts with a job description</h2>
                  <p>Upload a job description to identify its skills and unlock role-specific assessments.</p>
                  <button className="primary-button" onClick={() => navTo("job")}>Upload Job Description →</button>
                </div>
              ) : (
                <>
                  <div className="role-banner">
                    <div><div className="eyebrow">CURRENT TARGET ROLE</div>
                      <h2>{job.title}</h2><p>{job.company || "Company not specified"} · {job.skill_count} detected skills</p>
                    </div>
                    <div className="role-badge">JD analyzed ✓</div>
                  </div>

                  <div className="stat-grid">
                    <Stat label="Detected skills" value={job.skill_count} note="From your JD" icon="✳" />
                    <Stat label="Assessments taken" value={completed.length} note="For this job" icon="✓" />
                    <Stat label="Average score" value={`${average}%`} note="Completed tests" icon="↗" />
                  </div>

                  <section className="section-block">
                    <div className="section-heading"><div><h2>Your assessment centre</h2><p>Practise skills required by your target role.</p></div></div>
                    <div className="module-grid">
                      <Module icon="◈" title="Aptitude assessment" text="Numerical reasoning and problem-solving questions." action={() => startAssessment("Aptitude", job.aptitude)} />
                      <Module icon="⌘" title="Technical assessment" text={`Questions based on ${job.skills.slice(0, 3).join(", ") || "your job requirements"}.`} action={() => startAssessment("Technical", job.technical)} />
                      <Module icon="</>" title="Coding practice" text="Role-relevant programming and technical tasks." action={() => navTo("coding")} />
                      <Module icon="◉" title="Mock interview" text="Practise role-specific technical and HR questions." action={() => navTo("interview")} />
                    </div>
                  </section>

                  <section className="section-block">
                    <div className="section-heading"><div><h2>Skills identified from your JD</h2><p>Use these as your study priorities.</p></div></div>
                    <div className="panel skills-panel">
                      {job.skills.length ? job.skills.map(skill => <span className="skill-tag" key={skill}>{skill}</span>) : <p>No skills matched the current keyword list. Review the JD text and try again.</p>}
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {page === "tests" && job && (
            <>
              <PageTitle eyebrow="ASSESSMENT CENTRE" title="JD-based Assessments" subtitle="Take tests and save your scores against the current job." />
              <div className="module-grid">
                <Module icon="◈" title="Aptitude assessment" text={`${job.aptitude.length} questions · Numerical reasoning`} action={() => startAssessment("Aptitude", job.aptitude)} />
                <Module icon="⌘" title="Technical assessment" text={`${job.technical.length} questions · Detected skills`} action={() => startAssessment("Technical", job.technical)} />
              </div>
            </>
          )}

          {page === "test" && assessment && job && (
            <>
              <PageTitle eyebrow="ASSESSMENT IN PROGRESS" title={assessment.name} subtitle={`Questions: ${assessment.questions.length} · Job: ${job.title}`} />
              {!result ? (
                <div className="panel quiz-panel">
                  {assessment.questions.map((q, i) => (
                    <div className="question-block" key={i}>
                      <div className="question-number">QUESTION {i + 1}</div>
                      <h3>{q.question}</h3>
                      <div className="answer-options">
                        {q.options.map(option => (
                          <label className={`answer-option ${answers[i] === option ? "chosen" : ""}`} key={option}>
                            <input type="radio" name={`question-${i}`} checked={answers[i] === option}
                              onChange={() => setAnswers(old => ({ ...old, [i]: option }))} />
                            {option}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button className="primary-button" onClick={finishAssessment}>Submit assessment →</button>
                </div>
              ) : (
                <div className="panel result-panel">
                  <div className="result-circle">{Math.round(result.score / result.total * 100)}%</div>
                  <h2>Assessment completed</h2>
                  <p>You scored <strong>{result.score} out of {result.total}</strong>.</p>
                  <p>Review your answers and repeat practice to improve your score.</p>
                  <button className="primary-button" onClick={() => { setAssessment(null); setResult(null); setPage("dashboard"); }}>Back to dashboard</button>
                </div>
              )}
            </>
          )}

          {page === "coding" && job && (
            <>
              <PageTitle eyebrow="PRACTICAL SKILLS" title="Coding Practice" subtitle="Tasks selected from the skills detected in your job description." />
              {job.coding.map((task, i) => <div className="panel task-card" key={i}>
                <div className="task-top"><span className="skill-tag">{task.skill}</span><span className="muted">Task {i + 1}</span></div>
                <h3>{task.title}</h3><p>{task.description}</p>
                <label>Your solution / approach<textarea rows="4" placeholder="Write your code or explain your approach..." /></label>
              </div>)}
              <div className="notice">Coding tasks are practice prompts. Automatic code execution and scoring are not enabled in this version.</div>
            </>
          )}

          {page === "interview" && job && (
            <>
              <PageTitle eyebrow="MOCK INTERVIEW" title="Interview Practice" subtitle={`Prepare for the ${job.title} role.`} />
              <div className="panel interview-panel">
                <div className="question-number">QUESTION {interviewIndex + 1} OF {job.interview.length}</div>
                <h2>{job.interview[interviewIndex]}</h2>
                <p>Answer aloud or write your response below. Use a real example where possible.</p>
                <textarea rows="7" placeholder="Write your interview answer here..." />
                <div className="button-row">
                  <button className="secondary-button" disabled={interviewIndex === 0} onClick={() => setInterviewIndex(i => i - 1)}>Previous</button>
                  <button className="primary-button compact" onClick={() => setInterviewIndex(i => (i + 1) % job.interview.length)}>Next question →</button>
                </div>
              </div>
            </>
          )}

          {page === "plan" && job && (
            <>
              <PageTitle eyebrow="PERSONALIZED ROADMAP" title="Your Preparation Plan" subtitle="A starter seven-day plan based on the uploaded job description." />
              <div className="panel plan-list">
                {job.plan.map(item => <div className="plan-item" key={item.day}>
                  <div className="day-number">{item.day}</div><div><strong>Day {item.day}</strong><p>{item.task}</p></div>
                </div>)}
              </div>
            </>
          )}

          {page === "history" && (
            <>
              <PageTitle eyebrow="YOUR PROGRESS" title="Assessment History" subtitle="Previously saved assessment results." />
              <div className="panel history-panel">
                {history.length === 0 ? <div className="empty-state"><h2>No assessments yet</h2><p>Complete an assessment to see your results here.</p></div> :
                  <div className="table-wrap"><table><thead><tr><th>Assessment</th><th>Target job</th><th>Score</th><th>Date</th></tr></thead>
                    <tbody>{history.map(item => <tr key={item.id}><td>{item.assessment}</td><td>{item.title || "Target role"}</td><td><strong>{item.score}/{item.total}</strong></td><td>{new Date(item.created_at).toLocaleDateString()}</td></tr>)}</tbody>
                  </table></div>}
              </div>
            </>
          )}

          {page !== "job" && page !== "dashboard" && page !== "history" && page !== "test" && !job && (
            <div className="empty-state panel"><h2>Upload a job description first</h2><p>Assessments are available after a JD has been analyzed.</p><button className="primary-button" onClick={() => navTo("job")}>Upload JD →</button></div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, note, icon }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></div>;
}

function Module({ icon, title, text, action }) {
  return <button className="module-card" onClick={action}><span className="module-icon">{icon}</span><h3>{title}</h3><p>{text}</p><span className="module-link">Open module →</span></button>;
}

function PageTitle({ eyebrow, title, subtitle }) {
  return <div className="page-heading"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>;
}

export default App;
