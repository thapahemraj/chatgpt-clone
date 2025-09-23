import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { countMessageTokens } from "@/lib/tokenizer";
import { addUserTokens, checkUserTokenLimit } from "@/lib/tokenTracker";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Ollama endpoint
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";

// Helper: select AI client based on environment
function getAIProvider() {
  const provider = process.env.AI_PROVIDER || "openai";
  if (provider === "ollama") return "ollama";
  return "openai";
}

// Helper: unified chat completion
async function createChatCompletion(messages: any[], options?: any) {
  const provider = getAIProvider();
  if (provider === "ollama") {
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "mistral", prompt, ...options }),
    });
    return response;
  } else {
    const client = new OpenAI({ apiKey: process.env.OPEN_AI_API });
    return client.chat.completions.create({ messages, ...options });
  }
}

// ------------------ GET Messages ------------------
export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await params;
    const allMessages = await prisma.message.findMany({
      where: { chatId, chat: { userId: session.user.id } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(allMessages, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Something went wrong!" }, { status: 500 });
  }
}

// ------------------ POST Messages / AI Response ------------------
export async function POST(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    let { chatId } = await params;
    const { userPrompt } = await req.json();
    if (!userPrompt) return new Response("No prompt provided", { status: 400 });

    // System prompt
    const systemPrompt = `
You are a helpful and friendly AI assistant. 
Always respond in clean, well-structured **Markdown**.

### Response Rules
1. **Code & Examples**
   - Include full examples with backticks and language tag.
   - Inline comments and step-by-step explanation.

2. **Explanations**
   - Explain, don’t just provide code.
   - Use bullets/numbered lists.

3. **Formatting**
   - Headings for sections.
   - Bold/italics for emphasis.
   - Tables for comparisons.

4. **Follow-up Questions**
   - Suggest 2–3 relevant follow-ups.

5. **Tone**
   - Friendly, natural, encourage curiosity.
`;

    // Fetch / build conversation messages
    let messages: any[] = [{ role: "system", content: systemPrompt }];

    if (!chatId) {
      const newChat = await prisma.chat.create({
        data: { userId: session.user.id },
      });
      chatId = newChat.id;
      await generateChatTitle(userPrompt, chatId); // ✅ FIX: await
    } else {
      await generateChatTitle(userPrompt, chatId); // ✅ FIX: await
      const dbMessages = await prisma.message.findMany({
        where: { chatId, chat: { userId: session.user.id } },
        select: { role: true, content: true },
        orderBy: { createdAt: "asc" },
      });
      messages = [...messages, ...dbMessages];
    }

    messages.push({ role: "user", content: userPrompt });

    // Token estimation & check (only for OpenAI)
    if (getAIProvider() === "openai") {
      const estimatedTokens = countMessageTokens(messages);
      try {
        await checkUserTokenLimit(session.user.id, estimatedTokens, chatId);
      } catch {
        return new Response(
          JSON.stringify({ error: "Daily token limit reached" }),
          { status: 403 }
        );
      }
    }

    // ---------------- Streaming AI Response ----------------
    const provider = getAIProvider();
    const encoder = new TextEncoder();
    let assistantMessage = "";

    if (provider === "ollama") {
      const response: any = await createChatCompletion(messages, {
        stream: true,
      });
      if (!response.body)
        return new Response("No response from Ollama", { status: 500 });

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n").filter(Boolean);
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.response) {
                    assistantMessage += data.response;
                    controller.enqueue(encoder.encode(data.response));
                  }
                } catch {}
              }
            }

            await prisma.message.create({
              data: { chatId, role: "assistant", content: assistantMessage },
            });
            controller.close();
          } catch (err) {
            console.error("Ollama stream error:", err);
            controller.error(err);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      // OpenAI streaming
      const completion: any = await createChatCompletion(messages, {
        model: "gpt-4o-mini",
        stream: true,
        temperature: 0.7,
      });
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completion) {
              const text = chunk.choices[0]?.delta?.content || "";
              assistantMessage += text;
              controller.enqueue(encoder.encode(text));
            }

            await prisma.message.create({
              data: { chatId, role: "assistant", content: assistantMessage },
            });

            controller.close();
          } catch (err) {
            console.error("OpenAI stream error:", err);
            controller.error(err);
          }
        },
      });

      // Add tokens after successful response
      const estimatedTokens = countMessageTokens(messages);
      addUserTokens(session.user.id, estimatedTokens, chatId);

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  } catch (error) {
    console.error(error);
    return new Response("Error generating response", { status: 500 });
  }
}

// ---------------- Generate Chat Title ----------------
async function generateChatTitle(userMessage: string, chatId: string) {
  try {
    const provider = getAIProvider();
    let rawTitle = "New Chat";

    if (provider === "ollama") {
      const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral",
          prompt: `Generate a **short and clear chat title** (max 6 words, no quotes or punctuation).
User message: "${userMessage}"`,
          stream: false
        }),
      });
      const data = await response.json();
      rawTitle = data.response?.trim() || "New Chat";
    } else {
      const completion: any = await createChatCompletion(
        [
          {
            role: "system",
            content:
              "Generate a short chat title (max 6 words, no quotes/punctuation)",
          },
          { role: "user", content: userMessage },
        ],
        { model: "gpt-4o-mini", max_tokens: 20, temperature: 0.7 } // ✅ Added model
      );
      rawTitle = completion.choices[0].message.content?.trim() || "New Chat";
    }

    const cleanTitle = rawTitle.replace(/["'.!?]/g, "").trim();
    console.log("Generated chat title:", cleanTitle);

    await prisma.chat.update({
      where: { id: chatId },
      data: { title: cleanTitle },
    });

    return cleanTitle;
  } catch (err) {
    console.error("Failed to generate chat title:", err);
    return "New Chat";
  }
}
