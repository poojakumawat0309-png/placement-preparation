
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "placement.db"

app = FastAPI(title="Placement Preparation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SKILL_ALIASES = {
    "Python": ["python"],
    "Java": ["java"],
    "JavaScript": ["javascript", "js"],
    "React": ["react"],
    "SQL": ["sql", "mysql", "postgresql", "postgres"],
    "FastAPI": ["fastapi"],
    "Django": ["django"],
    "Machine Learning": ["machine learning", "scikit-learn", "sklearn"],
    "Data Structures": ["data structures", "dsa"],
    "Problem Solving": ["problem solving", "logical reasoning"],
    "HTML": ["html"],
    "CSS": ["css"],
    "REST APIs": ["rest api", "restful api", "apis"],
    "Node.js": ["node.js", "nodejs"],
    "C++": ["c++"],
    "AWS": ["aws", "amazon web services"],
    "Git": ["git", "github"],
    "Communication": ["communication", "presentation skills"],
    "Excel": ["excel", "spreadsheets"],
    "MongoDB": ["mongodb"],
}

TECH_QUESTIONS = {
    "Python": {
        "question": "Which Python type stores key-value pairs?",
        "options": ["list", "tuple", "dictionary", "set"],
        "answer": "dictionary",
        "explanation": "A dictionary stores data as key-value pairs.",
    },
    "Java": {
        "question": "Which keyword creates an object in Java?",
        "options": ["class", "new", "void", "static"],
        "answer": "new",
        "explanation": "The new keyword creates an object.",
    },
    "JavaScript": {
        "question": "Which keyword declares a block-scoped variable?",
        "options": ["var only", "let", "print", "define"],
        "answer": "let",
        "explanation": "let declares a block-scoped variable.",
    },
    "React": {
        "question": "Which React hook stores component state?",
        "options": ["useState", "useFile", "useStyle", "useRouteOnly"],
        "answer": "useState",
        "explanation": "useState lets a component store and update state.",
    },
    "SQL": {
        "question": "Which SQL command retrieves records?",
        "options": ["SELECT", "REMOVE", "FETCHFILE", "CHANGE"],
        "answer": "SELECT",
        "explanation": "SELECT retrieves data from database tables.",
    },
    "FastAPI": {
        "question": "Which Python decorator defines a GET route in FastAPI?",
        "options": ["@app.get", "@app.readfile", "@route.sql", "@get.html"],
        "answer": "@app.get",
        "explanation": "@app.get registers a GET endpoint.",
    },
    "Django": {
        "question": "Which Django component maps URLs to views?",
        "options": ["URL configuration", "CSS", "pip", "HTML forms only"],
        "answer": "URL configuration",
        "explanation": "Django URL patterns route requests to views.",
    },
    "Machine Learning": {
        "question": "What is a training dataset used for?",
        "options": [
            "Training a model",
            "Designing buttons",
            "Formatting a PDF",
            "Creating a URL",
        ],
        "answer": "Training a model",
        "explanation": "A training dataset helps a model learn patterns.",
    },
    "Data Structures": {
        "question": "Which data structure follows FIFO?",
        "options": ["Stack", "Queue", "Tree", "Graph"],
        "answer": "Queue",
        "explanation": "FIFO means first in, first out.",
    },
    "Problem Solving": {
        "question": "What should you usually do first when solving a coding problem?",
        "options": [
            "Understand the problem",
            "Delete the code",
            "Skip the requirements",
            "Guess the output",
        ],
        "answer": "Understand the problem",
        "explanation": "Understanding the requirements comes before coding.",
    },
    "HTML": {
        "question": "Which HTML element creates a hyperlink?",
        "options": ["<a>", "<p>", "<table>", "<h1>"],
        "answer": "<a>",
        "explanation": "The anchor element creates a hyperlink.",
    },
    "CSS": {
        "question": "Which CSS property changes text colour?",
        "options": ["font-size", "color", "margin", "display"],
        "answer": "color",
        "explanation": "The color property sets text colour.",
    },
    "REST APIs": {
        "question": "Which HTTP method is commonly used to retrieve a resource?",
        "options": ["GET", "DELETE", "PATCH", "TRACE"],
        "answer": "GET",
        "explanation": "GET is commonly used to retrieve a resource.",
    },
    "Node.js": {
        "question": "What is Node.js commonly used for?",
        "options": [
            "Running JavaScript outside the browser",
            "Writing only CSS",
            "Creating spreadsheets only",
            "Replacing SQL",
        ],
        "answer": "Running JavaScript outside the browser",
        "explanation": "Node.js runs JavaScript outside a web browser.",
    },
    "C++": {
        "question": "Which stream commonly prints output in C++?",
        "options": ["cout", "cin", "input", "echo"],
        "answer": "cout",
        "explanation": "cout is commonly used for console output.",
    },
    "AWS": {
        "question": "What is AWS?",
        "options": [
            "A cloud computing platform",
            "A programming loop",
            "A database query",
            "A CSS property",
        ],
        "answer": "A cloud computing platform",
        "explanation": "AWS provides cloud computing services.",
    },
    "Git": {
        "question": "Which Git command records a snapshot in local history?",
        "options": ["git commit", "git view", "git browse", "git print"],
        "answer": "git commit",
        "explanation": "git commit records staged changes.",
    },
    "Communication": {
        "question": "What is a good response when you do not understand an interview question?",
        "options": [
            "Ask politely for clarification",
            "Pretend to understand",
            "Leave immediately",
            "Change the subject",
        ],
        "answer": "Ask politely for clarification",
        "explanation": "Clarifying the question helps you answer accurately.",
    },
    "Excel": {
        "question": "Which Excel function adds numbers?",
        "options": ["SUM", "COUNTIF only", "LEFT", "TRIM"],
        "answer": "SUM",
        "explanation": "SUM adds numbers in selected cells or ranges.",
    },
    "MongoDB": {
        "question": "MongoDB primarily stores data as what?",
        "options": ["Documents", "HTML pages", "CSS rules", "Python functions"],
        "answer": "Documents",
        "explanation": "MongoDB stores records as BSON documents.",
    },
}

APTITUDE_QUESTIONS = [
    {
        "question": "A candidate answers 18 out of 20 questions correctly. What is the percentage?",
        "options": ["80%", "85%", "90%", "95%"],
        "answer": "90%",
        "explanation": "18 / 20 × 100 = 90%.",
    },
    {
        "question": "A task takes 6 hours. How long would it take at twice the working rate?",
        "options": ["2 hours", "3 hours", "6 hours", "12 hours"],
        "answer": "3 hours",
        "explanation": "At twice the rate, the time is halved.",
    },
    {
        "question": "Find the next number: 3, 6, 9, 12, ...",
        "options": ["13", "14", "15", "18"],
        "answer": "15",
        "explanation": "Each number increases by 3.",
    },
]

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                company TEXT,
                description TEXT NOT NULL,
                skills TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL,
                assessment TEXT NOT NULL,
                score INTEGER NOT NULL,
                total INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(job_id) REFERENCES jobs(id)
            )
        """)

init_db()

def extract_skills(description):
    text = description.lower()
    found = []
    for skill, aliases in SKILL_ALIASES.items():
        if any(alias in text for alias in aliases):
            found.append(skill)
    return found

def build_interview(skills, title):
    questions = [
        f"Explain why your skills make you suitable for the {title or 'advertised'} role.",
        "Describe a challenging problem you solved and how you approached it.",
        "Tell me about a time you worked with a team or handled feedback.",
    ]
    for skill in skills:
        questions.append(
            f"Explain your experience with {skill} and how you would use it in this role."
        )
    return questions[:10]

def build_coding(skills):
    tasks = []
    for skill in skills:
        if skill in ["Python", "Java", "JavaScript", "C++"]:
            tasks.append({
                "title": f"{skill}: Work with a list of numbers",
                "description": (
                    f"Using {skill}, write a program that finds the largest "
                    "number in a list and explain your approach."
                ),
                "skill": skill,
            })
        elif skill in ["SQL", "MongoDB"]:
            tasks.append({
                "title": f"{skill}: Retrieve records",
                "description": (
                    f"Describe or write a query using {skill} to find records "
                    "that satisfy a given condition."
                ),
                "skill": skill,
            })
        elif skill in ["React", "HTML", "CSS", "FastAPI", "REST APIs", "Node.js", "Django"]:
            tasks.append({
                "title": f"{skill}: Build a small feature",
                "description": (
                    f"Describe the steps to implement a small feature using {skill} "
                    "and explain how you would test it."
                ),
                "skill": skill,
            })
    if not tasks:
        tasks.append({
            "title": "Problem solving",
            "description": "Write steps or pseudocode to find the largest number in a list.",
            "skill": "Problem Solving",
        })
    return tasks[:6]

def get_job(job_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Job description not found")
        return dict(row)

@app.get("/")
def home():
    return {"message": "Placement Preparation API is running!"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/api/ai/status")
def ai_status():
    return {
        "provider": "Local JD analysis",
        "configured": True,
        "message": "Local keyword analysis is ready. No AI API key is required."
    }

@app.post("/api/analyze")
async def analyze_jd(
    title: str = Form(""),
    company: str = Form(""),
    description: str = Form(""),
    file: UploadFile | None = File(None),
):
    text = description.strip()

    if file and file.filename:
        filename = file.filename.lower()
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File must be smaller than 5 MB.")

        if filename.endswith(".txt"):
            text = content.decode("utf-8", errors="replace").strip()
        elif filename.endswith(".pdf"):
            try:
                from io import BytesIO
                reader = PdfReader(BytesIO(content))
                text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
            except Exception as exc:
                raise HTTPException(status_code=400, detail="Could not read this PDF.") from exc
        else:
            raise HTTPException(status_code=400, detail="Upload a PDF or TXT file.")

    if len(text) < 30:
        raise HTTPException(
            status_code=400,
            detail="Please provide a complete job description (at least 30 characters).",
        )

    skills = extract_skills(text)
    now = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "INSERT INTO jobs (title, company, description, skills, created_at) VALUES (?, ?, ?, ?, ?)",
            (title.strip(), company.strip(), text, json.dumps(skills), now),
        )
        job_id = cursor.lastrowid

    technical = [TECH_QUESTIONS[s] for s in skills if s in TECH_QUESTIONS]
    if not technical:
        technical = [{
            "question": "Which is the best first step when learning a new technology required for a role?",
            "options": [
                "Read its fundamentals and practice",
                "Skip the documentation",
                "Memorize unrelated facts",
                "Avoid practical work",
            ],
            "answer": "Read its fundamentals and practice",
            "explanation": "Understand the fundamentals and practise with relevant examples.",
        }]

    return {
        "job_id": job_id,
        "title": title.strip() or "Target role",
        "company": company.strip(),
        "skills": skills,
        "skill_count": len(skills),
        "description_length": len(text),
        "aptitude": APTITUDE_QUESTIONS,
        "technical": technical[:10],
        "coding": build_coding(skills),
        "interview": build_interview(skills, title.strip()),
        "plan": [
            {"day": 1, "task": "Read the job description and review the required skills."},
            {"day": 2, "task": "Study the first half of the detected skills: " + ", ".join(skills[:max(1, len(skills)//2)])},
            {"day": 3, "task": "Practise aptitude questions and review incorrect answers."},
            {"day": 4, "task": "Practise coding tasks related to the detected skills."},
            {"day": 5, "task": "Revise the remaining skills and core concepts."},
            {"day": 6, "task": "Practise technical interview questions aloud."},
            {"day": 7, "task": "Take the assessments again and review your weak areas."},
        ],
    }

@app.post("/api/results")
def save_result(payload: dict):
    job_id = payload.get("job_id")
    assessment = str(payload.get("assessment", "Assessment"))
    score = payload.get("score")
    total = payload.get("total")

    if not isinstance(job_id, int) or not isinstance(score, int) or not isinstance(total, int):
        raise HTTPException(status_code=400, detail="Invalid assessment result.")
    if total < 1 or score < 0 or score > total:
        raise HTTPException(status_code=400, detail="Invalid score.")

    get_job(job_id)
    now = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "INSERT INTO results (job_id, assessment, score, total, created_at) VALUES (?, ?, ?, ?, ?)",
            (job_id, assessment, score, total, now),
        )
        result_id = cursor.lastrowid

    return {"id": result_id, "score": score, "total": total, "saved": True}

@app.get("/api/history")
def history():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT results.id, results.job_id, results.assessment,
                   results.score, results.total, results.created_at,
                   jobs.title, jobs.company
            FROM results
            JOIN jobs ON jobs.id = results.job_id
            ORDER BY results.id DESC
            LIMIT 100
        """).fetchall()
    return [dict(row) for row in rows]

@app.get("/api/jobs/{job_id}")
def job_details(job_id: int):
    job = get_job(job_id)
    job["skills"] = json.loads(job["skills"])
    return job
