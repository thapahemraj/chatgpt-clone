import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

// 🔑 Ollama base URL
const OLLAMA_URL = "http://localhost:11434/api/generate";

export async function POST(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { chatId } = await params;
    const { userPrompt } = await req.json();

    if (!userPrompt) {
      return new Response("No prompt provided", { status: 400 });
    }

    // System prompt: ensures markdown + follow-up questions
    const systemPrompt = `
You are a helpful and friendly AI assistant. 
Always respond in clean, well-structured **Markdown**.

### Response Rules
1. **Code & Examples**
   - When asked for code, always include a full **working example** inside triple backticks with the correct language tag (e.g., \`\`\`js).
   - Add inline comments when helpful.
   - Explain step by step how the code works.

2. **Explanations**
   - Never just give code; always explain it.
   - Use bullet points or numbered lists.
   - Keep it conversational, like teaching a beginner.

3. **Formatting**
   - Use headings (###) for sections like “Code Example”, “Explanation”, “How to Run”.
   - Use bold/italics for emphasis.
   - Use tables for comparisons.

4. **Follow-up Questions**
   - At the end of every response, suggest 2–3 relevant follow-up questions.
   - Use a bullet list.

5. **Tone**
   - Be friendly, natural, and encourage curiosity.
`;

    // Build conversation history
    let messages: any[] = [{ role: "system", content: systemPrompt }];
    let currentChatId = chatId;

    // If no chatId → create new chat
    if (!currentChatId) {
      const newChat = await prisma.chat.create({
        data: { userId: session.user.id },
      });
      currentChatId = newChat.id;
      generateChatTitle(userPrompt, newChat.id);
    } else {
      generateChatTitle(userPrompt, chatId);

      const dbMessages = await prisma.message.findMany({
        where: { chatId: currentChatId, chat: { userId: session.user.id } },
        select: { role: true, content: true },
        orderBy: { createdAt: "asc" },
      });

      messages = [...messages, ...dbMessages];
    }

    // Add new user message
    messages.push({ role: "user", content: userPrompt });

    // 🔹 Convert messages into a plain-text conversation for Ollama
    const ollamaPrompt = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    // 🔹 Call Ollama with streaming
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt: ollamaPrompt,
        stream: true,
      }),
    });

    if (!response.body) {
      return new Response("No response from Ollama", { status: 500 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let assistantMessage = "";
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
              } catch (err) {
                console.error("Stream parse error:", err);
              }
            }
          }

          // Save assistant reply in DB
          await prisma.message.create({
            data: {
              chatId: currentChatId,
              role: "assistant",
              content: assistantMessage,
            },
          });

          controller.close();
        } catch (err) {
          console.error("Error streaming Ollama:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Error generating response", { status: 500 });
  }
}

// 🔹 Generate Chat Title using Ollama
async function generateChatTitle(userMessage: string, chatId: string) {
  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt: `Generate a **short and clear chat title** (max 6 words, no quotes or punctuation).
User message: "${userMessage}"`,
        stream: false,
      }),
    });

    const data = await response.json();
    const title = data.response?.trim() || "New Chat";

    await prisma.chat.update({
      where: { id: chatId },
      data: { title },
    });
  } catch (err) {
    console.error("Failed to generate chat title:", err);
  }
}
