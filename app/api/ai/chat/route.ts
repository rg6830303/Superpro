import { NextResponse } from "next/server";
import { retrieveRelevantContext, type KnowledgeChunk } from "@/lib/rag-knowledge";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { messages?: ChatMessage[] };
    const messages = body.messages ?? [];
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content?.trim() ?? "";

    if (!lastUserMessage) {
      return NextResponse.json({
        reply: "Ask about court bookings, tournament draws, paddles, coaching or the rules.",
        actions: [
          { label: "Book a Game Slot", href: "/games" },
          { label: "Shop Carbon Paddles", href: "/products" },
          { label: "View Tournaments", href: "/tournaments" },
        ],
      });
    }

    // Retrieve relevant context chunks using our RAG engine
    const contexts = retrieveRelevantContext(lastUserMessage, 3);
    const actions: Array<{ label: string; href: string }> = [];

    for (const c of contexts) {
      if (c.action && !actions.some((a) => a.href === c.action!.href)) {
        actions.push(c.action);
      }
    }

    // Check for OpenAI / Gemini LLM API keys
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    let llmAnswer: string | null = null;

    if (geminiKey) {
      try {
        const systemInstruction = `You are the AI Caddy & Customer Support Assistant for SuperPro, a pickleball club and booking platform in Kolkata, India.
Use the following verified context from the SuperPro knowledge base to answer the user's inquiry concisely, warmly, and accurately.
Include relevant platform advice. Official WhatsApp is +91 91631 32551.
Context:
${contexts.map((c) => `--- ${c.title} ---\n${c.content}`).join("\n\n")}`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: `${systemInstruction}\n\nUser Question: ${lastUserMessage}` }] },
              ],
              generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
            }),
          },
        );
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) llmAnswer = text.trim();
        }
      } catch (e) {
        console.warn("[ai/chat] Gemini upstream call failed, falling back to local synthesis:", e);
      }
    } else if (openAiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are SuperPro's AI Pickleball Assistant for our platform in Kolkata. Answer the user question based on this context:
${contexts.map((c) => `[${c.title}]: ${c.content}`).join("\n\n")}`,
              },
              ...messages.slice(-4),
            ],
            max_tokens: 450,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content;
          if (text) llmAnswer = text.trim();
        }
      } catch (e) {
        console.warn("[ai/chat] OpenAI upstream call failed, falling back to local synthesis:", e);
      }
    }

    // If LLM returned a synthesized answer, return it with context actions
    if (llmAnswer) {
      return NextResponse.json({
        reply: llmAnswer,
        actions: actions.slice(0, 3),
      });
    }

    // High-precision Local Semantic Synthesis Fallback (zero external dependencies)
    const primary = contexts[0];
    const secondary = contexts[1];

    let synthesizedReply = `${primary.content}`;
    if (secondary && secondary.category !== primary.category) {
      synthesizedReply += `\n\nAdditionally, ${secondary.content}`;
    }

    // Suggest next actions
    const defaultActions = [
      { label: "Book a Game Slot", href: "/games" },
      { label: "Shop Paddles & Balls", href: "/products" },
      { label: "Tournaments & Draws", href: "/tournaments" },
      { label: "Contact WhatsApp (+91 91631 32551)", href: "https://wa.me/919163132551" },
    ];

    const finalActions = actions.length > 0 ? actions.slice(0, 3) : defaultActions.slice(0, 2);

    return NextResponse.json({
      reply: synthesizedReply,
      actions: finalActions,
    });
  } catch (err) {
    console.error("[ai/chat] error:", err);
    return NextResponse.json(
      {
        reply:
          "I'm having a little trouble connecting right now. You can reach our SuperPro venue team directly on WhatsApp at +91 91631 32551 for instant assistance!",
        actions: [{ label: "Chat on WhatsApp", href: "https://wa.me/919163132551" }],
      },
      { status: 200 },
    );
  }
}
