import { eq, and, gte, lte, sql, count, desc } from "drizzle-orm";
import { db } from "~/db";
import {
  purchases,
  enrollments,
  quizzes,
  quizAttempts,
  quizAnswers,
  quizQuestions,
  quizOptions,
  lessons,
  modules,
  lessonProgress,
  LessonProgressStatus,
  courses,
  users,
} from "~/db/schema";

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

export interface MonthlyEnrollment {
  month: string; // YYYY-MM
  count: number;
  cumulative: number;
}

export interface EnrollmentAnalytics {
  totalEnrollments: number;
  monthlyEnrollments: MonthlyEnrollment[];
}

export function getEnrollmentAnalytics(
  courseId: number,
  dateRange?: DateRange
): EnrollmentAnalytics {
  const conditions = [eq(enrollments.courseId, courseId)];

  if (dateRange) {
    conditions.push(gte(enrollments.enrolledAt, `${dateRange.start}-01`));
    const [year, month] = dateRange.end.split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endBound = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
    conditions.push(lte(enrollments.enrolledAt, endBound));
  }

  const rows = db
    .select({
      month: sql<string>`substr(${enrollments.enrolledAt}, 1, 7)`.as("month"),
      count: count().as("count"),
    })
    .from(enrollments)
    .where(and(...conditions))
    .groupBy(sql`substr(${enrollments.enrolledAt}, 1, 7)`)
    .orderBy(sql`substr(${enrollments.enrolledAt}, 1, 7)`)
    .all();

  let cumulative = 0;
  const monthlyEnrollments: MonthlyEnrollment[] = rows.map((row) => {
    cumulative += row.count;
    return {
      month: row.month,
      count: row.count,
      cumulative,
    };
  });

  const totalEnrollments = cumulative;

  return { totalEnrollments, monthlyEnrollments };
}

export interface MonthlyCompletion {
  month: string; // YYYY-MM
  completions: number;
  cumulative: number;
}

export interface CompletionAnalytics {
  completionRate: number; // 0-100
  totalCompleted: number;
  totalEnrolled: number;
  monthlyCompletions: MonthlyCompletion[];
}

export function getCompletionAnalytics(courseId: number): CompletionAnalytics {
  const totalEnrolled = db
    .select({ count: count() })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();

  const totalEnrolledCount = totalEnrolled?.count ?? 0;

  const completedRows = db
    .select({
      month: sql<string>`substr(${enrollments.completedAt}, 1, 7)`.as("month"),
      completions: count().as("completions"),
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        sql`${enrollments.completedAt} IS NOT NULL`
      )
    )
    .groupBy(sql`substr(${enrollments.completedAt}, 1, 7)`)
    .orderBy(sql`substr(${enrollments.completedAt}, 1, 7)`)
    .all();

  let cumulative = 0;
  const monthlyCompletions: MonthlyCompletion[] = completedRows.map((row) => {
    cumulative += row.completions;
    return {
      month: row.month,
      completions: row.completions,
      cumulative,
    };
  });

  const totalCompleted = cumulative;
  const completionRate =
    totalEnrolledCount === 0
      ? 0
      : Math.round((totalCompleted / totalEnrolledCount) * 100);

  return {
    completionRate,
    totalCompleted,
    totalEnrolled: totalEnrolledCount,
    monthlyCompletions,
  };
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

// ─── Quiz Analytics ───

export interface QuizSummary {
  quizId: number;
  quizTitle: string;
}

export interface QuestionIncorrectRate {
  questionId: number;
  questionText: string;
  totalAnswers: number;
  incorrectCount: number;
  incorrectRate: number; // 0-100
}

export interface ScoreDistributionBucket {
  bucket: string; // e.g. "0-10%"
  count: number;
}

export interface MonthlyAttempts {
  month: string; // YYYY-MM
  attempts: number;
}

export interface QuizAnalytics {
  quizzes: QuizSummary[];
  passRate: number; // 0-100
  totalAttempts: number;
  questionIncorrectRates: QuestionIncorrectRate[];
  scoreDistribution: ScoreDistributionBucket[];
  monthlyAttempts: MonthlyAttempts[];
  averageScore: number; // 0-100
}

export function getQuizAnalytics(
  courseId: number,
  quizId?: number
): QuizAnalytics {
  // Get all quizzes for this course (quiz -> lesson -> module -> course)
  const courseQuizzes = db
    .select({
      quizId: quizzes.id,
      quizTitle: quizzes.title,
    })
    .from(quizzes)
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position, lessons.position)
    .all();

  if (courseQuizzes.length === 0) {
    return {
      quizzes: [],
      passRate: 0,
      totalAttempts: 0,
      questionIncorrectRates: [],
      scoreDistribution: buildEmptyDistribution(),
      monthlyAttempts: [],
      averageScore: 0,
    };
  }

  const quizSummaries: QuizSummary[] = courseQuizzes.map((q) => ({
    quizId: q.quizId,
    quizTitle: q.quizTitle,
  }));

  // Use first quiz if none specified
  const targetQuizId = quizId ?? courseQuizzes[0].quizId;

  // Pass rate
  const attempts = db
    .select({
      passed: quizAttempts.passed,
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.quizId, targetQuizId))
    .all();

  const totalAttempts = attempts.length;
  const passedCount = attempts.filter((a) => a.passed).length;
  const passRate =
    totalAttempts === 0 ? 0 : Math.round((passedCount / totalAttempts) * 100);

  // Average score
  const scoreRows = db
    .select({ score: quizAttempts.score })
    .from(quizAttempts)
    .where(eq(quizAttempts.quizId, targetQuizId))
    .all();

  const averageScore =
    scoreRows.length === 0
      ? 0
      : Math.round(
          (scoreRows.reduce((sum, r) => sum + r.score, 0) / scoreRows.length) *
            100
        );

  // Per-question incorrect rates
  const questionRows = db
    .select({
      questionId: quizQuestions.id,
      questionText: quizQuestions.questionText,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, targetQuizId))
    .orderBy(quizQuestions.position)
    .all();

  const questionIncorrectRates: QuestionIncorrectRate[] = questionRows.map(
    (q) => {
      const answers = db
        .select({
          selectedOptionId: quizAnswers.selectedOptionId,
        })
        .from(quizAnswers)
        .innerJoin(quizAttempts, eq(quizAnswers.attemptId, quizAttempts.id))
        .where(
          and(
            eq(quizAnswers.questionId, q.questionId),
            eq(quizAttempts.quizId, targetQuizId)
          )
        )
        .all();

      const totalAnswers = answers.length;
      if (totalAnswers === 0) {
        return {
          questionId: q.questionId,
          questionText: q.questionText,
          totalAnswers: 0,
          incorrectCount: 0,
          incorrectRate: 0,
        };
      }

      // Get correct option IDs for this question
      const correctOptions = db
        .select({ id: quizOptions.id })
        .from(quizOptions)
        .where(
          and(
            eq(quizOptions.questionId, q.questionId),
            eq(quizOptions.isCorrect, true)
          )
        )
        .all();
      const correctIds = new Set(correctOptions.map((o) => o.id));

      const incorrectCount = answers.filter(
        (a) => !correctIds.has(a.selectedOptionId)
      ).length;

      return {
        questionId: q.questionId,
        questionText: q.questionText,
        totalAnswers,
        incorrectCount,
        incorrectRate: Math.round((incorrectCount / totalAnswers) * 100),
      };
    }
  );

  // Score distribution (10 buckets: 0-10%, 10-20%, ..., 90-100%)
  const scoreDistribution = buildEmptyDistribution();
  for (const row of scoreRows) {
    const pct = row.score * 100;
    const bucketIndex = pct >= 100 ? 9 : Math.floor(pct / 10);
    scoreDistribution[bucketIndex].count++;
  }

  // Monthly attempt trends
  const monthlyRows = db
    .select({
      month: sql<string>`substr(${quizAttempts.attemptedAt}, 1, 7)`.as(
        "month"
      ),
      attempts: count().as("attempts"),
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.quizId, targetQuizId))
    .groupBy(sql`substr(${quizAttempts.attemptedAt}, 1, 7)`)
    .orderBy(sql`substr(${quizAttempts.attemptedAt}, 1, 7)`)
    .all();

  const monthlyAttempts: MonthlyAttempts[] = monthlyRows.map((r) => ({
    month: r.month,
    attempts: r.attempts,
  }));

  return {
    quizzes: quizSummaries,
    passRate,
    totalAttempts,
    questionIncorrectRates,
    scoreDistribution,
    monthlyAttempts,
    averageScore,
  };
}

function buildEmptyDistribution(): ScoreDistributionBucket[] {
  return Array.from({ length: 10 }, (_, i) => ({
    bucket: `${i * 10}-${(i + 1) * 10}%`,
    count: 0,
  }));
}

// ─── Drop-off Analytics ───

export interface LessonDropoff {
  lessonId: number;
  lessonTitle: string;
  moduleTitle: string;
  position: number; // sequential position across all modules
  completedCount: number;
  completedPercent: number; // 0-100
}

export interface DropoffAnalytics {
  totalEnrolled: number;
  lessons: LessonDropoff[];
}

export function getDropoffAnalytics(courseId: number): DropoffAnalytics {
  const totalEnrolled =
    db
      .select({ count: count() })
      .from(enrollments)
      .where(eq(enrollments.courseId, courseId))
      .get()?.count ?? 0;

  // Get all lessons ordered by module position, then lesson position
  const lessonRows = db
    .select({
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      moduleTitle: modules.title,
      modulePosition: modules.position,
      lessonPosition: lessons.position,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position, lessons.position)
    .all();

  // Get enrolled user IDs for this course
  const enrolledUsers = db
    .select({ userId: enrollments.userId })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .all();
  const enrolledUserIds = new Set(enrolledUsers.map((e) => e.userId));

  const lessonDropoffs: LessonDropoff[] = lessonRows.map((row, index) => {
    // Count completions by enrolled users only
    const completedRows = db
      .select({ userId: lessonProgress.userId })
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.lessonId, row.lessonId),
          eq(lessonProgress.status, LessonProgressStatus.Completed)
        )
      )
      .all();

    const completedCount = completedRows.filter((r) =>
      enrolledUserIds.has(r.userId)
    ).length;

    return {
      lessonId: row.lessonId,
      lessonTitle: row.lessonTitle,
      moduleTitle: row.moduleTitle,
      position: index + 1,
      completedCount,
      completedPercent:
        totalEnrolled === 0
          ? 0
          : Math.round((completedCount / totalEnrolled) * 100),
    };
  });

  return {
    totalEnrolled,
    lessons: lessonDropoffs,
  };
}

// ─── Platform-wide Analytics (Admin) ───

export type TimePeriod = "7d" | "30d" | "12m" | "all";

function getTimePeriodCutoff(period: TimePeriod): string | null {
  if (period === "all") return null;
  const now = new Date();
  switch (period) {
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    }
    case "12m": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString();
    }
  }
}

export function getPlatformRevenue(period: TimePeriod = "30d"): number {
  const cutoff = getTimePeriodCutoff(period);
  const conditions = cutoff ? [gte(purchases.createdAt, cutoff)] : [];

  const result = db
    .select({
      total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`.as("total"),
    })
    .from(purchases)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  return result?.total ?? 0;
}

export function getPlatformEnrollments(period: TimePeriod = "30d"): number {
  const cutoff = getTimePeriodCutoff(period);
  const conditions = cutoff ? [gte(enrollments.enrolledAt, cutoff)] : [];

  const result = db
    .select({ total: count().as("total") })
    .from(enrollments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  return result?.total ?? 0;
}

export interface TopEarningCourse {
  courseId: number;
  courseTitle: string;
  revenue: number; // in cents
}

export function getTopEarningCourse(
  period: TimePeriod = "30d"
): TopEarningCourse | null {
  const cutoff = getTimePeriodCutoff(period);
  const conditions = cutoff ? [gte(purchases.createdAt, cutoff)] : [];

  const result = db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`.as(
        "revenue"
      ),
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(courses.id)
    .orderBy(desc(sql`sum(${purchases.pricePaid})`))
    .limit(1)
    .get();

  if (!result || result.revenue === 0) return null;

  return result;
}
