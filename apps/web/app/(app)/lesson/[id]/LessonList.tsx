import Link from "next/link";

export type LessonNavItem = { id: string; title: string };
export function LessonList({ items, currentId }: { items: LessonNavItem[]; currentId: string }) {
  return <nav className="pl-lessons" aria-label="Lessons"><h2>Lessons</h2><ol>{items.map((item, i) => (
    <li key={item.id} className={item.id === currentId ? "is-current" : ""}>
      <Link href={`/lesson/${item.id}`}><span className="pl-lesson-num">{i + 1}</span><span>{item.title}</span>{item.id === currentId ? <b>IN PROGRESS</b> : null}</Link>
    </li>
  ))}</ol></nav>;
}
