NLDC Trainee Dental Nurses Hub — Cloudflare setup

This folder is ready to upload to the root of the GitHub repository connected to Cloudflare Pages.

Files

index.html — the complete website and Virtual Assistant interface

_worker.js — the Cloudflare Pages Worker and /api/assistant endpoint

data/assistant-knowledge.txt — the information used to ground AI answers

practices.json — keep your existing practice database in the repository root for Job Search

Cloudflare configuration

Upload all files and folders without changing their paths. Keep your existing
practices.json in the repository root.

In the Cloudflare project, open Settings → Bindings.

Add a Workers AI binding named exactly AI.

Confirm that static assets are available to the Worker as the ASSETS binding.

Redeploy the latest GitHub commit.

The Worker preserves the existing /api/cqc practice-search route and reads the existing
root-level practices.json file. The browser sends assistant questions to /api/assistant. The Worker loads
/data/assistant-knowledge.txt, adds that content to the protected system prompt, and calls
Workers AI using @cf/meta/llama-3.1-8b-instruct.

Adding the approved information later

Edit data/assistant-knowledge.txt in GitHub, keep it as plain UTF-8 text, and commit the
change. Cloudflare will redeploy it. No changes to index.html or _worker.js are needed.

Keep the file below approximately 50,000 characters with the current implementation. For a
much larger collection of documents, replace this direct-file approach with a retrieval system
such as Cloudflare Vectorize or AI Search.

Important

Do not put API keys, patient-identifiable information, confidential learner records or private
staff information in the knowledge file. Workers AI is accessed through the Cloudflare binding;
no API token should be placed in the website code.
