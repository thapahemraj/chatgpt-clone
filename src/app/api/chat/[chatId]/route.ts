import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req:NextRequest, {params}: {params: {chatId: string}}){
    try {

        const session = await getServerSession(authOptions);
        if(!session?.user.id){
            return NextResponse.json({error: "Unauthorized", status:  401});
        }

        const { chatId } = await params;
        const title = await prisma.chat.findUnique({
            where: {
                id: chatId,
                userId: session.user.id
            }
        });

        return NextResponse.json(title,{status:200})

    }catch(error){
        console.log(error);
        return NextResponse.json({error: "Something went wrong!"}, { status: 500 })
    }
}