import { fail, ok } from "@/lib/http/respond";
import { processEmailOutbox } from "@/lib/services/send-email";

// Called by Vercel Cron (see vercel.json) every minute.
// Also callable manually via GET for debugging.
export async function GET(req: Request) {
  try {
    // Verify cron secret when running on Vercel
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const result = await processEmailOutbox(20);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
