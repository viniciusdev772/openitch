import { oauthCallback } from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => oauthCallback(req, "google");
