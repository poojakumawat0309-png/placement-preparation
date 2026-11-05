import asyncio
import json
import re
import sqlite3
from datetime import datetime, timezone
from difflib import get_close_matches
from io import BytesIO
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader

# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "placement.db"
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "qwen3:4b"

load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="Placement Preparation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------
# Skills and fallback questions
# -------------------------------------------------------------------

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
    "Docker": ["docker", "containerization"],
    "Testing": ["unit test", "testing", "pytest"],
    "Debugging": ["debugging", "troubleshooting"],
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
        "explanation": "useState stores and updates component state.",
    },
    "SQL": {
        "question": "Which SQL command retrieves records?",
        "options": ["SELECT", "REMOVE", "FETCHFILE", "CHANGE"],
        "answer": "SELECT",
        "explanation": "SELECT retrieves data from database tables.",
    },
    "FastAPI": {
        "question": "Which decorator defines a GET route in FastAPI?",
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
        "options": ["Training a model", "Designing buttons", "Formatting a PDF", "Creating a URL"],
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
        "options": ["Understand the problem", "Delete the code", "Skip requirements", "Guess the output"],
        "answer": "Understand the problem",
        "explanation": "Understand the requirements before coding.",
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
        "question": "Which HTTP method commonly retrieves a resource?",
        "options": ["GET", "DELETE", "PATCH", "TRACE"],
        "answer": "GET",
        "explanation": "GET is commonly used to retrieve a resource.",
    },
    "Node.js": {
        "question": "What is Node.js commonly used for?",
        "options": ["Running JavaScript outside the browser", "Writing only CSS", "Creating spreadsheets", "Replacing SQL"],
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
        "options": ["A cloud computing platform", "A programming loop", "A database query", "A CSS property"],
        "answer": "A cloud computing platform",
        "explanation": "AWS provides cloud computing services.",
    },
    "Git": {
        "question": "Which Git command records staged changes?",
        "options": ["git commit", "git view", "git browse", "git print"],
        "answer": "git commit",
        "explanation": "git commit records staged changes.",
    },
    "Communication": {
        "question": "What should you do if you do not understand an interview question?",
        "options": ["Ask politely for clarification", "Pretend to understand", "Leave immediately", "Change the subject"],
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
    "Docker": {
        "question": "What is Docker used for?",
        "options": ["Packaging an app and dependencies", "Reviewing Git commits", "Writing SQL", "Running unit tests"],
        "answer": "Packaging an app and dependencies",
        "explanation": "Docker packages applications and their dependencies into containers.",
    },
    "Testing": {
        "question": "What does a unit test check?",
        "options": ["One small part of a program", "The entire deployment environment", "A Git repository", "A database backup"],
        "answer": "One small part of a program",
        "explanation": "A unit test checks a small part of a program.",
    },
    "Debugging": {
        "question": "What is a useful first debugging step?",
        "options": ["Reproduce the issue and inspect the error", "Delete the test", "Change unrelated code", "Ignore the error"],
        "answer": "Reproduce the issue and inspect the error",
        "explanation": "Reproducing an issue helps identify its cause.",
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
        "question": "A task takes 6 hours. How long at twice the working rate?",
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
    {
        "question": "A team completes 4 tasks in 2 days. How many in 5 days at the same rate?",
        "options": ["8", "10", "12", "20"],
        "answer": "10",
        "explanation": "The team completes 2 tasks per day, so 2 × 5 = 10.",
    },
    {
        "question": "A product costs 800 and has a 25% discount. What is its sale price?",
        "options": ["200", "600", "700", "775"],
        "answer": "600",
        "explanation": "25% of 800 is 200; 800 - 200 = 600.",
    },
]


# -------------------------------------------------------------------
# Database
# -------------------------------------------------------------------

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


# -------------------------------------------------------------------
# Helper functions
# -------------------------------------------------------------------

def extract_skills(description: str) -> list[str]:
    text = description.lower()
    return [
        skill for skill, aliases in SKILL_ALIASES.items()
        if any(re.search(r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])", text)
               for alias in aliases)
    ]


def build_interview(skills: list[str], title: str) -> list[str]:
    questions = [
        f"Explain why your skills make you suitable for the {title or 'advertised'} role.",
        "Describe a challenging problem you solved and how you approached it.",
        "Tell me about a time you worked with a team or handled feedback.",
    ]
    questions.extend(
        f"Explain your experience with {skill} and how you would use it in this role."
        for skill in skills
    )
    questions.extend([
        f"Which requirement for the {title} role would you prioritize first, and why?",
        "How would you break a large task into smaller steps?",
        "How do you check your work before sharing it with a team?",
        "How would you learn an unfamiliar tool needed for this role?",
        "Describe how you would communicate a delay or blocker.",
        "How do you respond to constructive feedback?",
    ])
    return questions[:10]


def build_coding(skills: list[str]) -> list[dict]:
    tasks = []
    for skill in skills:
        if skill in ["Python", "Java", "JavaScript", "C++"]:
            tasks.append({
                "title": f"{skill}: Work with a list of numbers",
                "description": f"Using {skill}, write a program that finds the largest number in a list and explain your approach.",
                "skill": skill,
            })
        elif skill in ["SQL", "MongoDB"]:
            tasks.append({
                "title": f"{skill}: Retrieve records",
                "description": f"Write a {skill} query to find records that satisfy a given condition.",
                "skill": skill,
            })
        elif skill in ["React", "HTML", "CSS", "FastAPI", "REST APIs", "Node.js", "Django"]:
            tasks.append({
                "title": f"{skill}: Build a small feature",
                "description": f"Describe how to implement a small feature using {skill} and how you would test it.",
                "skill": skill,
            })

    if not tasks:
        tasks.append({
            "title": "Problem solving",
            "description": "Write steps or pseudocode to find the largest number in a list.",
            "skill": "Problem Solving",
        })

    while len(tasks) < 3:
        tasks.append({
            "title": "Problem solving: Explain a practical solution",
            "description": "Describe a small job-related problem, the steps to solve it, and how to check the result.",
            "skill": "Problem Solving",
        })
    return tasks[:3]


def ask_qwen(prompt: str, output_schema=None, num_predict: int = 700) -> str:
    """Send a prompt to local Ollama and return its text response."""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "options": {
            "num_predict": num_predict,
            "temperature": 0.2,
            "num_ctx": 4096,
        },
    }
    if output_schema is not None:
        payload["format"] = output_schema

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=600)
        response.raise_for_status()
        data = response.json()
        answer = str(data.get("response", "")).strip()
        if not answer:
            raise HTTPException(status_code=502, detail="Qwen returned an empty response.")
        return answer
    except requests.Timeout as exc:
        raise HTTPException(
            status_code=504,
            detail="Qwen took too long. Please try again.",
        ) from exc
    except requests.ConnectionError as exc:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Ollama. Start Ollama and check that qwen3:4b is installed.",
        ) from exc
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ollama request failed: {exc}",
        ) from exc
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Ollama returned an invalid response.",
        ) from exc


def parse_qwen_json(raw) -> dict:
    """Parse a JSON object from a Qwen response."""
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("Qwen returned an empty response.")

    text = raw.strip()
    if "</think>" in text:
        text = text.rsplit("</think>", 1)[-1].strip()
    else:
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    text = re.sub(r"^\s*```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```\s*$", "", text).strip()

    decoder = json.JSONDecoder()
    for index, char in enumerate(text):
        if char == "{":
            try:
                value, _ = decoder.raw_decode(text[index:])
                if isinstance(value, dict):
                    return value
            except json.JSONDecodeError:
                continue

    raise ValueError("Qwen did not return a valid JSON object.")


def clean_question(raw: str) -> str:
    """Clean a normal text question. Do not try to parse it as JSON."""
    text = raw.strip()

    if "</think>" in text:
        text = text.rsplit("</think>", 1)[-1].strip()
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    text = re.sub(r"^```(?:text)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"^(question|example)\s*:\s*", "", text, flags=re.IGNORECASE).strip()

    match = re.search(r"[^?\n]*\?", text)
    if match:
        question = match.group(0).strip()
        question = re.sub(r"^\s*[-*]\s*", "", question)
        return question

    # If Qwen returns a sentence without a question mark, use it if it is useful.
    text = re.sub(r"^(question|example)\s*:\s*", "", text, flags=re.IGNORECASE).strip()
    if text and len(text) < 350:
        return text.rstrip(".") + "?"
    return ""


def make_plan(skills: list[str]) -> list[dict]:
    focus = ", ".join(skills[:3]) if skills else "the main job requirements"
    return [
        {"day": 1, "task": f"Read the job description and list its key requirements, including {focus}."},
        {"day": 2, "task": f"Review the basics of {focus} and note your knowledge gaps."},
        {"day": 3, "task": "Practise numerical reasoning and explain each solution."},
        {"day": 4, "task": "Complete a coding task related to this job description."},
        {"day": 5, "task": "Practise the technical questions generated for this role."},
        {"day": 6, "task": "Practise answering your job-specific interview questions aloud."},
        {"day": 7, "task": "Review your scores and repeat the topics that need more practice."},
    ]


def fallback_preparation(title: str, skills: list[str]) -> dict:
    technical = [TECH_QUESTIONS[s] for s in skills if s in TECH_QUESTIONS]
    for question in TECH_QUESTIONS.values():
        if question not in technical:
            technical.append(question)

    return {
        "aptitude": APTITUDE_QUESTIONS,
        "technical": technical[:5],
        "coding": build_coding(skills),
        "interview": build_interview(skills, title),
        "plan": make_plan(skills),
        "analysis_notice": (
            "AI question generation was unavailable or incomplete. "
            "Fallback questions were created from the detected job skills."
        ),
    }


# -------------------------------------------------------------------
# JD-based question generation
# -------------------------------------------------------------------

JD_QUESTION_SCHEMA = {
    "type": "object",
    "properties": {
        "technical": {
            "type": "array",
            "minItems": 5,
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {
                        "type": "array",
                        "minItems": 4,
                        "maxItems": 4,
                        "items": {"type": "string"},
                    },
                    "answer": {"type": "string"},
                    "explanation": {"type": "string"},
                },
                "required": ["question", "options", "answer", "explanation"],
                "additionalProperties": False,
            },
        },
        "coding": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "skill": {"type": "string"},
                },
                "required": ["title", "description", "skill"],
                "additionalProperties": False,
            },
        },
        "interview": {
            "type": "array",
            "minItems": 10,
            "maxItems": 10,
            "items": {"type": "string"},
        },
    },
    "required": ["technical", "coding", "interview"],
    "additionalProperties": False,
}


def generate_jd_preparation(title: str, description: str, skills: list[str]) -> dict:
    prompt = f"""
Create placement practice material for the job below.
Use only the responsibilities and technologies in the job description.
Use short, beginner-friendly wording. Do not invent requirements.

Job title: {title}
Job description:
{description[:6000]}
Detected skills: {", ".join(skills) if skills else "Use the job description"}

Return exactly:
- 5 technical multiple-choice questions, each with exactly 4 options,
  an answer matching one complete option, and a short explanation.
- 3 practical coding tasks.
- 10 job-specific interview questions.

Return only JSON matching the supplied schema.
"""
    try:
        result = parse_qwen_json(ask_qwen(prompt, JD_QUESTION_SCHEMA))

        for key, count in (("technical", 5), ("coding", 3), ("interview", 10)):
            items = result.get(key)
            if not isinstance(items, list) or len(items) < count:
                raise ValueError(f"Qwen returned too few {key} items.")
            result[key] = items[:count]

        for question in result["technical"]:
            if (
                not isinstance(question, dict)
                or not isinstance(question.get("question"), str)
                or not question["question"].strip()
                or not isinstance(question.get("options"), list)
                or len(question["options"]) != 4
                or not all(isinstance(x, str) and x.strip() for x in question["options"])
                or not isinstance(question.get("answer"), str)
                or not isinstance(question.get("explanation"), str)
                or not question["explanation"].strip()
            ):
                raise ValueError("Qwen returned an invalid technical question.")

            if question["answer"] not in question["options"]:
                answer_letter = question["answer"].strip().upper()
                if len(answer_letter) == 1 and answer_letter in "ABCD":
                    question["answer"] = question["options"]["ABCD".index(answer_letter)]
                else:
                    closest = get_close_matches(
                        question["answer"], question["options"], n=1, cutoff=0.72
                    )
                    if not closest:
                        raise ValueError("Qwen returned an answer not present in the options.")
                    question["answer"] = closest[0]

        for task in result["coding"]:
            if not isinstance(task, dict) or not all(
                isinstance(task.get(field), str) and task[field].strip()
                for field in ("title", "description", "skill")
            ):
                raise ValueError("Qwen returned an invalid coding task.")

        if not all(isinstance(q, str) and q.strip() for q in result["interview"]):
            raise ValueError("Qwen returned an invalid interview question.")

        result["aptitude"] = APTITUDE_QUESTIONS
        result["plan"] = make_plan(skills)
        result["analysis_notice"] = ""
        return result

    except (HTTPException, ValueError, TypeError, KeyError) as exc:
        print("JD GENERATION FALLBACK:", repr(exc))
        return fallback_preparation(title, skills)


# -------------------------------------------------------------------
# Database helper
# -------------------------------------------------------------------

def get_job(job_id: int) -> dict:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM jobs WHERE id = ?", (job_id,)
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Job description not found.")

    return dict(row)


# -------------------------------------------------------------------
# Basic and AI status routes
# -------------------------------------------------------------------

@app.get("/")
def home():
    return {"message": "Placement Preparation API is running!"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api/ai/status")
def ai_status():
    try:
        response = requests.get("http://127.0.0.1:11434/api/tags", timeout=5)
        response.raise_for_status()
        models = response.json().get("models", [])
        available = any(
            model.get("name", "").split(":")[0] == OLLAMA_MODEL.split(":")[0]
            and model.get("name", "") == OLLAMA_MODEL
            for model in models
        )
        return {
            "provider": "Ollama",
            "model": OLLAMA_MODEL,
            "configured": available,
            "message": (
                "Local Qwen model is available."
                if available
                else f"Ollama is running, but {OLLAMA_MODEL} was not found. Run: ollama pull {OLLAMA_MODEL}"
            ),
        }
    except requests.RequestException:
        return {
            "provider": "Ollama",
            "model": OLLAMA_MODEL,
            "configured": False,
            "message": "Ollama is not reachable. Start Ollama and try again.",
        }


@app.post("/api/ai/test")
def test_qwen(payload: dict):
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Please provide a prompt.")
    return {
        "provider": "Ollama",
        "model": OLLAMA_MODEL,
        "answer": ask_qwen(prompt),
    }


# -------------------------------------------------------------------
# Analyze uploaded or pasted job description
# -------------------------------------------------------------------

@app.post("/api/analyze")
async def analyze_jd(
    title: str = Form(""),
    company: str = Form(""),
    description: str = Form(""),
    file: UploadFile | None = File(None),
):
    jd_text = description.strip()

    if file and file.filename:
        filename = file.filename.lower()
        content = await file.read()

        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File must be smaller than 5 MB.")

        if filename.endswith(".txt"):
            jd_text = content.decode("utf-8", errors="replace").strip()
        elif filename.endswith(".pdf"):
            try:
                reader = PdfReader(BytesIO(content))
                jd_text = "\n".join(
                    page.extract_text() or "" for page in reader.pages
                ).strip()
            except Exception as exc:
                raise HTTPException(status_code=400, detail="Could not read this PDF.") from exc
        else:
            raise HTTPException(status_code=400, detail="Upload a PDF or TXT file.")

    if len(jd_text) < 30:
        raise HTTPException(
            status_code=400,
            detail="Please provide a complete job description (at least 30 characters).",
        )

    clean_title = title.strip() or "Target role"
    clean_company = company.strip()
    skills = extract_skills(jd_text)

    preparation = await asyncio.to_thread(
        generate_jd_preparation,
        clean_title,
        jd_text,
        skills,
    )

    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            """
            INSERT INTO jobs (title, company, description, skills, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (clean_title, clean_company, jd_text, json.dumps(skills), now),
        )
        job_id = cursor.lastrowid

    return {
        "job_id": job_id,
        "title": clean_title,
        "company": clean_company,
        "description": jd_text,
        "skills": skills,
        "skill_count": len(skills),
        "description_length": len(jd_text),
        "analysis_notice": preparation["analysis_notice"],
        "aptitude": preparation["aptitude"],
        "technical": preparation["technical"],
        "coding": preparation["coding"],
        "interview": preparation["interview"],
        "plan": preparation["plan"],
    }


# -------------------------------------------------------------------
# Save assessment result and show history
# -------------------------------------------------------------------

@app.post("/api/results")
def save_result(payload: dict):
    job_id = payload.get("job_id")
    assessment = str(payload.get("assessment", "Assessment"))
    score = payload.get("score")
    total = payload.get("total")

    if (
        not isinstance(job_id, int)
        or isinstance(job_id, bool)
        or not isinstance(score, int)
        or isinstance(score, bool)
        or not isinstance(total, int)
        or isinstance(total, bool)
    ):
        raise HTTPException(status_code=400, detail="Invalid assessment result.")

    if total < 1 or score < 0 or score > total:
        raise HTTPException(status_code=400, detail="Invalid score.")

    get_job(job_id)
    now = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            """
            INSERT INTO results (job_id, assessment, score, total, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
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
    try:
        job["skills"] = json.loads(job["skills"])
    except (TypeError, json.JSONDecodeError):
        job["skills"] = []
    return job


# -------------------------------------------------------------------
# Generate the next interview question
# -------------------------------------------------------------------

@app.post("/api/interview/next")
def interview_next(payload: dict):
    import re
    from difflib import SequenceMatcher

    title = str(payload.get("title", "Target role"))[:150].strip() or "Target role"
    description = str(payload.get("description", ""))[:6000].strip()

    skills = payload.get("skills", [])
    history = payload.get("history", [])

    question_number = payload.get("question_number", 1)
    total_questions = payload.get("total_questions", 10)

    try:
        question_number = max(1, int(question_number))
        total_questions = max(1, int(total_questions))
    except (TypeError, ValueError):
        question_number = 1
        total_questions = 10

    if not description:
        raise HTTPException(
            status_code=400,
            detail="Analyze a job description first.",
        )

    if not isinstance(skills, list):
        skills = []

    if not isinstance(history, list):
        history = []

    # Collect real skills from the uploaded JD analysis.
    skill_topics = []

    for item in skills:
        if isinstance(item, str):
            value = item.strip()
        elif isinstance(item, dict):
            value = str(
                item.get("name")
                or item.get("skill")
                or item.get("title")
                or ""
            ).strip()
        else:
            value = ""

        if value and value.lower() not in [x.lower() for x in skill_topics]:
            skill_topics.append(value[:100])

    # Also collect useful responsibility/requirement sentences from the JD.
    jd_topics = []

    sentences = re.split(r"[\n•;]+|(?<=[.!?])\s+", description)

    relevant_words = (
        "responsibil", "require", "experience", "knowledge",
        "develop", "design", "build", "manage", "implement",
        "test", "deploy", "database", "api", "program",
        "communication", "team", "work with", "proficient",
    )

    for sentence in sentences:
        sentence = re.sub(r"\s+", " ", sentence).strip(" -•\t")

        if (
            15 <= len(sentence) <= 160
            and any(word in sentence.lower() for word in relevant_words)
        ):
            if sentence.lower() not in [x.lower() for x in jd_topics]:
                jd_topics.append(sentence)

    # Use only information taken from the uploaded JD.
    topics = skill_topics + jd_topics

    if not topics:
        topics = [description[:140].strip()]

    # Select a different JD topic for each interview round.
    topic = topics[(question_number - 1) % len(topics)]

    angles = [
        "a practical real-world situation",
        "a step-by-step explanation",
        "a problem and how to solve it",
        "a technical decision and why it is useful",
        "testing or checking the quality of the work",
        "a mistake or difficulty and how to handle it",
        "how this skill is used in the job",
        "working with another person or team",
        "improving the result or making it more efficient",
        "a real example of applying this requirement",
    ]

    angle = angles[(question_number - 1) % len(angles)]

    previous_questions = []

    for item in history:
        if isinstance(item, dict):
            old_question = str(item.get("question", "")).strip()
        else:
            old_question = str(item).strip()

        if old_question:
            previous_questions.append(old_question)

    def normalize_question(value):
        return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()

    def is_duplicate(candidate):
        candidate_normalized = normalize_question(candidate)

        if not candidate_normalized:
            return True

        candidate_words = set(candidate_normalized.split())

        for old_question in previous_questions:
            old_normalized = normalize_question(old_question)

            if candidate_normalized == old_normalized:
                return True

            similarity = SequenceMatcher(
                None,
                candidate_normalized,
                old_normalized,
            ).ratio()

            old_words = set(old_normalized.split())
            common = candidate_words.intersection(old_words)

            overlap = (
                len(common) / max(1, min(len(candidate_words), len(old_words)))
            )

            if similarity >= 0.78 or overlap >= 0.85:
                return True

        return False

    prompt = f"""
/no_think
You are conducting a real job interview.

Generate exactly ONE short and clear interview question.

IMPORTANT RULES:
- The question MUST be directly based on the uploaded job description.
- Focus on the selected JD topic below.
- Do not ask a generic question unrelated to this job.
- Ask about this angle: {angle}
- Use simple English.
- Ask only ONE question.
- Do not include an answer, explanation, heading, or numbering.
- Do not repeat or rephrase any previous question.
- Return only the question ending with a question mark.

Job role: {title}

Selected topic from the uploaded JD:
{topic}

Uploaded job description:
{description[:3500]}

Interview round: {question_number} of {total_questions}

Previous questions:
{json.dumps(previous_questions[-10:])}
"""

    try:
        raw = ask_qwen(prompt, num_predict=100)
        question = clean_question(raw)

        # If Qwen repeats a question, ask it once more.
        if not question or is_duplicate(question):
            retry_prompt = prompt + f"""

Your last response was invalid or repeated an earlier question.
Generate a DIFFERENT question.
Change the question's wording and approach.
Keep it directly related to this JD topic:
{topic}

Return only one question.
"""

            raw = ask_qwen(retry_prompt, num_predict=100)
            question = clean_question(raw)

        # Use a topic-specific fallback if Qwen repeats again.
        if not question or is_duplicate(question):
            fallback_templates = [
                "How would you use {topic} in a practical task for this role?",
                "Can you explain the steps you would follow when working with {topic}?",
                "What problem might you face with {topic}, and how would you solve it?",
                "How would you decide which approach to use for {topic}?",
                "How would you test or check work involving {topic}?",
                "What mistake should someone avoid when working with {topic}?",
                "How does {topic} help you complete the responsibilities of this role?",
                "How would you explain your work involving {topic} to a teammate?",
                "How could you improve a task that uses {topic}?",
                "Can you describe a practical example of using {topic} for this role?",
            ]

            template = fallback_templates[(question_number - 1) % len(fallback_templates)]
            question = template.format(topic=topic)

        print(
            f"INTERVIEW ROUND {question_number}: "
            f"TOPIC={topic!r}, QUESTION={question!r}"
        )

        return {"question": question}

    except HTTPException:
        raise
    except Exception as exc:
        print("INTERVIEW NEXT ERROR:", repr(exc))
        raise HTTPException(
            status_code=502,
            detail=f"Interview question generation failed: {type(exc).__name__}: {exc}",
        ) from exc


# -------------------------------------------------------------------
# Evaluate the candidate's written interview answer
# -------------------------------------------------------------------

@app.post("/api/interview/evaluate")
def interview_evaluate(payload: dict):
    question = str(payload.get("question", ""))[:1500].strip()
    answer = str(payload.get("answer", ""))[:4000].strip()
    title = str(payload.get("title", "Target role"))[:150].strip()

    if not question or not answer:
        raise HTTPException(
            status_code=400,
            detail="A question and answer are required.",
        )

    prompt = f"""
/no_think
Evaluate this candidate's answer in a mock placement interview.

Target role: {title}
Question: {question}
Candidate answer: {answer}

Return one valid JSON object only, with exactly these fields:
{{
  "score": 0,
  "strengths": "One or two simple sentences",
  "improvements": "One or two simple sentences",
  "sample_answer": "A better example answer in simple English"
}}

Score from 0 to 10 based on relevance, clarity, correctness, and completeness.
Be fair to beginners. Do not claim to measure facial expressions, confidence,
or personality from text alone.
"""

    try:
        # Ollama accepts the string "json" to request JSON output.
        raw = ask_qwen(prompt, output_schema="json")
        result = parse_qwen_json(raw)

        score_value = result.get("score")
        score = max(0, min(10, int(float(score_value))))

        strengths = str(result.get("strengths", "")).strip()
        improvements = str(result.get("improvements", "")).strip()
        sample_answer = str(result.get("sample_answer", "")).strip()

        if not strengths or not improvements or not sample_answer:
            raise ValueError("One or more evaluation fields are missing.")

        return {
            "score": score,
            "strengths": strengths,
            "improvements": improvements,
            "sample_answer": sample_answer,
        }

    except HTTPException:
        raise
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        print("INTERVIEW EVALUATION PARSE ERROR:", repr(exc))
        raise HTTPException(
            status_code=502,
            detail=f"Qwen returned an invalid evaluation: {exc}",
        ) from exc
    except Exception as exc:
        print("INTERVIEW EVALUATION ERROR:", repr(exc))
        raise HTTPException(
            status_code=502,
            detail=f"Interview evaluation failed: {type(exc).__name__}: {exc}",
        ) from exc
