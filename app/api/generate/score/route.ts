import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { composePromptWithTags } from "@/lib/music/tags";
import { generateLeadSheet } from "@/lib/score/openrouter";

const requestSchema = z.object({
  prompt: z.string().min(3).max(8000),
  tags: z.array(z.string().min(1).max(60)).max(40).default([]),
});

export async function POST(req: NextRequest) {
  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const brief = composePromptWithTags(parsed.data.prompt, parsed.data.tags);

  try {
    const leadSheet = await generateLeadSheet(brief);
    return NextResponse.json({ leadSheet });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
