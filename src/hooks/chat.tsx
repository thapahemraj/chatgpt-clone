"use client";

import useSWR, { mutate } from "swr";

type Chat = {
  id: string;
  title: string;
  createdAt: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useChats() {
  // 🔹 Fetch all chats (cached globally by SWR)
  const { data: chats = [], error, isLoading } = useSWR<Chat[]>("/api/chat", fetcher);

  // 🔹 Poll a specific chat until title updates
  async function startPollingChat(chatId: string) {
    const interval = setInterval(async () => {
      const chat: Chat = await fetcher(`/api/chat/${chatId}`);

      if (chat.title !== "New Chat") {
        clearInterval(interval);

        // Update this chat in cache optimistically
        mutate(
          "/api/chat",
          (prev: Chat[] | undefined) =>
            prev?.map((c) => (c.id === chat.id ? chat : c)) ?? [],
          false // don't re-fetch yet
        );
      }
    }, 3000);
  }

  // 🔹 Refresh all chats manually (optional)
  function refreshChats() {
    mutate("/api/chat"); // tells SWR to re-fetch
  }

  return { chats, error, isLoading, startPollingChat, refreshChats };
}
