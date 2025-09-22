"use client";
import ChatInput from "@/components/chatinput/chatinput";
import { use } from "react";
import { useEffect, useState, useRef } from "react";
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from "rehype-highlight";
import 'highlight.js/styles/github.css';
import { useChats } from "@/hooks/chat";

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [messages, setAllMessages] = useState<any[]>([]);

  const hasFetched = useRef(false); // Strict Mode guard
  const { startPollingChat } = useChats();

  const fetchChat = async () => {
    try {
      const res = await fetch(`/api/chat/${chatId}/message`);
      if (res.ok) {
        const data = await res.json();
        const lastMessage = data[data.length - 1];
        if (lastMessage?.role === "user") sendPrompt(lastMessage.content);
        else {
          setAllMessages(data)
        }
        if(data.length === 1){
          startPollingChat(chatId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sendPrompt = async (prompt: string) => {
    const tempUser = { id: Date.now(), role: "user", content: prompt };
    setAllMessages(prev => [...prev, tempUser]);
    scrollToBottom();
    await streamAssistantResponse(prompt);
  };

  const streamAssistantResponse = async (prompt: string) => {
    try {
      const res = await fetch(`/api/chat/${chatId}/ollama`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPrompt: prompt }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      const tempId = Date.now();
      setAllMessages(prev => [...prev, { id: tempId, role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        assistantMessage += chunk;
        setAllMessages(prev =>
          prev.map(msg => (msg.id === tempId ? { ...msg, content: assistantMessage } : msg))
        );
        scrollToBottom();
      }
    } catch (err) {
      console.error("Error streaming assistant:", err);
    } finally {
      console.log("Completed!");
    }
  };

  const scrollToBottom = () => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth"
    })
  }

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchChat();
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-scroll" ref={chatContainerRef}>
      <div className="flex-1 flex flex-col gap-2 m-auto w-3xl pb-[10rem]" >
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`w-3xl py-2 px-3 rounded-xl ${msg.role === "user" ? "max-w-xl self-end bg-neutral-100" : "self-start"
              }`}
          >
            <ReactMarkdown
              children={msg.content}
              rehypePlugins={[rehypeHighlight as any]}
              className="prose break-words"
              components={{
                code({ node, inline, className, children, ...props }) {
                  if (inline) {
                    // Inline code
                    return (
                      <code className="bg-gray-200 text-gray-800 px-1 rounded">
                        {children}
                      </code>
                    );
                  }

                  // Block code
                  return (
                    <pre className=" text-white py-4 rounded-lg overflow-x-auto" >
                      <code className={`${className} font-mono bg-dark`} {...props} style={{background: "#F4F4F5", color: "#000"}}>
                        {children}
                      </code>
                    </pre>
                  );
                },
                
                
              }}
            />
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 flex gap-2 w-full z-1 flex-col items-center bg-white">
        
        <div className="w-3xl">
        <ChatInput sendPrompt={sendPrompt} />
        </div>
        <p className="bg-white mb-2 text-xs text-neutral-600">ChatGPT can make mistakes. Check important info. See Cookie Preferences.</p>
      </div>
    </div>
  );
}
