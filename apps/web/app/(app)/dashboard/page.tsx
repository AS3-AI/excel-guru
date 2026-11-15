import { DashboardContent, TopNav } from "@/components/TopNav";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLesson, getOrder } from "@/lib/lessons";
import { getStatusTag } from "@/lib/progress";
import { MODULES, type StatusTag } from "@/lib/modules";
import "./dashboard.css";

export default async function DashboardPage() {
  const order = getOrder();
  const lessonModules = Object.fromEntries(order.flatMap((id) => { const lesson = getLesson(id); return lesson ? [[id, lesson.module]] : []; }));
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  let completedIds: string[] = [];
  let tags: StatusTag[] = [];
  if (user) {
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin.from("lesson_progress").select("lesson_id,completed_at,first_try_accuracy").eq("user_id", user.id);
      const rows = data ?? [];
      completedIds = rows.map((row) => row.lesson_id);
      tags = rows.map((row) => getStatusTag(row.first_try_accuracy ?? 0, new Date(row.completed_at), new Date()));
    }
  }
  const moduleDone = MODULES.map((module) => [module.title.toLowerCase(), order.filter((id) => lessonModules[id]?.toLowerCase() === module.title.toLowerCase() && completedIds.includes(id)).length] as [string, number]);
  return <><TopNav signedIn={!!user} /><DashboardContent signedIn={!!user} completedIds={completedIds} tags={tags} moduleDone={Object.fromEntries(moduleDone)} order={order} lessonModules={lessonModules} /></>;
}
