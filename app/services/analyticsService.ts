import { eq, and, gte, lte, sql, count } from "drizzle-orm";
import { db } from "~/db";
import { purchases, enrollments } from "~/db/schema";

export interface DateRange {
  start: string; // ISO date string (YYYY-MM-DD or YYYY-MM)
  end: string;
}

export interface MonthlyRevenue {
  month: string; // YYYY-MM
  revenue: number; // in cents
  cumulative: number; // in cents
}

export interface RevenueAnalytics {
  totalRevenue: number; // in cents
  monthlyRevenue: MonthlyRevenue[];
}

export function getRevenueAnalytics(
  courseId: number,
  dateRange?: DateRange
): RevenueAnalytics {
  const conditions = [eq(purchases.courseId, courseId)];

  if (dateRange) {
    conditions.push(gte(purchases.createdAt, `${dateRange.start}-01`));
    // End of the end month: use the first day of the next month as upper bound
    const [year, month] = dateRange.end.split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endBound = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
    conditions.push(lte(purchases.createdAt, endBound));
  }

  const rows = db
    .select({
      month: sql<string>`substr(${purchases.createdAt}, 1, 7)`.as("month"),
      revenue: sql<number>`sum(${purchases.pricePaid})`.as("revenue"),
    })
    .from(purchases)
    .where(and(...conditions))
    .groupBy(sql`substr(${purchases.createdAt}, 1, 7)`)
    .orderBy(sql`substr(${purchases.createdAt}, 1, 7)`)
    .all();

  let cumulative = 0;
  const monthlyRevenue: MonthlyRevenue[] = rows.map((row) => {
    cumulative += row.revenue;
    return {
      month: row.month,
      revenue: row.revenue,
      cumulative,
    };
  });

  const totalRevenue = cumulative;

  return { totalRevenue, monthlyRevenue };
}

export function getTotalEnrollmentCount(courseId: number): number {
  const result = db
    .select({ count: count() })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();
  return result?.count ?? 0;
}

export function getCompletionRate(courseId: number): number {
  const total = db
    .select({ count: count() })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();

  if (!total || total.count === 0) return 0;

  const completed = db
    .select({ count: count() })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        sql`${enrollments.completedAt} IS NOT NULL`
      )
    )
    .get();

  return Math.round(((completed?.count ?? 0) / total.count) * 100);
}
