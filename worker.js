const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

const KNOWLEDGE_PATH = "/data/assistant-knowledge.txt";

const MAX_KNOWLEDGE_CHARACTERS = 50000;
const MAX_MESSAGE_CHARACTERS = 2000;

let cachedKnowledge = null;
let cachedPractices = null;


// ============================================================
// GENERAL HELPERS
// ============================================================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}


// ============================================================
// LOAD ASSISTANT KNOWLEDGE
// ============================================================

async function loadKnowledge(request, env) {
  if (cachedKnowledge) {
    return cachedKnowledge;
  }

  if (!env.ASSETS) {
    throw new Error("The ASSETS binding is missing.");
  }

  const knowledgeUrl = new URL(KNOWLEDGE_PATH, request.url);

  const response = await env.ASSETS.fetch(
    new Request(knowledgeUrl, {
      method: "GET",
    })
  );

  if (!response.ok) {
    throw new Error(
      `Knowledge file not found at ${KNOWLEDGE_PATH}.`
    );
  }

  const content = (await response.text()).trim();

  if (!content) {
    throw new Error(
      "The assistant knowledge file is empty."
    );
  }

  cachedKnowledge = content.slice(
    0,
    MAX_KNOWLEDGE_CHARACTERS
  );

  return cachedKnowledge;
}


// ============================================================
// LOAD DENTAL PRACTICES
// ============================================================

async function loadPractices(request, env) {
  if (cachedPractices) {
    return cachedPractices;
  }

  if (!env.ASSETS) {
    throw new Error(
      "The ASSETS binding is missing."
    );
  }

  const dataUrl = new URL(
    "/practices.json",
    request.url
  );

  const response = await env.ASSETS.fetch(
    new Request(dataUrl, {
      method: "GET",
    })
  );

  if (!response.ok) {
    throw new Error(
      "practices.json was not found."
    );
  }

  const payload = await response.json();

  const items = Array.isArray(payload)
    ? payload
    : payload.locations ||
      payload.results ||
      payload.data ||
      [];

  if (!Array.isArray(items)) {
    throw new Error(
      "practices.json has an unsupported format."
    );
  }

  cachedPractices = items;

  return cachedPractices;
}


// ============================================================
// PRACTICE SEARCH
// ============================================================

function searchablePracticeText(item) {
  return [
    item.name,
    item.address1,
    item.address2,
    item.townCity,
    item.town,
    item.city,
    item.postcode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}


async function handleCqc(request, env) {
  if (request.method !== "GET") {
    return json(
      {
        error: "Use GET for this endpoint.",
      },
      405
    );
  }

  const query =
    new URL(request.url)
      .searchParams
      .get("q")
      ?.trim()
      .toLowerCase() || "";

  if (query.length < 2) {
    return json(
      {
        error:
          "Enter at least two characters.",
      },
      400
    );
  }

  try {
    const compactQuery =
      query.replace(/\s+/g, "");

    const practices =
      await loadPractices(
        request,
        env
      );

    const locations = practices
      .map((item) => {
        const text =
          searchablePracticeText(item);

        const compactText =
          text.replace(/\s+/g, "");

        let score = 0;

        const postcode = String(
          item.postcode || ""
        )
          .toLowerCase()
          .replace(/\s+/g, "");

        const town = String(
          item.townCity ||
          item.town ||
          item.city ||
          ""
        ).toLowerCase();

        if (postcode === compactQuery) {
          score += 100;
        }

        if (town === query) {
          score += 70;
        }

        if (
          compactText.includes(
            compactQuery
          )
        ) {
          score += 30;
        }

        if (text.includes(query)) {
          score += 20;
        }

        return {
          item,
          score,
        };
      })

      .filter(
        (result) =>
          result.score > 0
      )

      .sort(
        (a, b) =>
          b.score - a.score ||
          String(
            a.item.name || ""
          ).localeCompare(
            String(
              b.item.name || ""
            )
          )
      )

      .slice(0, 50)

      .map(
        (result) =>
          result.item
      );

    return json({
      locations,
    });

  } catch (error) {
    console.error(
      "Practice search error:",
      error
    );

    return json(
      {
        error:
          error.message ||
          "The practice database could not be loaded.",
      },
      503
    );
  }
}


// ============================================================
// CHAT HISTORY
// ============================================================

function cleanHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-10)

    .filter(
      (item) =>
        item &&
        ["user", "assistant"].includes(
          item.role
        )
    )

    .map((item) => ({
      role: item.role,

      content: String(
        item.content || ""
      ).slice(
        0,
        MAX_MESSAGE_CHARACTERS
      ),
    }))

    .filter(
      (item) =>
        item.content.trim()
    );
}


// ============================================================
// EXTRACT WORKERS AI RESPONSE
// ============================================================

function extractAnswer(result) {
  if (
    typeof result?.response ===
    "string"
  ) {
    return result.response;
  }

  if (
    typeof result?.result
      ?.response === "string"
  ) {
    return result.result.response;
  }

  if (
    typeof result?.choices?.[0]
      ?.message?.content === "string"
  ) {
    return result.choices[0]
      .message.content;
  }

  return "";
}


// ============================================================
// NLDC VIRTUAL ASSISTANT
// ============================================================

async function handleAssistant(
  request,
  env
) {
  if (request.method !== "POST") {
    return json(
      {
        error:
          "Use POST for this endpoint.",
      },
      405
    );
  }

  if (!env.AI) {
    return json(
      {
        error:
          "The Workers AI binding named AI has not been configured.",
      },
      503
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error:
          "The request must contain valid JSON.",
      },
      400
    );
  }

  const message = String(
    body?.message || ""
  ).trim();

  if (!message) {
    return json(
      {
        error:
          "Please enter a question.",
      },
      400
    );
  }

  if (
    message.length >
    MAX_MESSAGE_CHARACTERS
  ) {
    return json(
      {
        error:
          `Questions must be ${MAX_MESSAGE_CHARACTERS} characters or fewer.`,
      },
      400
    );
  }

  let knowledge;

  try {
    knowledge =
      await loadKnowledge(
        request,
        env
      );
  } catch (error) {
    return json(
      {
        error:
          error.message ||
          "The knowledge file could not be loaded.",
      },
      503
    );
  }

  const systemPrompt = `
You are the professional virtual assistant for the NLDC Trainee Dental Nurses Hub.

Answer questions using the approved reference material below.

If the answer is not supported by the material, say:

"I don't have that information in the approved NLDC resources yet. Please ask your tutor or supervisor."

RULES:

- Be friendly, clear, supportive and professional.
- Keep answers reasonably concise.
- Do not invent policies, dates, contacts, regulations or clinical instructions.
- Do not diagnose or prescribe.
- Do not provide patient-specific clinical advice.
- Remind users not to provide patient-identifiable information.
- Where appropriate, advise trainees to check current practice policy or ask their qualified supervisor.

REFERENCE MATERIAL:

--------------------

${knowledge}

--------------------

END REFERENCE MATERIAL
`;

  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },

    ...cleanHistory(
      body?.history
    ),

    {
      role: "user",
      content: message,
    },
  ];

  try {
    const result =
      await env.AI.run(
        AI_MODEL,
        {
          messages,
          max_tokens: 500,
          temperature: 0.2,
        }
      );

    const answer =
      extractAnswer(result).trim();

    if (!answer) {
      throw new Error(
        "Empty AI response."
      );
    }

    return json({
      answer,
    });

  } catch (error) {
    console.error(
      "Workers AI assistant error:",
      error
    );

    return json(
      {
        error:
          "The assistant could not prepare an answer. Please try again.",
      },
      502
    );
  }
}


// ============================================================
// AI MOCK INTERVIEW
// ============================================================

async function handleMockInterview(
  request,
  env
) {
  if (request.method !== "POST") {
    return json(
      {
        error:
          "Use POST for this endpoint.",
      },
      405
    );
  }

  if (!env.AI) {
    return json(
      {
        error:
          "The Workers AI binding named AI has not been configured.",
      },
      503
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error:
          "The request must contain valid JSON.",
      },
      400
    );
  }

  const role = String(
    body?.role ||
    body?.jobRole ||
    "Trainee Dental Nurse"
  )
    .trim()
    .slice(0, 150);

  const answer = String(
    body?.answer ||
    body?.message ||
    ""
  )
    .trim()
    .slice(
      0,
      MAX_MESSAGE_CHARACTERS
    );

  const action = String(
    body?.action || ""
  ).toLowerCase();

  const history =
    cleanHistory(
      body?.history
    );

  const systemPrompt = `
You are conducting a realistic professional job interview.

The candidate is interviewing for this role:

${role}

You are the INTERVIEWER.

Your job is to conduct the interview naturally, one question at a time.

IMPORTANT RULES:

1. Behave like a real interviewer.

2. Ask only ONE interview question at a time.

3. Questions should be appropriate for the role.

4. Start with a realistic introductory interview question.

5. After the candidate answers, briefly assess their answer.

6. Your feedback must be VERY SHORT — normally one or two sentences.

7. After giving the short feedback, ask the next interview question.

8. Use the candidate's previous answer when appropriate. Ask natural follow-up questions if something they said would realistically interest an interviewer.

9. Do not repeatedly ask the same questions.

10. Gradually cover different areas such as:
- motivation
- experience
- communication
- teamwork
- professionalism
- dealing with difficult situations
- organisation
- safeguarding or safety where relevant
- strengths
- scenario-based questions

11. Do not provide the candidate with a model answer before they answer.

12. Be professional but encouraging.

13. Do not make the interview feel like a quiz.

14. Do not write long explanations.

15. Keep the interview moving naturally.

When responding after an answer, return ONLY valid JSON in exactly this format:

{
  "feedback": "One or two short sentences of useful feedback.",
  "question": "The next interview question."
}

When starting the interview, return ONLY:

{
  "feedback": "",
  "question": "Your first interview question."
}
`;

  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },

    ...history,
  ];

  // Starting a brand-new interview
  if (
    action === "start" ||
    !answer
  ) {
    messages.push({
      role: "user",
      content:
        `Start the interview for the ${role} position. Ask the first question.`,
    });
  }

  // Candidate has submitted an answer
  else {
    messages.push({
      role: "user",
      content:
        `Candidate's answer:\n${answer}\n\nGive very short feedback and continue the interview with the next question.`,
    });
  }

  try {
    const result =
      await env.AI.run(
        AI_MODEL,
        {
          messages,
          max_tokens: 300,
          temperature: 0.5,
        }
      );

    let raw =
      extractAnswer(result)
        .trim();

    if (!raw) {
      throw new Error(
        "Empty AI interview response."
      );
    }

    // Remove Markdown code fences if the
    // model happens to include them.
    raw = raw
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/,
        ""
      )
      .trim();

    let parsed;

    try {
      parsed =
        JSON.parse(raw);
    } catch {
      /*
       * Fallback if the model does not
       * return perfectly formatted JSON.
       */
      console.warn(
        "Mock interview returned non-JSON:",
        raw
      );

      return json({
        feedback:
          answer
            ? "Thank you. Keep your answers clear and support them with specific examples where possible."
            : "",

        question: raw,
      });
    }

    const feedback = String(
      parsed.feedback || ""
    ).trim();

    const question = String(
      parsed.question || ""
    ).trim();

    if (!question) {
      throw new Error(
        "AI did not return another interview question."
      );
    }

    return json({
      feedback,
      question,
    });

  } catch (error) {
    console.error(
      "Mock interview AI error:",
      error
    );

    return json(
      {
        error:
          "The AI interviewer could not respond. Please try again.",
      },
      502
    );
  }
}


// ============================================================
// WORKER ROUTER
// ============================================================

export default {
  async fetch(
    request,
    env
  ) {
    const url =
      new URL(
        request.url
      );

    // Dental practice search
    if (
      url.pathname ===
      "/api/cqc"
    ) {
      return handleCqc(
        request,
        env
      );
    }

    // NLDC Virtual Assistant
    if (
      url.pathname ===
      "/api/assistant"
    ) {
      return handleAssistant(
        request,
        env
      );
    }

    // AI Mock Interview
    if (
      url.pathname ===
      "/api/mock-interview"
    ) {
      return handleMockInterview(
        request,
        env
      );
    }

    // Static website files
    if (!env.ASSETS) {
      return new Response(
        "Static ASSETS binding is not configured.",
        {
          status: 503,
        }
      );
    }

    return env.ASSETS.fetch(
      request
    );
  },
};
