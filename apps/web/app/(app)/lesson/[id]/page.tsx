import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson, getOrder, nextLessonId, stepSequence } from "@/lib/lessons";
import { Player } from "./Player";

type Props = { params: Promise<{ id: string }> };

// Every lesson in order.json is prerendered at build time; any other id is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getOrder().map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lesson = getLesson((await params).id);
  return { title: lesson ? `${lesson.title} — Excel Guru` : "Lesson not found — Excel Guru" };
}

export default async function LessonPage({ params }: Props) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();

  return (
    <div className="wrap">
      <div className="brand">
        <Link href="/" style={{ textDecoration: "none" }}>Excel Guru</Link>
      </div>
      <Player lesson={lesson} next={stepSequence(lesson.steps.length)} nextLessonId={nextLessonId(id)} />
    </div>
  );
}
