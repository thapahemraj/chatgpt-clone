"use client";
import axios from "axios";
import { useRouter } from "next/navigation";
import ChatInput from "@/components/chatinput/chatinput";
export default function MainPage() {
    const router = useRouter();

    const sendPrompt = async (prompt: String) => {
        const newChat = await axios.post("/api/chat/create", { prompt: prompt });

        console.log(newChat);
        if(newChat.status === 200){
            router.push(`/c/${newChat.data.chatId}`);
        }
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