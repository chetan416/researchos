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
    allow_origins=["http://localhost:3000"],
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

    message = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2500,
        messages=[
            {
                "role": "user",
                "content": f"""You are an expert research analyst. Analyse these {len(papers)} research papers.

IMPORTANT RULES:
- Every claim must include a citation like [P1, page 3]
- Respond using EXACTLY these 4 markers on their own line:
  ##THEMES##
  ##AGREEMENTS##
  ##GAPS##
  ##SYNTHESIS##

Format your response like this:

##THEMES##
Write themes here with citations [P1, page 2].

##AGREEMENTS##
Write agreements and contradictions here with citations [P2, page 4].

##GAPS##
Write research gaps here with citations [P1, page 5].

##SYNTHESIS##
Write unified synthesis here with citations [P3, page 1].

Papers:
{context}"""
            }
        ]
    )

    raw = message.content[0].text

    import re
    sections = {"themes": "", "agreements": "", "gaps": "", "synthesis": ""}
    markers = {
        "##THEMES##": "themes",
        "##AGREEMENTS##": "agreements",
        "##GAPS##": "gaps",
        "##SYNTHESIS##": "synthesis",
    }

    current = None
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped in markers:
            current = markers[stripped]
        elif current:
            sections[current] += line + "\n"

    result = {
        "papers": [p["name"] for p in papers],
        "themes": sections["themes"].strip(),
        "agreements": sections["agreements"].strip(),
        "gaps": sections["gaps"].strip(),
        "synthesis": sections["synthesis"].strip(),
    }

    # Save to Supabase if user is logged in
    if user_id and authorization:
        token = authorization.split(" ")[1]
        user_supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_KEY"),
        )
        user_supabase.postgrest.auth(token)
        user_supabase.table("syntheses").insert({
            "user_id": user_id,
            "papers": result["papers"],
            "themes": result["themes"],
            "agreements": result["agreements"],
            "gaps": result["gaps"],
            "synthesis": result["synthesis"],
        }).execute()

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