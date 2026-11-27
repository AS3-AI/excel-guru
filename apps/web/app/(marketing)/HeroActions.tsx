"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";

export function HeroActions({ lessonOrder }: { lessonOrder: string[] }) {
  const [signedIn, setSignedIn] = useState(false);
  const [continueHref, setContinueHref] = useState("/lesson/intro");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let active = true;

    async function loadContinueTarget(userId: string) {
      if (!supabase) return;
      const { data: progressRows } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", userId);
      if (!active) return;
      const completed = new Set((progressRows ?? []).map((row) => row.lesson_id));
      const nextLesson = lessonOrder.find((id) => !completed.has(id));
      setContinueHref(nextLesson ? `/lesson/${nextLesson}` : "/lesson/intro");
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const user = data.session?.user;
      setSignedIn(!!user);
      if (user) void loadContinueTarget(user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const user = session?.user;
      setSignedIn(!!user);
      if (user) void loadContinueTarget(user.id);
      else setContinueHref("/lesson/intro");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [lessonOrder]);

  return (
    <div
      className="hero-actions flex flex-wrap gap-s4 mt-s6
          [@media(max-width:640px)]:[&_.btn]:w-full"
    >
      {signedIn ? (
        <Link className="btn btn-lg" href={continueHref}>
          Continue Learning <Icon name="arrowRight" size={18} />
        </Link>
      ) : (
        <>
          <Link className="btn btn-lg" href="/lesson/intro">
            Start the free lesson <Icon name="arrowRight" size={18} />
          </Link>
          <Link className="btn btn-lg btn-quiet" href="#curriculum">
            Browse the curriculum
          </Link>
        </>
      )}
    </div>
  );
}
