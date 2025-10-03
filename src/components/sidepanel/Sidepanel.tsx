"use client";

import ChatGPT from "../icons/ChatGPT";
import { SidebarCloseIcon,  SidebarOpenIcon } from "lucide-react";
import Link from "next/link";
import NewChat from "../icons/NewChat";
import Search from "../icons/Search";
import Library from "../icons/Library";
import Sora from "../icons/Sora";
import GPT from "../icons/GPT";
import NewProject from "../icons/NewProject";
import clsx from "clsx";
import { useState } from "react";
import { useChats } from "@/hooks/chat";

export default function Sidepanel() {
    const [collapsed, setCollapsed] = useState(false);
    const { chats } = useChats();

    return (
        <div className={clsx("bg-gray-50 transition-all duration-150 flex flex-col box-border h-[100vh] overflow-scroll border-r border-gray-200",
            collapsed ? 'w-[50px]' : 'w-[260px]'
        )}>
            <div className="sticky top-0 z-1 bg-gray-50">
                <div className="flex justify-between p-4 group">
                    <button className={clsx("cursor-pointer",
                        {
                            'group-hover:hidden': collapsed
                        }
                    )}>
                        <ChatGPT className="w-6 h-6 text-black dark:text-white" />
                    </button>
                    <button className={clsx("cursor-pointer",
                        {
                            "hidden group-hover:block": collapsed
                        }
                    )} onClick={() => setCollapsed(!collapsed)}>
                        {
                            collapsed ?
                                <SidebarOpenIcon width={16} height={16} className="text-gray-600 h-6 w-6" />
                                :
                                <SidebarCloseIcon width={16} height={16} className="text-gray-600 h-6 w-6" />
                        }
                    </button>
                </div>
                <div className="px-2">
                    <Link href="/" className="px-2 rounded-sm flex gap-3 py-2 text-md w-full hover:bg-gray-200">
                        <NewChat className="text-black w-6 h-6 flex-shrink-0" />
                        <span className={clsx({
                            "hidden": collapsed
                        })}>New chat</span>
                    </Link>
                    <Link href="/" className="px-2 rounded-sm flex gap-3 py-2 text-md w-full hover:bg-gray-200">
                        <Search className="text-black w-6 h-6 flex-shrink-0" />
                        <span className={clsx({
                            "hidden": collapsed
                        })}>Search chat</span>
                    </Link>
                    <Link href="/" className="px-2 rounded-sm flex gap-3 py-2 text-md w-full hover:bg-gray-200">
                        <Library className="text-black w-6 h-6 flex-shrink-0" />
                        <span className={clsx({
                            "hidden": collapsed
                        })}>Library</span>
                    </Link>
                </div>
            </div>

            <div className={clsx({
                "hidden": collapsed
            })}>
                <div className={`my-6 mx-2`}>
                    <Link href="/" className="px-2 rounded-sm flex gap-3 py-2 text-md w-full hover:bg-gray-200">
                        <Sora className="text-black w-6 h-6" />
                        Sora
                    </Link>
                    <Link href="/" className="px-2 rounded-sm flex gap-3 py-2 text-md w-full hover:bg-gray-200">
                        <GPT className="text-black w-6 h-6" />
                        GPTs
                    </Link>
                </div>
                <div className="my-6 mx-2">
                    <Link href="/" className="px-2 rounded-sm flex gap-3 py-2 text-md w-full hover:bg-gray-200">
                        <NewProject className="text-black w-6 h-6" />
                        New Project
                    </Link>
                </div>
                <div className="my-6 mx-2">
                    <p className="px-2 text-gray-500 text-md">Chats</p>
                    <div className="mt-2">
                        {
                            chats.map((element:any) => {
                                return (
                                    <Link key={element.id} href={`/c/${element.id}`} className="block p-2 rounded-sm text-md hover:bg-gray-200 truncate">
                                    {element.title}
                                </Link>)
                            })
                        }
                     
                    </div>
                </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 flex-0 inset-0 mt-auto border-t border-gray-200 p-2">
                <div className="flex items-center justify-between">
                    <div className="flex gap-2 items-center">
                        <div className="rounded-[100%] w-7 h-7 bg-blue-400 text-white flex items-center justify-center flex-shrink-0">H</div>
                        <div className={clsx("flex flex-col gap-.5 flex-shrink-0",
                            {
                                "hidden": collapsed
                            }
                        )}>
                            <span className="text-sm ">Harsh Agrawal</span>
                            <span className="text-xs text-gray-500">Free</span>
                        </div>
                    </div>
                    <div className={clsx("pr-2", {
                        "hidden": collapsed
                    })}>
                        <button className="px-2 py-1 bg-white rounded-2xl border border-gray-300 outline-0 text-xs font-medium cursor-pointer">Upgrade</button>
                    </div>
                </div>
            </div>

        </div>
    )
}