import { NextResponse } from "next/server";
export async function POST() { return NextResponse.json({ error: "stripe_unavailable" }, { status: 503 }); }
