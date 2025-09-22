import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });

export async function GET(req: NextRequest,  {params}: {params: {chatId:string}}){
    try{
        const session = await getServerSession(authOptions);

        if(!session?.user.id){
            return NextResponse.json({error: "Unauthorized"}, {status: 401});
        }
        const { chatId } = await params;
        console.log(chatId);
        const allMessages = await prisma.message.findMany({
            where:{
                chatId: chatId,
                chat: {
                    userId: session.user.id
                }
            }
        });

        return NextResponse.json(allMessages, {status: 200});

    }catch(error){
        console.log(error);
        return NextResponse.json({error: "Something went wrong!"}, {status: 500})
    } 
}

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
    Your job is to provide answers that are **clear, detailed, and easy to understand**. 
    Always respond in clean, well-structured **Markdown**.
    
    ### Response Rules
    1. **Code & Examples**
       - When asked for code, always include a full **working example** inside triple backticks with the correct language tag (e.g., \`\`\`js).
       - Add **inline comments** in code when helpful.
       - Follow code with an explanation of how it works, step by step.
    
    2. **Explanations**
       - Never just give code; always explain what the code does.
       - Use bullet points or numbered lists for clarity.
       - Keep the tone conversational, like you’re teaching a beginner.
    
    3. **Formatting**
       - Use headings (###) to separate sections like “Code Example”, “Explanation”, “How to Run”.
       - Use bold/italics for emphasis.
       - Use tables if listing options, differences, or comparisons.
    
    4. **Follow-up Questions**
       - At the end of every response, suggest **2–3 relevant follow-up questions** the user might ask next.
       - Format them as a bullet list.
    
    5. **Tone**
       - Be friendly and natural (like ChatGPT).
       - Encourage curiosity and exploration.
       - Avoid being overly formal or robotic.
    
    ---
    `;
    

    // Build conversation messages
    let messages: any[] = [{ role: "system", content: systemPrompt }];
    let currentChatId = chatId;
    console.log(currentChatId, "Chat Id");

    // If no chatId, create a new chat
    if (!currentChatId) {
      const newChat = await prisma.chat.create({
        data: { userId: session.user.id },
      });
      currentChatId = newChat.id;
      console.log("CALLING HERE")
      generateChatTitle(userPrompt, newChat.id);
     
    } else {
        generateChatTitle(userPrompt, chatId);
        console.log("AB IDHR CHALRAHA HAI")
      const dbMessages = await prisma.message.findMany({
        where: { chatId: currentChatId, chat: { userId: session.user.id } },
        select: { role: true, content: true },
        orderBy: { createdAt: "asc" },
      });

      // Append DB messages to context
      messages = [...messages, ...dbMessages];
    }

    // Add new user message
    messages.push({ role: "user", content: userPrompt });

    // Create OpenAI streaming completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // 🔑 recommended for chatbot apps
      messages,
      stream: true,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        let assistantMessage = "";

        try {
          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content || "";
            assistantMessage += text;

            // Send partial text to client
            controller.enqueue(encoder.encode(text));
          }

          // Save assistant response in DB
          await prisma.message.create({
            data: {
              chatId: currentChatId,
              role: "assistant",
              content: assistantMessage,
            },
          });

          controller.close();
        } catch (err) {
          console.error("Error streaming completion:", err);
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

async function generateChatTitle(userMessage: string, chatId: string) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an assistant that generates **short and clear chat titles**. " +
              "Return only the title, no quotes, no punctuation at the end. " +
              "Max 6 words.",
          },
          { role: "user", content: userMessage },
        ],
        max_tokens: 20,
        temperature: 0.7,
      });
  
      const title =
        completion.choices[0].message.content?.trim() || "New Chat";
        console.log("title", title);
  
      // ✅ Save in DB
      await prisma.chat.update({
        where: { id: chatId },
        data: { title },
      });
  
    } catch (err) {
      console.error("Failed to generate chat title:", err);
    }
  }
  