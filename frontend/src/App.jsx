
import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";
const MAX_INTERVIEW_QUESTIONS = 10;

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
  const [selectedHistory, setSelectedHistory] = useState(null);

  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const requestRef = useRef(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiFeedback, setAiFeedback] = useState(null);
  const [aiInterviewHistory, setAiInterviewHistory] = useState([]);
  const [aiInterviewBusy, setAiInterviewBusy] = useState(false);
  const [aiInterviewError, setAiInterviewError] = useState("");
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [interviewStartedAt, setInterviewStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    loadHistory();

    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach(track => track.stop());

      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!interviewStartedAt || interviewComplete) return undefined;

    const timer = window.setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - interviewStartedAt) / 1000)),
      1000
    );

    return () => window.clearInterval(timer);
  }, [interviewStartedAt, interviewComplete]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn, page]);

  useEffect(() => {
    if (!aiQuestion || page !== "interview" || !window.speechSynthesis) {
      return undefined;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(aiQuestion);
    speech.lang = "en-IN";
    speech.rate = 0.95;

    window.speechSynthesis.speak(speech);

    return () => window.speechSynthesis.cancel();
  }, [aiQuestion, page]);

  const completed = history.filter(
    item => job && Number(item.job_id) === Number(job.job_id)
  );

  const average = completed.length
    ? Math.round(
        completed.reduce(
          (sum, item) =>
            sum +
            (Number(item.total) > 0
              ? (Number(item.score) / Number(item.total)) * 100
              : 0),
          0
        ) / completed.length
      )
    : 0;

  const interviewAverage = aiInterviewHistory.length
    ? (
        aiInterviewHistory.reduce(
          (sum, item) => sum + Number(item.feedback?.score || 0),
          0
        ) / aiInterviewHistory.length
      ).toFixed(1)
    : "0";

  const interviewStrengths = aiInterviewHistory
    .map(item => item.feedback?.strengths)
    .filter(Boolean);

  const interviewImprovements = aiInterviewHistory
    .map(item => item.feedback?.improvements)
    .filter(Boolean);

  function formatDuration(seconds) {
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  }

  async function loadHistory() {
    try {
      const response = await fetch(`${API}/api/history`);

      if (response.ok) {
        const data = await response.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch {
      // Backend may not be running yet.
    }
  }

  async function analyzeJD(event) {
    event.preventDefault();

    setError("");
    setBusy(true);

    try {
      const form = new FormData();

      form.append("title", title);
      form.append("company", company);
      form.append("description", description);

      if (file) {
        form.append("file", file);
      }

      const response = await fetch(`${API}/api/analyze`, {
        method: "POST",
        body: form,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not analyze the job description."
        );
      }

      setJob(data);
      setAssessment(null);
      setResult(null);
      setSelectedHistory(null);
      resetAIInterview();
      await loadHistory();
      setPage("dashboard");
    } catch (err) {
      setError(
        err.message || "Cannot connect to the backend. Is it running?"
      );
    } finally {
      setBusy(false);
    }
  }

  function startAssessment(name, questions) {
    setAssessment({
      name,
      questions: Array.isArray(questions) ? questions : [],
    });

    setAnswers({});
    setResult(null);
    setPage("test");
  }

  async function finishAssessment() {
    if (!assessment?.questions?.length || !job) return;

    const score = assessment.questions.filter(
      (question, index) => answers[index] === question.answer
    ).length;

    setResult({
      score,
      total: assessment.questions.length,
    });

    try {
      const response = await fetch(`${API}/api/results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: job.job_id,
          assessment: assessment.name,
          score,
          total: assessment.questions.length,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Could not save your assessment.");
      }

      await loadHistory();
    } catch (err) {
      setError(
        `Your score is visible, but saving it failed. ${err.message}`
      );
    }
  }

  function navTo(id) {
    setError("");

    if (!job && !["job", "history"].includes(id)) {
      setPage("job");
      setError(
        "Upload and analyze a job description before starting preparation."
      );
      return;
    }

    setPage(id);
    setAssessment(null);
    setResult(null);
  }

  async function startCamera() {
    try {
      setCameraError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access requires localhost or HTTPS.");
      }

      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setCameraOn(true);
    } catch (err) {
      setCameraError(
        err.message || "Camera or microphone permission denied."
      );
    }
  }

  function startRecording() {
    if (!streamRef.current) {
      setCameraError("Start your camera before recording.");
      return;
    }

    if (!window.MediaRecorder) {
      setCameraError("Video recording is not supported by this browser.");
      return;
    }

    try {
      chunksRef.current = [];

      const recorder = new MediaRecorder(streamRef.current);
      recorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data?.size) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });

        if (blob.size) {
          setRecordedVideoUrl(old => {
            if (old) URL.revokeObjectURL(old);
            return URL.createObjectURL(blob);
          });
        }

        chunksRef.current = [];
      };

      recorder.start();
      setRecording(true);
      setCameraError("");
    } catch (err) {
      setCameraError(`Could not start recording: ${err.message}`);
    }
  }

  function stopRecording() {
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }

    setRecording(false);
  }

  function stopCamera() {
    if (recorderRef.current?.state === "recording") {
      stopRecording();
    }

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
  }

  function startVoiceAnswer() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError(
        "Voice input is not supported. Use Google Chrome or type your answer."
      );
      return;
    }

    try {
      setVoiceError("");

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.lang = "en-IN";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = event => {
        let finalText = "";

        for (
          let index = event.resultIndex;
          index < event.results.length;
          index++
        ) {
          if (event.results[index].isFinal) {
            finalText += `${event.results[index][0].transcript} `;
          }
        }

        if (finalText.trim()) {
          setAiAnswer(old =>
            `${old}${old ? " " : ""}${finalText.trim()}`
          );
        }
      };

      recognition.onerror = event => {
        setVoiceError(
          event.error === "not-allowed"
            ? "Allow microphone access in Chrome."
            : `Voice recognition error: ${event.error}`
        );

        setVoiceListening(false);
      };

      recognition.onend = () => setVoiceListening(false);

      recognition.start();
      setVoiceListening(true);
    } catch (err) {
      setVoiceError(
        err.message || "Could not start voice recognition."
      );
      setVoiceListening(false);
    }
  }

  function stopVoiceAnswer() {
    recognitionRef.current?.stop();
    setVoiceListening(false);
  }

  function speakCurrentQuestion() {
    if (!window.speechSynthesis || !aiQuestion) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(aiQuestion);
    speech.lang = "en-IN";
    speech.rate = 0.95;

    window.speechSynthesis.speak(speech);
  }

  function resetAIInterview() {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();

    setVoiceListening(false);
    setVoiceError("");
    setAiQuestion("");
    setAiAnswer("");
    setAiFeedback(null);
    setAiInterviewHistory([]);
    setAiInterviewError("");
    setAiInterviewBusy(false);
    setInterviewComplete(false);
    setInterviewStartedAt(null);
    setElapsedSeconds(0);

    requestRef.current = false;
  }

  async function getAIInterviewQuestion() {
    if (!job || interviewComplete || requestRef.current) return;

    if (aiInterviewHistory.length >= MAX_INTERVIEW_QUESTIONS) {
      setInterviewComplete(true);
      return;
    }

    requestRef.current = true;
    setAiInterviewBusy(true);
    setAiInterviewError("");
    setAiFeedback(null);
    setAiAnswer("");

    try {
      const response = await fetch(`${API}/api/interview/next`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: job.title,
          description: job.description || description,
          skills: job.skills || [],
          history: aiInterviewHistory.map(item => ({
            question: item.question,
            answer: item.answer,
          })),
          question_number: aiInterviewHistory.length + 1,
          total_questions: MAX_INTERVIEW_QUESTIONS,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || `Question request failed (${response.status}).`
        );
      }

      const question = String(
        data.question || data.next_question || data.text || ""
      ).trim();

      if (!question) {
        throw new Error("Backend did not return a question.");
      }

      const normalize = value =>
        value
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();

      if (
        aiInterviewHistory.some(
          item => normalize(item.question) === normalize(question)
        )
      ) {
        throw new Error(
          "The AI returned a repeated question. The backend must generate a new one."
        );
      }

      if (!interviewStartedAt) {
        setInterviewStartedAt(Date.now());
      }

      setAiQuestion(question);
    } catch (err) {
      setAiInterviewError(
        err.message || "Could not connect to the AI interview service."
      );
    } finally {
      requestRef.current = false;
      setAiInterviewBusy(false);
    }
  }

  async function evaluateAIInterviewAnswer() {
    if (!job || !aiQuestion.trim() || !aiAnswer.trim()) {
      setAiInterviewError(
        "Please write an answer before asking for feedback."
      );
      return;
    }

    if (requestRef.current) return;

    requestRef.current = true;
    setAiInterviewBusy(true);
    setAiInterviewError("");

    if (voiceListening) {
      stopVoiceAnswer();
    }

    try {
      const response = await fetch(`${API}/api/interview/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: job.title,
          description: job.description || description,
          question: aiQuestion,
          answer: aiAnswer,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || `Evaluation failed (${response.status}).`
        );
      }

      const updated = [
        ...aiInterviewHistory,
        {
          question: aiQuestion,
          answer: aiAnswer,
          feedback: data,
        },
      ];

      setAiFeedback(data);
      setAiInterviewHistory(updated);

      if (updated.length >= MAX_INTERVIEW_QUESTIONS) {
        setInterviewComplete(true);
      }
    } catch (err) {
      setAiInterviewError(
        err.message || "Could not connect to the AI interview service."
      );
    } finally {
      requestRef.current = false;
      setAiInterviewBusy(false);
    }
  }

  function downloadInterviewReport() {
    const report = [
      "PLACEMENT INTERVIEW REPORT",
      `Role: ${job?.title || "Not specified"}`,
      `Company: ${job?.company || "Not specified"}`,
      `Date: ${new Date().toLocaleString()}`,
      `Duration: ${formatDuration(elapsedSeconds)}`,
      `Questions completed: ${aiInterviewHistory.length}/${MAX_INTERVIEW_QUESTIONS}`,
      `Average score: ${interviewAverage}/10`,
      "",
      ...aiInterviewHistory.flatMap((item, index) => [
        `QUESTION ${index + 1}: ${item.question}`,
        `YOUR ANSWER: ${item.answer}`,
        `SCORE: ${item.feedback?.score ?? "Not available"}/10`,
        `STRENGTHS: ${item.feedback?.strengths || "Not provided"}`,
        `IMPROVEMENTS: ${item.feedback?.improvements || "Not provided"}`,
        `SAMPLE ANSWER: ${item.feedback?.sample_answer || "Not provided"}`,
        "",
      ]),
    ].join("\n");

    const url = URL.createObjectURL(
      new Blob([report], {
        type: "text/plain;charset=utf-8",
      })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "placement-interview-report.txt";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <strong>PlacementPilot</strong>
            <small>CAREER PREPARATION</small>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => navTo(id)}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-avatar">S</div>
          <div>
            <strong>Candidate</strong>
            <small>Placement journey</small>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="muted">Workspace / </span>
            {navItems.find(item => item[0] === page)?.[1] || "Assessment"}
          </div>

          <span className={`connection ${error ? "connection-error" : ""}`}>
            <span />
            Local preparation system
          </span>
        </header>

        <div className="content">
          {error && <div className="alert">{error}</div>}

          {page === "job" && (
            <>
              <PageTitle
                eyebrow="START HERE"
                title="Job Description"
                subtitle="Upload the role you want to prepare for. Your practice will be based on its requirements."
              />

              <form className="panel upload-panel" onSubmit={analyzeJD}>
                <div className="upload-heading">
                  <div className="upload-symbol">↑</div>
                  <div>
                    <h2>Upload your target role</h2>
                    <p>PDF or TXT, up to 5 MB</p>
                  </div>
                </div>

                <div className="form-grid">
                  <label>
                    Job title <span>Optional</span>
                    <input
                      value={title}
                      onChange={event => setTitle(event.target.value)}
                      placeholder="e.g. Junior Python Developer"
                    />
                  </label>

                  <label>
                    Company <span>Optional</span>
                    <input
                      value={company}
                      onChange={event => setCompany(event.target.value)}
                      placeholder="e.g. ABC Technologies"
                    />
                  </label>
                </div>

                <label className="file-drop">
                  <span className="file-symbol">⇧</span>
                  <strong>
                    {file ? file.name : "Choose a job description file"}
                  </strong>
                  <span>Click to browse · PDF or TXT</span>
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={event =>
                      setFile(event.target.files?.[0] || null)
                    }
                  />
                </label>

                <div className="separator">
                  <span>OR PASTE TEXT</span>
                </div>

                <label>
                  Job description
                  <textarea
                    rows="8"
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                    placeholder="Paste the job responsibilities, required skills, qualifications and experience here..."
                  />
                </label>

                <button className="primary-button" disabled={busy}>
                  {busy
                    ? "Analyzing job description..."
                    : "Analyze JD and Build My Plan →"}
                </button>
              </form>
            </>
          )}

          {page === "dashboard" && (
            <>
              <div className="page-heading heading-row">
                <div>
                  <div className="eyebrow">YOUR PERSONAL WORKSPACE</div>
                  <h1>Preparation Dashboard</h1>
                  <p>
                    Everything you practise is connected to your target job.
                  </p>
                </div>

                <button
                  className="primary-button compact"
                  onClick={() => navTo("job")}
                >
                  ＋ {job ? "Change Job" : "Upload JD"}
                </button>
              </div>

              {!job ? (
                <div className="empty-state panel">
                  <div className="empty-icon">⇧</div>
                  <h2>Your preparation starts with a job description</h2>
                  <p>
                    Upload a job description to identify its skills and
                    unlock role-specific assessments.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => navTo("job")}
                  >
                    Upload Job Description →
                  </button>
                </div>
              ) : (
                <>
                  <div className="role-banner">
                    <div>
                      <div className="eyebrow">CURRENT TARGET ROLE</div>
                      <h2>{job.title}</h2>
                      <p>
                        {job.company || "Company not specified"} ·{" "}
                        {job.skill_count ?? job.skills?.length ?? 0} detected
                        skills
                      </p>
                    </div>
                    <div className="role-badge">JD analyzed ✓</div>
                  </div>

                  <div className="stat-grid">
                    <Stat
                      label="Detected skills"
                      value={job.skill_count ?? job.skills?.length ?? 0}
                      note="From your JD"
                      icon="✳"
                    />
                    <Stat
                      label="Assessments taken"
                      value={completed.length}
                      note="For this job"
                      icon="✓"
                    />
                    <Stat
                      label="Average score"
                      value={`${average}%`}
                      note="Completed tests"
                      icon="↗"
                    />
                  </div>

                  <section className="section-block">
                    <div className="section-heading">
                      <div>
                        <h2>Your assessment centre</h2>
                        <p>Practise skills required by your target role.</p>
                      </div>
                    </div>

                    <div className="module-grid">
                      <Module
                        icon="◈"
                        title="Aptitude assessment"
                        text="Numerical reasoning and problem-solving questions."
                        action={() =>
                          startAssessment("Aptitude", job.aptitude)
                        }
                      />

                      <Module
                        icon="⌘"
                        title="Technical assessment"
                        text={`Questions based on ${(job.skills || [])
                          .slice(0, 3)
                          .join(", ") || "your job requirements"}.`}
                        action={() =>
                          startAssessment("Technical", job.technical)
                        }
                      />

                      <Module
                        icon="</>"
                        title="Coding practice"
                        text="Role-relevant programming and technical tasks."
                        action={() => navTo("coding")}
                      />

                      <Module
                        icon="◉"
                        title="Mock interview"
                        text="Practise role-specific technical and HR questions."
                        action={() => navTo("interview")}
                      />
                    </div>
                  </section>

                  <section className="section-block">
                    <div className="section-heading">
                      <div>
                        <h2>Skills identified from your JD</h2>
                        <p>Use these as your study priorities.</p>
                      </div>
                    </div>

                    <div className="panel skills-panel">
                      {job.skills?.length ? (
                        job.skills.map(skill => (
                          <span className="skill-tag" key={skill}>
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p>
                          No skills matched the current keyword list. Review
                          the JD text and try again.
                        </p>
                      )}
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {page === "tests" && job && (
            <>
              <PageTitle
                eyebrow="ASSESSMENT CENTRE"
                title="JD-based Assessments"
                subtitle="Take tests and save your scores against the current job."
              />

              <div className="module-grid">
                <Module
                  icon="◈"
                  title="Aptitude assessment"
                  text={`${job.aptitude?.length || 0} questions · Numerical reasoning`}
                  action={() =>
                    startAssessment("Aptitude", job.aptitude)
                  }
                />

                <Module
                  icon="⌘"
                  title="Technical assessment"
                  text={`${job.technical?.length || 0} questions · Detected skills`}
                  action={() =>
                    startAssessment("Technical", job.technical)
                  }
                />
              </div>
            </>
          )}

          {page === "test" && assessment && job && (
            <>
              <PageTitle
                eyebrow="ASSESSMENT IN PROGRESS"
                title={assessment.name}
                subtitle={`Questions: ${assessment.questions.length} · Job: ${job.title}`}
              />

              {!result ? (
                <div className="panel quiz-panel">
                  {assessment.questions.map((question, index) => (
                    <div className="question-block" key={index}>
                      <div className="question-number">
                        QUESTION {index + 1}
                      </div>

                      <h3>{question.question}</h3>

                      <div className="answer-options">
                        {(question.options || []).map(option => (
                          <label
                            className={`answer-option ${
                              answers[index] === option ? "chosen" : ""
                            }`}
                            key={option}
                          >
                            <input
                              type="radio"
                              name={`question-${index}`}
                              checked={answers[index] === option}
                              onChange={() =>
                                setAnswers(old => ({
                                  ...old,
                                  [index]: option,
                                }))
                              }
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    className="primary-button"
                    onClick={finishAssessment}
                    disabled={!assessment.questions.length}
                  >
                    Submit assessment →
                  </button>
                </div>
              ) : (
                <div className="panel result-panel">
                  <div className="result-circle">
                    {result.total > 0
                      ? Math.round((result.score / result.total) * 100)
                      : 0}
                    %
                  </div>

                  <h2>Assessment completed</h2>
                  <p>
                    You scored{" "}
                    <strong>
                      {result.score} out of {result.total}
                    </strong>
                    .
                  </p>
                  <p>
                    Review your answers and repeat practice to improve your
                    score.
                  </p>

                  <button
                    className="primary-button"
                    onClick={() => {
                      setAssessment(null);
                      setResult(null);
                      setPage("dashboard");
                    }}
                  >
                    Back to dashboard
                  </button>
                </div>
              )}
            </>
          )}

          {page === "coding" && job && (
            <>
              <PageTitle
                eyebrow="PRACTICAL SKILLS"
                title="Coding Practice"
                subtitle="Tasks selected from the skills detected in your job description."
              />

              {(job.coding || []).map((task, index) => (
                <div className="panel task-card" key={index}>
                  <div className="task-top">
                    <span className="skill-tag">{task.skill}</span>
                    <span className="muted">Task {index + 1}</span>
                  </div>

                  <h3>{task.title}</h3>
                  <p>{task.description}</p>

                  <label>
                    Your solution / approach
                    <textarea
                      rows="4"
                      placeholder="Write your code or explain your approach..."
                    />
                  </label>
                </div>
              ))}

              <div className="notice">
                Coding tasks are practice prompts. Automatic code execution
                and scoring are not enabled in this version.
              </div>
            </>
          )}

          {page === "interview" && job && (
            <>
              <PageTitle
                eyebrow="AI MOCK INTERVIEW"
                title="Interview Practice"
                subtitle={`Practise for ${job.title}. Complete 10 JD-based questions and receive an AI report.`}
              />

              <div className="panel interview-panel">
                <div className="camera-section">
                  <h2>Camera and microphone</h2>
                  <p>
                    Start your camera before the interview. You can record
                    your session and download it for personal review.
                  </p>

                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      maxWidth: "560px",
                      minHeight: "220px",
                      background: "#111",
                      borderRadius: "12px",
                      display: "block",
                      marginBottom: "14px",
                    }}
                  />

                  <div className="camera-controls">
                    {!cameraOn ? (
                      <button
                        className="primary-button compact"
                        onClick={startCamera}
                      >
                        Start Camera
                      </button>
                    ) : (
                      <button
                        className="primary-button compact"
                        onClick={stopCamera}
                      >
                        Stop Camera
                      </button>
                    )}

                    {!recording ? (
                      <button
                        className="primary-button compact"
                        onClick={startRecording}
                        disabled={!cameraOn}
                      >
                        Start Recording
                      </button>
                    ) : (
                      <button
                        className="primary-button compact"
                        onClick={stopRecording}
                      >
                        Stop Recording
                      </button>
                    )}
                  </div>

                  {cameraOn && (
                    <p className="muted">
                      Camera and microphone are active.
                    </p>
                  )}

                  {recording && (
                    <p className="muted">Recording in progress...</p>
                  )}

                  {cameraError && (
                    <div className="alert">{cameraError}</div>
                  )}

                  {recordedVideoUrl && (
                    <p>
                      <a
                        href={recordedVideoUrl}
                        download="placement-interview.webm"
                      >
                        Download recorded interview video
                      </a>
                    </p>
                  )}

                  <p className="muted">
                    Your camera preview and optional recording run in this
                    browser. Speech input converts your spoken answer into
                    text for AI evaluation. Video recording alone does not
                    analyse facial expressions or confidence.
                  </p>
                </div>

                <hr />

                <div className="question-number">
                  {interviewComplete
                    ? "INTERVIEW COMPLETED"
                    : !aiQuestion
                    ? "READY TO BEGIN"
                    : `INTERVIEW QUESTION ${Math.min(
                        aiInterviewHistory.length +
                          (aiFeedback ? 0 : 1),
                        MAX_INTERVIEW_QUESTIONS
                      )}`}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    margin: "14px 0",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    background: "#fafafa",
                  }}
                >
                  <div>
                    <strong>Interview progress</strong>
                    <div className="muted">
                      {aiInterviewHistory.length} of {MAX_INTERVIEW_QUESTIONS}{" "}
                      answers evaluated
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "18px" }}>
                    <span>⏱ {formatDuration(elapsedSeconds)}</span>
                    <span>● {cameraOn ? "Camera on" : "Camera off"}</span>
                    <span>
                      🎙 {voiceListening ? "Listening" : "Mic ready"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    height: "8px",
                    background: "#e5e7eb",
                    borderRadius: "99px",
                    overflow: "hidden",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${
                        (aiInterviewHistory.length /
                          MAX_INTERVIEW_QUESTIONS) *
                        100
                      }%`,
                      background: "#171717",
                      transition: "width 250ms ease",
                    }}
                  />
                </div>

                {!aiQuestion && !interviewComplete && (
                  <>
                    <h2>Start your role-specific interview</h2>
                    <p>
                      The AI will use your uploaded job description and
                      identified skills to generate questions.
                    </p>

                    <button
                      className="primary-button"
                      onClick={getAIInterviewQuestion}
                      disabled={aiInterviewBusy}
                    >
                      {aiInterviewBusy
                        ? "Generating question..."
                        : "Generate first question →"}
                    </button>
                  </>
                )}

                {aiQuestion && !interviewComplete && (
                  <>
                    <h2>{aiQuestion}</h2>
                    <p>
                      Listen to the interviewer, then answer aloud using
                      your microphone. You can also type your answer.
                    </p>

                    <div
                      className="camera-controls"
                      style={{ margin: "12px 0" }}
                    >
                      <button
                        type="button"
                        className="primary-button compact"
                        onClick={speakCurrentQuestion}
                      >
                        🔊 Repeat question
                      </button>

                      {!voiceListening ? (
                        <button
                          type="button"
                          className="primary-button compact"
                          onClick={startVoiceAnswer}
                          disabled={aiInterviewBusy || Boolean(aiFeedback)}
                        >
                          🎙️ Start speaking
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="primary-button compact"
                          onClick={stopVoiceAnswer}
                        >
                          ⏹ Stop speaking
                        </button>
                      )}
                    </div>

                    {voiceListening && (
                      <p className="muted">
                        Listening... Speak clearly. Press Stop speaking when
                        you finish.
                      </p>
                    )}

                    {voiceError && (
                      <div className="alert">{voiceError}</div>
                    )}

                    <label>
                      Your answer (speech is converted to text)
                      <textarea
                        rows="7"
                        value={aiAnswer}
                        onChange={event => setAiAnswer(event.target.value)}
                        placeholder="Your spoken answer will appear here. You can also type..."
                        disabled={aiInterviewBusy || Boolean(aiFeedback)}
                      />
                    </label>

                    {!aiFeedback ? (
                      <button
                        className="primary-button"
                        onClick={evaluateAIInterviewAnswer}
                        disabled={
                          aiInterviewBusy ||
                          voiceListening ||
                          !aiAnswer.trim()
                        }
                      >
                        {aiInterviewBusy
                          ? "Evaluating answer..."
                          : "Get AI feedback →"}
                      </button>
                    ) : (
                      <div className="interview-feedback">
                        <h3>AI feedback</h3>

                        {aiFeedback.score !== undefined && (
                          <p>
                            <strong>Score:</strong> {aiFeedback.score}/10
                          </p>
                        )}

                        {aiFeedback.strengths && (
                          <p>
                            <strong>Strengths:</strong>{" "}
                            {aiFeedback.strengths}
                          </p>
                        )}

                        {aiFeedback.improvements && (
                          <p>
                            <strong>Areas to improve:</strong>{" "}
                            {aiFeedback.improvements}
                          </p>
                        )}

                        {aiFeedback.sample_answer && (
                          <p>
                            <strong>Sample answer:</strong>{" "}
                            {aiFeedback.sample_answer}
                          </p>
                        )}

                        {aiInterviewHistory.length <
                        MAX_INTERVIEW_QUESTIONS ? (
                          <button
                            className="primary-button compact"
                            onClick={getAIInterviewQuestion}
                            disabled={aiInterviewBusy}
                          >
                            {aiInterviewBusy
                              ? "Generating..."
                              : "Next AI question →"}
                          </button>
                        ) : (
                          <p>
                            All 10 questions are complete. Your report is
                            shown below.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {aiInterviewError && (
                  <div className="alert">{aiInterviewError}</div>
                )}

                {aiInterviewHistory.length > 0 && (
                  <p className="muted">
                    Answered questions: {aiInterviewHistory.length}/
                    {MAX_INTERVIEW_QUESTIONS}
                  </p>
                )}

                {interviewComplete && (
                  <div className="interview-feedback">
                    <h2>Final Interview Report</h2>

                    <div className="stat-grid">
                      <Stat
                        label="Questions completed"
                        value={aiInterviewHistory.length}
                        note="Interview questions"
                        icon="✓"
                      />

                      <Stat
                        label="Average score"
                        value={`${interviewAverage}/10`}
                        note="AI answer evaluation"
                        icon="↗"
                      />
                    </div>

                    <h3>Strengths</h3>

                    {interviewStrengths.length ? (
                      interviewStrengths.map((item, index) => (
                        <p key={index}>• {item}</p>
                      ))
                    ) : (
                      <p>No strengths were returned.</p>
                    )}

                    <h3>Areas to improve</h3>

                    {interviewImprovements.length ? (
                      interviewImprovements.map((item, index) => (
                        <p key={index}>• {item}</p>
                      ))
                    ) : (
                      <p>No improvement suggestions were returned.</p>
                    )}

                    <div
                      className="camera-controls"
                      style={{ marginTop: "18px" }}
                    >
                      <button
                        className="primary-button"
                        onClick={downloadInterviewReport}
                      >
                        Download interview report ↓
                      </button>

                      <button
                        className="primary-button compact"
                        onClick={resetAIInterview}
                      >
                        Start a New Interview
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {page === "plan" && job && (
            <>
              <PageTitle
                eyebrow="PERSONALIZED ROADMAP"
                title="Your Preparation Plan"
                subtitle="A starter seven-day plan based on the uploaded job description."
              />

              <div className="panel plan-list">
                {(job.plan || []).map(item => (
                  <div className="plan-item" key={item.day}>
                    <div className="day-number">{item.day}</div>
                    <div>
                      <strong>Day {item.day}</strong>
                      <p>{item.task}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* COMPLETE ASSESSMENT HISTORY SECTION */}
          {page === "history" && (
            <>
              <PageTitle
                eyebrow="YOUR PROGRESS"
                title="Assessment History"
                subtitle="Previously saved assessment results."
              />

              <div className="panel history-panel">
                {history.length === 0 ? (
                  <div className="empty-state">
                    <h2>No assessments yet</h2>
                    <p>
                      Complete an assessment to see your results here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Assessment</th>
                            <th>Target job</th>
                            <th>Score</th>
                            <th>Date</th>
                            <th>Report</th>
                          </tr>
                        </thead>

                        <tbody>
                          {history.map(item => (
                            <tr key={item.id}>
                              <td>{item.assessment}</td>
                              <td>{item.title || "Target role"}</td>

                              <td>
                                <strong>
                                  {item.score}/{item.total}
                                </strong>
                              </td>

                              <td>
                                {item.created_at
                                  ? new Date(
                                      item.created_at
                                    ).toLocaleString()
                                  : "Not available"}
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="primary-button compact"
                                  onClick={() =>
                                    setSelectedHistory(item)
                                  }
                                >
                                  View report
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {selectedHistory && (
                      <div
                        className="panel result-panel"
                        style={{ marginTop: "24px" }}
                      >
                        <div className="eyebrow">ASSESSMENT REPORT</div>

                        <h2>
                          {selectedHistory.assessment} Assessment
                        </h2>

                        <p>
                          <strong>Target role:</strong>{" "}
                          {selectedHistory.title || "Target role"}
                        </p>

                        <p>
                          <strong>Company:</strong>{" "}
                          {selectedHistory.company || "Not specified"}
                        </p>

                        <p>
                          <strong>Date:</strong>{" "}
                          {selectedHistory.created_at
                            ? new Date(
                                selectedHistory.created_at
                              ).toLocaleString()
                            : "Not available"}
                        </p>

                        <div className="result-circle">
                          {Number(selectedHistory.total) > 0
                            ? Math.round(
                                (Number(selectedHistory.score) /
                                  Number(selectedHistory.total)) *
                                  100
                              )
                            : 0}
                          %
                        </div>

                        <h3>
                          Score: {selectedHistory.score}/
                          {selectedHistory.total}
                        </h3>

                        <p>
                          {Number(selectedHistory.total) > 0 &&
                          Number(selectedHistory.score) /
                            Number(selectedHistory.total) >=
                            0.8
                            ? "Excellent performance! Keep practising to maintain your progress."
                            : Number(selectedHistory.total) > 0 &&
                              Number(selectedHistory.score) /
                                Number(selectedHistory.total) >=
                                0.5
                            ? "Good effort! Revise the topics where you made mistakes."
                            : "Keep practising. Review the fundamentals and try another assessment."}
                        </p>

                        <button
                          type="button"
                          className="primary-button compact"
                          onClick={() => setSelectedHistory(null)}
                        >
                          Close report
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {page !== "job" &&
            page !== "dashboard" &&
            page !== "history" &&
            page !== "test" &&
            !job && (
              <div className="empty-state panel">
                <h2>Upload a job description first</h2>
                <p>
                  Assessments are available after a JD has been analyzed.
                </p>

                <button
                  className="primary-button"
                  onClick={() => navTo("job")}
                >
                  Upload JD →
                </button>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, note, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function Module({ icon, title, text, action }) {
  return (
    <button className="module-card" onClick={action}>
      <span className="module-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <span className="module-link">Open module →</span>
    </button>
  );
}

function PageTitle({ eyebrow, title, subtitle }) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

export default App;
