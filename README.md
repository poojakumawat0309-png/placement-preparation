# placement-preparation
Placement Preparation Project
# Placement Preparation System Using Python and LLM

## Project Overview

The **Placement Preparation System** is an AI-powered web application designed to help students prepare for job placements based on their target job requirements.

The system allows users to upload or enter a Job Description (JD). Based on the provided JD, it generates relevant preparation questions and assessments to help candidates identify their strengths and areas for improvement.

## Objectives

- Provide personalized placement preparation.
- Analyze job descriptions and identify required skills.
- Generate relevant aptitude and technical questions.
- Support coding and interview preparation.
- Track assessment scores and preparation progress.
- Help students identify skill gaps.

## Technologies Used

| Component | Technology |
|---|---|
| Frontend | React.js, Vite |
| Backend | Python, FastAPI |
| Database | SQLite |
| AI Integration | OpenAI API |
| API Communication | REST API |
| Development Tools | VS Code, Git, GitHub |

## Main Features

### 1. Job Description Analysis
- Upload or enter a job description.
- Analyze job requirements and skills.
- Generate preparation content based on the target role.

### 2. JD-Based Assessments
- Aptitude assessments.
- Technical assessments.
- Questions relevant to the uploaded job description.

### 3. Interview Preparation
- Generate interview questions.
- Practice questions related to the target job role.
- Prepare for technical and placement interviews.

### 4. Coding Practice
- Support coding assessment preparation.
- Practice technical problem-solving.

### 5. Performance Tracking
- View assessment scores.
- Maintain assessment history.
- Track preparation progress.

### 6. Dashboard
- Access preparation activities.
- View job-related preparation information.
- Navigate between assessment and interview preparation sections.

## Project Architecture

The project follows a frontend-backend architecture.

- **Frontend:** React and Vite provide the user interface.
- **Backend:** FastAPI handles application requests and processing.
- **Database:** SQLite stores application and assessment records.
- **AI Integration:** OpenAI API supports AI-powered preparation features.

## Project Folder Structure

```text
placement-preparation/
│
├── backend/
│   ├── main.py
│   ├── .env
│   └── placement.db
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── App.css
│   ├── package.json
│   └── index.html
│
├── .gitignore
└── README.md
```

## Installation and Execution

### Prerequisites

- Python
- Node.js and npm
- Visual Studio Code
- Git

### Step 1: Clone the Repository

```bash
git clone https://github.com/poojakumawat0309-png/placement-preparation.git
cd placement-preparation
```

### Step 2: Start the Backend

Open a terminal:

```powershell
cd backend
```

Activate your Python virtual environment if already created, or create one from the project root.

Install the backend dependencies listed in the project's requirements file.

Start FastAPI from the backend directory:

```bash
python -m uvicorn main:app --reload
```

Backend URL:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

### Step 3: Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

http://localhost:5173

## Database

SQLite is used to store application data and assessment history.

## AI Configuration

The application supports OpenAI API integration through backend environment configuration.

Add your API key to the backend `.env` file:

```env
OPENAI_API_KEY=your_api_key
```

Keep the `.env` file private. Never upload API keys to GitHub.

## Testing

The following technical checks have been performed:

- Frontend production build.
- Backend health endpoint.
- Assessment history API.
- Database assessment record retrieval.
- GitHub repository synchronization.

## Expected Outcome

The Placement Preparation System aims to provide a centralized platform where students can prepare for placements using job-specific assessments, interview preparation and performance tracking.

## Author

**Pooja Kumawat**

Project: Placement Preparation System Using Python and LLM

GitHub Repository:

https://github.com/poojakumawat0309-png/placement-preparation
