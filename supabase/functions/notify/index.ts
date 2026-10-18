// 慢慢来 · 推送通知
// 1. App 里有人留言、开始专注、拍了一刻……就调用这里，通知同一个房间的另一个人
// 2. 每小时由定时任务调用一次（kind: "hourly"），提醒还没拍这一刻的人
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "https://sky32666.github.io/manmanlai/",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Sub = { endpoint: string; room: string; author: string; sub: webpush.PushSubscription; tz: string | null; hourly: boolean | null };

async function send(s: Sub, payload: Record<string, unknown>) {
  try {
    await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 3600 });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("endpoint", s.endpoint); // 手机已经取消订阅
    console.error("push failed", code, (e as Error).message);
    return false;
  }
}

function localTime(tz: string | null) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz || "Asia/Kuala_Lumpur", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get("hour") % 24, minute: get("minute") };
}

async function hourly() {
  const { data: subs } = await sb.from("push_subs").select("*");
  let sent = 0;
  for (const s of (subs ?? []) as Sub[]) {
    if (s.hourly === false) continue;
    const { hour, minute } = localTime(s.tz);
    if (hour < 7 || hour > 23) continue; // 晚上不打扰
    const since = Date.now() - minute * 60000 - 60000;
    // 正在专注就不打扰
    const { data: f } = await sb.from("focus").select("phase,updated").eq("room", s.room).eq("author", s.author).maybeSingle();
    if (f && Number(f.updated) > Date.now() - 3 * 60000 && ["waiting", "down", "over"].includes(f.phase)) continue;
    // 这个小时已经拍过了也不提醒
    const { count } = await sb.from("posts").select("id", { count: "exact", head: true })
      .eq("room", s.room).eq("author", s.author).eq("kind", "moment").gte("created", since);
    if (count) continue;
    if (await send(s, { title: `⏰ ${hour}:00 了`, body: "拍一下现在在做什么？", tab: "diary", action: "shoot", tag: "hourly" })) sent++;
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json().catch(() => ({}));
  if (body.kind === "hourly") return json({ sent: await hourly() });

  const { room, from, title, text, tab, tag } = body;
  if (!room || !from || !title) return json({ error: "room, from and title are required" }, 400);
  const { data: subs } = await sb.from("push_subs").select("*").eq("room", room).neq("author", from);
  let sent = 0;
  for (const s of (subs ?? []) as Sub[]) if (await send(s, { title: String(title).slice(0, 80), body: String(text ?? "").slice(0, 160), tab, tag })) sent++;
  return json({ sent });
});
