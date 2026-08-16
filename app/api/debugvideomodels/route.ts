import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch("https://openrouter.ai/api/v1/videos/models", {
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
  });
  const json = await response.json();
  return NextResponse.json(json);
}
