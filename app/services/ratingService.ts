import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

export function getUserCourseRating(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId))
    )
    .get();
}

export function upsertRating(userId: number, courseId: number, rating: number) {
  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .onConflictDoUpdate({
      target: [courseRatings.userId, courseRatings.courseId],
      set: { rating, updatedAt: new Date().toISOString() },
    })
    .returning()
    .get();
}

export function getCourseRatingStats(courseId: number) {
  const result = db
    .select({
      averageRating: sql<number>`avg(${courseRatings.rating})`,
      ratingCount: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return {
    averageRating: result?.averageRating ?? 0,
    ratingCount: result?.ratingCount ?? 0,
  };
}

export function getCourseRatingStatsForCourses(courseIds: number[]) {
  if (courseIds.length === 0) return new Map<number, { averageRating: number; ratingCount: number }>();

  const rows = db
    .select({
      courseId: courseRatings.courseId,
      averageRating: sql<number>`avg(${courseRatings.rating})`,
      ratingCount: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId)
    .all();

  const map = new Map<number, { averageRating: number; ratingCount: number }>();
  for (const row of rows) {
    map.set(row.courseId, {
      averageRating: row.averageRating,
      ratingCount: row.ratingCount,
    });
  }
  return map;
}
