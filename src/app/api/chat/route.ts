import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET(){
    try{
        const session = await getServerSession(authOptions);

        if(!session?.user.id){
            return NextResponse.json({error: "Unauthorized!"}, {status: 401});
        }

        const allChats = await prisma.chat.findMany({
            where:{ 
                userId: session.user.id
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        return NextResponse.json(allChats, {status: 200});

    }catch(error){
        console.log(error);
        return NextResponse.json({error: "Something went wrong!"}, {status: 500});
    }
}