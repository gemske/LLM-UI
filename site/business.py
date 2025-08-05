import requests

OLLAMA_API = "http://192.168.1.32:11434/api/generate"

MODEL_CHAIN = [
    ("psychologist", "Analyze consumer psychology, motivations, and market appeal of the business idea."),
    ("gamemasterroleplaying", "Simulate user interactions and adoption challenges for this idea."),
    ("chiefcustomersuccessofficer", "Evaluate customer success strategies and retention approaches for this idea."),
    ("financialadvisor", "Assess financial viability, startup costs, revenue projections, and funding strategies."),
    ("projectmanager", "Propose a high-level project roadmap with phases and priorities."),
    ("computerhardwareengineer", "Determine any hardware considerations and feasibility (skip if none)."),
    ("businessadministrator", "Outline the business structure, roles, operations, and key workflows."),
    ("attorney2", "Discuss legal structure, IP concerns, compliance, and liability mitigation."),
]

FINAL_OUTPUT_ROLES = {
    "psychologist": "Summarize the target market and the psychology of the potential consumer.",
    "financialadvisor": "Summarize the financial aspects, including budget, revenue model, projections, and liabilities of the business proposal.",
    "businessadministrator": "Summarize the operational structure and how this can run efficiently.",
    "attorney2": "Summarize legal safeguards, liabilities, and protections for this business.",
    "contentsummarizer": "Create a high-level overview summarizing the business proposal’s key objectives, strategies, and value proposition. Clearly organize each roles report (financial advisor report, etc)",
}

def run_model(model_name, prompt):
    response = requests.post(OLLAMA_API, json={
        "model": f"ALIENTELLIGENCE/{model_name}:latest",
        "prompt": prompt,
        "stream": False
    })
    response.raise_for_status()
    return response.json()["response"]

def main():
    idea = input("Enter your business idea:\n> ").strip()
    context = idea
    # Run MODEL_CHAIN behind the scenes to build context
    for model, task in MODEL_CHAIN:
        prompt = f"Business idea: {idea}\n\n{task}\n\nPrior context:\n{context}"
        result = run_model(model, prompt)
        context += f"\n\n[{model}]: {result}"

    # Generate and combine FINAL_OUTPUT_ROLES summaries
    combined_output = ""
    for role, summary_prompt in FINAL_OUTPUT_ROLES.items():
        prompt = f"Based on the analysis below:\n{context}\n\n{summary_prompt}"
        result = run_model(role, prompt)
        combined_output += f"\n\n[{role}]: {result}"

    return combined_output.strip()

if __name__ == "__main__":
    print(main())
