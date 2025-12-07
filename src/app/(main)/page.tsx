"use client";
import axios from "axios";
import { useRouter } from "next/navigation";
import ChatInput from "@/components/chatinput/chatinput";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function MainPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(true);

    const checkTokens = async() => {
        try {
            const data = await axios.get("/api/chat/limit");
            console.log(data);
        } catch (error) {
            console.error("Error checking tokens:", error);
        } finally {
            setLoading(false);
        }
    }

    const sendPrompt = async (prompt: String) => {
        if (status !== "authenticated") {
            alert("Please log in to create a chat");
            return;
        }

        try {
            const newChat = await axios.post("/api/chat/create", { prompt: prompt });

            console.log(newChat);
            if(newChat.status === 200){
                router.push(`/c/${newChat.data.chatId}`);
            }
        } catch (error) {
            console.error("Error creating chat:", error);
            alert("Failed to create chat. Please try again.");
        }
    }

    useEffect(()=>{
        if (status === "authenticated") {
            checkTokens();
        } else if (status === "unauthenticated") {
            setLoading(false);
        }
    }, [status])

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    if (status === "unauthenticated") {
        return (
            <div className="flex flex-col min-h-screen justify-center items-center">
                <h1 className="text-3xl font-bold mb-6">ChatGPT Clone</h1>
                <p className="text-lg text-gray-600 mb-8">Please log in to continue</p>
                <a href="/api/auth/signin" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg">
                    Sign In
                </a>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-[40vh] justify-end items-center">
            <h1 className="text-2xl">What are you working on ?</h1>
            <div className="w-2xl mt-6">
            <ChatInput sendPrompt={(e:any)=>sendPrompt(e)}/>
            </div>
        </div>
    )
}