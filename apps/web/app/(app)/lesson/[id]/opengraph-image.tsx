import { ImageResponse } from "next/og";
import { getLesson } from "@/lib/lessons";
import { siteUrl } from "@/lib/seo";

export const alt = "Excel Guru Lesson";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ id: string }> };

export default async function LessonOgImage({ params }: Props) {
  const { id } = await params;
  const lesson = getLesson(id);
  const title = lesson?.title ?? "Excel Practice Lesson";
  const moduleName = lesson?.module ? lesson.module.toUpperCase() : "LESSON";
  const url = siteUrl(`/lesson/${id}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#107c41",
          color: "white",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 36, opacity: 0.9, fontWeight: 700 }}>Excel Guru</div>
          <div
            style={{
              fontSize: 22,
              background: "rgba(255, 255, 255, 0.2)",
              padding: "8px 20px",
              borderRadius: 999,
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            {moduleName}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.15, marginBottom: 20 }}>
            {title}
          </div>
          <div style={{ fontSize: 28, opacity: 0.9 }}>
            Interactive spreadsheet exercises with instant formula grading
          </div>
        </div>
        <div
          style={{
            fontSize: 26,
            fontFamily: "monospace",
            background: "rgba(0, 0, 0, 0.25)",
            padding: "14px 22px",
            borderRadius: 10,
            alignSelf: "flex-start",
          }}
        >
          {url}
        </div>
      </div>
    ),
    size,
  );
}
