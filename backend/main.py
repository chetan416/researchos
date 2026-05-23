from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import fitz
import anthropic
import os
from dotenv import load_dotenv
from supabase import create_client
import jwt

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://researchos-sigma.vercel.app",
        "https://researchos-jnrlejorf-chetan416s-projects.vercel.app",],
    allow_methods=["*"],
    allow_headers=["*"],
)

claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

def extract_text_with_pages(pdf_bytes: bytes, limit_per_page: int = 1000) -> list:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    total = 0
    for i, page in enumerate(doc):
        text = page.get_text().strip()
        if text:
            pages.append({"page": i + 1, "text": text[:limit_per_page]})
            total += len(text)
        if total > 8000:
            break
    return pages

def build_paper_context(papers: list) -> str:
    context = ""
    for i, p in enumerate(papers):
        context += f"\n\n=== PAPER {i+1}: {p['name']} ===\n"
        for pg in p["pages"]:
            context += f"\n[P{i+1}, page {pg['page']}]: {pg['text']}\n"
    return context

def get_user_id(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get("sub")
    except:
        return None

@app.get("/")
def root():
    return {"status": "ResearchOS backend running"}

@app.post("/synthesise")
async def synthesise_papers(
    files: List[UploadFile] = File(...),
    authorization: Optional[str] = Header(None)
):
    user_id = get_user_id(authorization)

    papers = []
    for f in files:
        pdf_bytes = await f.read()
        pages = extract_text_with_pages(pdf_bytes)
        papers.append({"name": f.filename, "pages": pages})

    context = build_paper_context(papers)

    # Build memory context from past syntheses
    memory_context = ""
    if user_id and authorization:
        try:
            token = authorization.split(" ")[1]
            mem_supabase = create_client(
                os.getenv("SUPABASE_URL"),
                os.getenv("SUPABASE_KEY"),
            )
            mem_supabase.postgrest.auth(token)
            past = mem_supabase.table("syntheses")\
                .select("papers, themes, gaps, synthesis, created_at")\
                .eq("user_id", user_id)\
                .order("created_at", desc=True)\
                .limit(10)\
                .execute()

            if past.data:
                memory_context = "\n\n=== YOUR PAST RESEARCH SESSIONS ===\n"
                for i, s in enumerate(past.data):
                    date = s["created_at"][:10]
                    memory_context += f"\nSession {i+1} ({date}):\n"
                    memory_context += f"Papers: {', '.join(s['papers'])}\n"
                    memory_context += f"Key themes: {s['themes'][:300]}\n"
                    memory_context += f"Gaps identified: {s['gaps'][:300]}\n"
                print(f"MEMORY CONTEXT BUILT: {len(past.data)} past sessions found")
                print(memory_context[:500])
            else:
                print("NO PAST SESSIONS FOUND IN DATABASE")
        except Exception as e:
            print(f"Memory fetch error: {e}")

    message = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=3000,
        messages=[
            {
                "role": "user",
                "content": f"""You are an expert research analyst with memory of this researcher's past work. Analyse these {len(papers)} research papers and respond using EXACTLY these markers on their own line:

##THEMES##
[3-5 common themes with citations like [P1, page 2]]

##AGREEMENTS##
[Where papers agree or contradict, with citations]

##GAPS##
[5 specific research gaps with citations]

##SYNTHESIS##
[3-5 sentence unified summary with citations]

##MEMORY##
[ONLY include this section if past research sessions are provided below. Connect the new papers to past research. Mention: (1) topics that appear in both old and new research, (2) whether new papers fill any previously identified gaps, (3) any contradictions with past findings. If no past sessions exist, write: "This is your first research session. Future syntheses will show connections to this work." Be specific and cite paper names.]

{f"Past research context:{memory_context}" if memory_context else "No past research sessions found."}

New papers to analyse:
{context}"""
            }
        ]
    )

    raw = message.content[0].text
    print("RAW RESPONSE:\n", raw)

    sections = {"themes": "", "agreements": "", "gaps": "", "synthesis": "", "memory": ""}
    markers = {
        "##THEMES##": "themes",
        "##AGREEMENTS##": "agreements",
        "##GAPS##": "gaps",
        "##SYNTHESIS##": "synthesis",
        "##MEMORY##": "memory",
    }

    current = None
    seen = set()
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped in markers:
            if stripped in seen:
                current = None  # ignore duplicate sections
            else:
                seen.add(stripped)
                current = markers[stripped]
        elif current:
            sections[current] += line + "\n"

    result = {
        "papers": [p["name"] for p in papers],
        "themes": sections["themes"].strip(),
        "agreements": sections["agreements"].strip(),
        "gaps": sections["gaps"].strip(),
        "synthesis": sections["synthesis"].strip(),
        "memory": sections["memory"].strip() or "This is your first research session. Future syntheses will show connections to this work.",
    }

    if user_id and authorization:
        try:
            token = authorization.split(" ")[1]
            save_supabase = create_client(
                os.getenv("SUPABASE_URL"),
                os.getenv("SUPABASE_KEY"),
            )
            save_supabase.postgrest.auth(token)
            save_supabase.table("syntheses").insert({
                "user_id": user_id,
                "papers": result["papers"],
                "themes": result["themes"],
                "agreements": result["agreements"],
                "gaps": result["gaps"],
                "synthesis": result["synthesis"],
                "memory": result["memory"],
            }).execute()
        except Exception as e:
            print(f"Save error: {e}")
            print(f"Save error type: {type(e)}")

    return result

@app.get("/history")
async def get_history(authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    response = supabase.table("syntheses")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("created_at", desc=True)\
        .limit(20)\
        .execute()

    return {"history": response.data}

@app.get("/stats")
async def get_stats(authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    token = authorization.split(" ")[1]
    user_supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_KEY"),
    )
    user_supabase.postgrest.auth(token)

    response = user_supabase.table("syntheses")\
        .select("papers, gaps, created_at")\
        .eq("user_id", user_id)\
        .order("created_at", desc=True)\
        .execute()

    syntheses = response.data
    total_syntheses = len(syntheses)
    total_papers = sum(len(s["papers"]) for s in syntheses)
    total_gaps = sum(
        len([l for l in s["gaps"].split("\n") if l.strip()])
        for s in syntheses
        if s.get("gaps")
    )

    return {
        "total_syntheses": total_syntheses,
        "total_papers": total_papers,
        "total_gaps": total_gaps,
        "recent": syntheses[:5]
    }