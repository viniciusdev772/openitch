import { oauthStart } from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => oauthStart(req, "google");
