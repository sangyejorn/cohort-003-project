import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getRevenueAnalytics,
  getEnrollmentAnalytics,
  getCompletionAnalytics,
  getTotalEnrollmentCount,
  getCompletionRate,
  getQuizAnalytics,
  getDropoffAnalytics,
  getPlatformRevenue,
  getPlatformEnrollments,
  getTopEarningCourse,
} from "./analyticsService";

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getRevenueAnalytics", () => {
    it("returns empty data when there are no purchases", () => {
      const result = getRevenueAnalytics(base.course.id);

      expect(result.totalRevenue).toBe(0);
      expect(result.monthlyRevenue).toHaveLength(0);
    });

    it("returns single month revenue correctly", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          createdAt: "2025-06-15T10:00:00.000Z",
        })
        .run();

      const result = getRevenueAnalytics(base.course.id);

      expect(result.totalRevenue).toBe(4999);
      expect(result.monthlyRevenue).toHaveLength(1);
      expect(result.monthlyRevenue[0].month).toBe("2025-06");
      expect(result.monthlyRevenue[0].revenue).toBe(4999);
      expect(result.monthlyRevenue[0].cumulative).toBe(4999);
    });

    it("aggregates multiple purchases in the same month", () => {
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            createdAt: "2025-06-10T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            pricePaid: 3000,
            createdAt: "2025-06-20T10:00:00.000Z",
          },
        ])
        .run();

      const result = getRevenueAnalytics(base.course.id);

      expect(result.totalRevenue).toBe(5000);
      expect(result.monthlyRevenue).toHaveLength(1);
      expect(result.monthlyRevenue[0].revenue).toBe(5000);
    });

    it("returns multiple months in order with cumulative totals", () => {
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            createdAt: "2025-03-15T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            createdAt: "2025-05-15T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 3000,
            createdAt: "2025-07-15T10:00:00.000Z",
          },
        ])
        .run();

      const result = getRevenueAnalytics(base.course.id);

      expect(result.totalRevenue).toBe(6000);
      expect(result.monthlyRevenue).toHaveLength(3);

      expect(result.monthlyRevenue[0]).toEqual({
        month: "2025-03",
        revenue: 1000,
        cumulative: 1000,
      });
      expect(result.monthlyRevenue[1]).toEqual({
        month: "2025-05",
        revenue: 2000,
        cumulative: 3000,
      });
      expect(result.monthlyRevenue[2]).toEqual({
        month: "2025-07",
        revenue: 3000,
        cumulative: 6000,
      });
    });

    it("filters by date range", () => {
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            createdAt: "2025-01-15T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            createdAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 3000,
            createdAt: "2025-12-15T10:00:00.000Z",
          },
        ])
        .run();

      const result = getRevenueAnalytics(base.course.id, {
        start: "2025-05",
        end: "2025-08",
      });

      expect(result.totalRevenue).toBe(2000);
      expect(result.monthlyRevenue).toHaveLength(1);
      expect(result.monthlyRevenue[0].month).toBe("2025-06");
    });

    it("does not include purchases from other courses", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            createdAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: otherCourse.id,
            pricePaid: 9999,
            createdAt: "2025-06-15T10:00:00.000Z",
          },
        ])
        .run();

      const result = getRevenueAnalytics(base.course.id);

      expect(result.totalRevenue).toBe(1000);
    });
  });

  describe("getTotalEnrollmentCount", () => {
    it("returns 0 when there are no enrollments", () => {
      expect(getTotalEnrollmentCount(base.course.id)).toBe(0);
    });

    it("returns correct count", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          { userId: base.user.id, courseId: base.course.id },
          { userId: base.instructor.id, courseId: base.course.id },
        ])
        .run();

      expect(getTotalEnrollmentCount(base.course.id)).toBe(2);
    });
  });

  describe("getEnrollmentAnalytics", () => {
    it("returns empty data when there are no enrollments", () => {
      const result = getEnrollmentAnalytics(base.course.id);

      expect(result.totalEnrollments).toBe(0);
      expect(result.monthlyEnrollments).toHaveLength(0);
    });

    it("returns single month enrollment correctly", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: "2025-06-15T10:00:00.000Z",
        })
        .run();

      const result = getEnrollmentAnalytics(base.course.id);

      expect(result.totalEnrollments).toBe(1);
      expect(result.monthlyEnrollments).toHaveLength(1);
      expect(result.monthlyEnrollments[0]).toEqual({
        month: "2025-06",
        count: 1,
        cumulative: 1,
      });
    });

    it("aggregates multiple enrollments in the same month", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2025-06-10T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            enrolledAt: "2025-06-20T10:00:00.000Z",
          },
        ])
        .run();

      const result = getEnrollmentAnalytics(base.course.id);

      expect(result.totalEnrollments).toBe(2);
      expect(result.monthlyEnrollments).toHaveLength(1);
      expect(result.monthlyEnrollments[0].count).toBe(2);
    });

    it("returns multiple months in order with cumulative totals", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2025-03-15T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            enrolledAt: "2025-05-15T10:00:00.000Z",
          },
        ])
        .run();

      const result = getEnrollmentAnalytics(base.course.id);

      expect(result.totalEnrollments).toBe(2);
      expect(result.monthlyEnrollments).toHaveLength(2);
      expect(result.monthlyEnrollments[0]).toEqual({
        month: "2025-03",
        count: 1,
        cumulative: 1,
      });
      expect(result.monthlyEnrollments[1]).toEqual({
        month: "2025-05",
        count: 1,
        cumulative: 2,
      });
    });

    it("filters by date range", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2025-01-15T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            enrolledAt: "2025-06-15T10:00:00.000Z",
          },
        ])
        .run();

      const result = getEnrollmentAnalytics(base.course.id, {
        start: "2025-05",
        end: "2025-08",
      });

      expect(result.totalEnrollments).toBe(1);
      expect(result.monthlyEnrollments).toHaveLength(1);
      expect(result.monthlyEnrollments[0].month).toBe("2025-06");
    });

    it("does not include enrollments from other courses", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: otherCourse.id,
            enrolledAt: "2025-06-15T10:00:00.000Z",
          },
        ])
        .run();

      const result = getEnrollmentAnalytics(base.course.id);

      expect(result.totalEnrollments).toBe(1);
    });
  });

  describe("getCompletionAnalytics", () => {
    it("returns zero values when there are no enrollments", () => {
      const result = getCompletionAnalytics(base.course.id);

      expect(result.completionRate).toBe(0);
      expect(result.totalCompleted).toBe(0);
      expect(result.totalEnrolled).toBe(0);
      expect(result.monthlyCompletions).toHaveLength(0);
    });

    it("returns 0% when no one has completed", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: "2025-06-15T10:00:00.000Z",
        })
        .run();

      const result = getCompletionAnalytics(base.course.id);

      expect(result.completionRate).toBe(0);
      expect(result.totalCompleted).toBe(0);
      expect(result.totalEnrolled).toBe(1);
      expect(result.monthlyCompletions).toHaveLength(0);
    });

    it("returns 100% when everyone has completed", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: "2025-06-01T10:00:00.000Z",
          completedAt: "2025-06-20T10:00:00.000Z",
        })
        .run();

      const result = getCompletionAnalytics(base.course.id);

      expect(result.completionRate).toBe(100);
      expect(result.totalCompleted).toBe(1);
      expect(result.totalEnrolled).toBe(1);
      expect(result.monthlyCompletions).toHaveLength(1);
      expect(result.monthlyCompletions[0]).toEqual({
        month: "2025-06",
        completions: 1,
        cumulative: 1,
      });
    });

    it("returns correct percentage for partial completion", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2025-06-01T10:00:00.000Z",
            completedAt: "2025-06-20T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            enrolledAt: "2025-06-05T10:00:00.000Z",
          },
        ])
        .run();

      const result = getCompletionAnalytics(base.course.id);

      expect(result.completionRate).toBe(50);
      expect(result.totalCompleted).toBe(1);
      expect(result.totalEnrolled).toBe(2);
    });

    it("groups completions by month with cumulative totals", () => {
      const user2 = testDb
        .insert(schema.users)
        .values({
          name: "User 2",
          email: "user2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2025-03-01T10:00:00.000Z",
            completedAt: "2025-04-15T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            enrolledAt: "2025-03-05T10:00:00.000Z",
            completedAt: "2025-06-10T10:00:00.000Z",
          },
          {
            userId: user2.id,
            courseId: base.course.id,
            enrolledAt: "2025-05-01T10:00:00.000Z",
          },
        ])
        .run();

      const result = getCompletionAnalytics(base.course.id);

      expect(result.completionRate).toBe(67); // 2/3 = 66.67 rounds to 67
      expect(result.totalCompleted).toBe(2);
      expect(result.totalEnrolled).toBe(3);
      expect(result.monthlyCompletions).toHaveLength(2);
      expect(result.monthlyCompletions[0]).toEqual({
        month: "2025-04",
        completions: 1,
        cumulative: 1,
      });
      expect(result.monthlyCompletions[1]).toEqual({
        month: "2025-06",
        completions: 1,
        cumulative: 2,
      });
    });

    it("does not include completions from other courses", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2025-06-01T10:00:00.000Z",
            completedAt: "2025-06-20T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: otherCourse.id,
            enrolledAt: "2025-06-01T10:00:00.000Z",
            completedAt: "2025-06-25T10:00:00.000Z",
          },
        ])
        .run();

      const result = getCompletionAnalytics(base.course.id);

      expect(result.totalCompleted).toBe(1);
      expect(result.totalEnrolled).toBe(1);
    });
  });

  describe("getCompletionRate", () => {
    it("returns 0 when there are no enrollments", () => {
      expect(getCompletionRate(base.course.id)).toBe(0);
    });

    it("returns 0 when no one has completed", () => {
      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();

      expect(getCompletionRate(base.course.id)).toBe(0);
    });

    it("returns 100 when everyone has completed", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          completedAt: "2025-06-20T10:00:00.000Z",
        })
        .run();

      expect(getCompletionRate(base.course.id)).toBe(100);
    });

    it("returns correct percentage for partial completion", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            completedAt: "2025-06-20T10:00:00.000Z",
          },
          { userId: base.instructor.id, courseId: base.course.id },
        ])
        .run();

      expect(getCompletionRate(base.course.id)).toBe(50);
    });
  });

  describe("getQuizAnalytics", () => {
    function createQuizWithQuestions(
      testDb: ReturnType<typeof createTestDb>,
      base: ReturnType<typeof seedBaseData>
    ) {
      const mod = testDb
        .insert(schema.modules)
        .values({
          courseId: base.course.id,
          title: "Module 1",
          position: 1,
        })
        .returning()
        .get();

      const lesson = testDb
        .insert(schema.lessons)
        .values({
          moduleId: mod.id,
          title: "Lesson 1",
          position: 1,
        })
        .returning()
        .get();

      const quiz = testDb
        .insert(schema.quizzes)
        .values({
          lessonId: lesson.id,
          title: "Quiz 1",
          passingScore: 0.7,
        })
        .returning()
        .get();

      const q1 = testDb
        .insert(schema.quizQuestions)
        .values({
          quizId: quiz.id,
          questionText: "What is 1+1?",
          questionType: schema.QuestionType.MultipleChoice,
          position: 1,
        })
        .returning()
        .get();

      const q1Correct = testDb
        .insert(schema.quizOptions)
        .values({
          questionId: q1.id,
          optionText: "2",
          isCorrect: true,
        })
        .returning()
        .get();

      const q1Wrong = testDb
        .insert(schema.quizOptions)
        .values({
          questionId: q1.id,
          optionText: "3",
          isCorrect: false,
        })
        .returning()
        .get();

      const q2 = testDb
        .insert(schema.quizQuestions)
        .values({
          quizId: quiz.id,
          questionText: "What is 2+2?",
          questionType: schema.QuestionType.MultipleChoice,
          position: 2,
        })
        .returning()
        .get();

      const q2Correct = testDb
        .insert(schema.quizOptions)
        .values({
          questionId: q2.id,
          optionText: "4",
          isCorrect: true,
        })
        .returning()
        .get();

      const q2Wrong = testDb
        .insert(schema.quizOptions)
        .values({
          questionId: q2.id,
          optionText: "5",
          isCorrect: false,
        })
        .returning()
        .get();

      return {
        mod,
        lesson,
        quiz,
        q1,
        q1Correct,
        q1Wrong,
        q2,
        q2Correct,
        q2Wrong,
      };
    }

    it("returns empty data when course has no quizzes", () => {
      const result = getQuizAnalytics(base.course.id);

      expect(result.quizzes).toHaveLength(0);
      expect(result.passRate).toBe(0);
      expect(result.totalAttempts).toBe(0);
      expect(result.questionIncorrectRates).toHaveLength(0);
      expect(result.scoreDistribution).toHaveLength(10);
      expect(result.scoreDistribution.every((b) => b.count === 0)).toBe(true);
      expect(result.monthlyAttempts).toHaveLength(0);
      expect(result.averageScore).toBe(0);
    });

    it("returns quiz list for a course", () => {
      createQuizWithQuestions(testDb, base);

      const result = getQuizAnalytics(base.course.id);

      expect(result.quizzes).toHaveLength(1);
      expect(result.quizzes[0].quizTitle).toBe("Quiz 1");
    });

    it("returns zero rates when quiz has no attempts", () => {
      createQuizWithQuestions(testDb, base);

      const result = getQuizAnalytics(base.course.id);

      expect(result.passRate).toBe(0);
      expect(result.totalAttempts).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.questionIncorrectRates).toHaveLength(2);
      expect(result.questionIncorrectRates[0].totalAnswers).toBe(0);
      expect(result.questionIncorrectRates[0].incorrectRate).toBe(0);
    });

    it("calculates pass rate correctly", () => {
      const { quiz } = createQuizWithQuestions(testDb, base);

      testDb
        .insert(schema.quizAttempts)
        .values([
          {
            userId: base.user.id,
            quizId: quiz.id,
            score: 1.0,
            passed: true,
            attemptedAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            quizId: quiz.id,
            score: 0.5,
            passed: false,
            attemptedAt: "2025-06-16T10:00:00.000Z",
          },
        ])
        .run();

      const result = getQuizAnalytics(base.course.id);

      expect(result.passRate).toBe(50);
      expect(result.totalAttempts).toBe(2);
    });

    it("calculates 100% pass rate when all pass", () => {
      const { quiz } = createQuizWithQuestions(testDb, base);

      testDb
        .insert(schema.quizAttempts)
        .values({
          userId: base.user.id,
          quizId: quiz.id,
          score: 1.0,
          passed: true,
          attemptedAt: "2025-06-15T10:00:00.000Z",
        })
        .run();

      const result = getQuizAnalytics(base.course.id);

      expect(result.passRate).toBe(100);
    });

    it("calculates per-question incorrect rates", () => {
      const { quiz, q1, q1Correct, q1Wrong, q2, q2Correct } =
        createQuizWithQuestions(testDb, base);

      // Attempt 1: gets q1 wrong, q2 right
      const attempt1 = testDb
        .insert(schema.quizAttempts)
        .values({
          userId: base.user.id,
          quizId: quiz.id,
          score: 0.5,
          passed: false,
          attemptedAt: "2025-06-15T10:00:00.000Z",
        })
        .returning()
        .get();

      testDb
        .insert(schema.quizAnswers)
        .values([
          {
            attemptId: attempt1.id,
            questionId: q1.id,
            selectedOptionId: q1Wrong.id,
          },
          {
            attemptId: attempt1.id,
            questionId: q2.id,
            selectedOptionId: q2Correct.id,
          },
        ])
        .run();

      // Attempt 2: gets both right
      const attempt2 = testDb
        .insert(schema.quizAttempts)
        .values({
          userId: base.instructor.id,
          quizId: quiz.id,
          score: 1.0,
          passed: true,
          attemptedAt: "2025-06-16T10:00:00.000Z",
        })
        .returning()
        .get();

      testDb
        .insert(schema.quizAnswers)
        .values([
          {
            attemptId: attempt2.id,
            questionId: q1.id,
            selectedOptionId: q1Correct.id,
          },
          {
            attemptId: attempt2.id,
            questionId: q2.id,
            selectedOptionId: q2Correct.id,
          },
        ])
        .run();

      const result = getQuizAnalytics(base.course.id);

      expect(result.questionIncorrectRates).toHaveLength(2);
      // Q1: 1 incorrect out of 2 = 50%
      expect(result.questionIncorrectRates[0].incorrectRate).toBe(50);
      expect(result.questionIncorrectRates[0].totalAnswers).toBe(2);
      // Q2: 0 incorrect out of 2 = 0%
      expect(result.questionIncorrectRates[1].incorrectRate).toBe(0);
    });

    it("calculates score distribution buckets", () => {
      const { quiz } = createQuizWithQuestions(testDb, base);

      const user2 = testDb
        .insert(schema.users)
        .values({
          name: "User 2",
          email: "user2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      testDb
        .insert(schema.quizAttempts)
        .values([
          {
            userId: base.user.id,
            quizId: quiz.id,
            score: 0.95,
            passed: true,
            attemptedAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            quizId: quiz.id,
            score: 0.45,
            passed: false,
            attemptedAt: "2025-06-16T10:00:00.000Z",
          },
          {
            userId: user2.id,
            quizId: quiz.id,
            score: 1.0,
            passed: true,
            attemptedAt: "2025-06-17T10:00:00.000Z",
          },
        ])
        .run();

      const result = getQuizAnalytics(base.course.id);

      // score 0.95 -> bucket 9 (90-100%), score 0.45 -> bucket 4 (40-50%), score 1.0 -> bucket 9
      expect(result.scoreDistribution[4].count).toBe(1); // 40-50%
      expect(result.scoreDistribution[9].count).toBe(2); // 90-100%
    });

    it("calculates monthly attempt trends", () => {
      const { quiz } = createQuizWithQuestions(testDb, base);

      testDb
        .insert(schema.quizAttempts)
        .values([
          {
            userId: base.user.id,
            quizId: quiz.id,
            score: 0.8,
            passed: true,
            attemptedAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            quizId: quiz.id,
            score: 0.5,
            passed: false,
            attemptedAt: "2025-06-20T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            quizId: quiz.id,
            score: 0.9,
            passed: true,
            attemptedAt: "2025-07-10T10:00:00.000Z",
          },
        ])
        .run();

      const result = getQuizAnalytics(base.course.id);

      expect(result.monthlyAttempts).toHaveLength(2);
      expect(result.monthlyAttempts[0]).toEqual({
        month: "2025-06",
        attempts: 2,
      });
      expect(result.monthlyAttempts[1]).toEqual({
        month: "2025-07",
        attempts: 1,
      });
    });

    it("calculates average score correctly", () => {
      const { quiz } = createQuizWithQuestions(testDb, base);

      testDb
        .insert(schema.quizAttempts)
        .values([
          {
            userId: base.user.id,
            quizId: quiz.id,
            score: 0.8,
            passed: true,
            attemptedAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            quizId: quiz.id,
            score: 0.6,
            passed: false,
            attemptedAt: "2025-06-16T10:00:00.000Z",
          },
        ])
        .run();

      const result = getQuizAnalytics(base.course.id);

      // (0.8 + 0.6) / 2 = 0.7 -> 70%
      expect(result.averageScore).toBe(70);
    });

    it("filters by specific quizId when provided", () => {
      const { mod, lesson } = createQuizWithQuestions(testDb, base);

      const lesson2 = testDb
        .insert(schema.lessons)
        .values({
          moduleId: mod.id,
          title: "Lesson 2",
          position: 2,
        })
        .returning()
        .get();

      const quiz2 = testDb
        .insert(schema.quizzes)
        .values({
          lessonId: lesson2.id,
          title: "Quiz 2",
          passingScore: 0.7,
        })
        .returning()
        .get();

      testDb
        .insert(schema.quizAttempts)
        .values({
          userId: base.user.id,
          quizId: quiz2.id,
          score: 0.3,
          passed: false,
          attemptedAt: "2025-06-15T10:00:00.000Z",
        })
        .run();

      const result = getQuizAnalytics(base.course.id, quiz2.id);

      expect(result.quizzes).toHaveLength(2);
      expect(result.totalAttempts).toBe(1);
      expect(result.passRate).toBe(0);
      expect(result.averageScore).toBe(30);
    });
  });

  describe("getDropoffAnalytics", () => {
    function createCourseStructure(
      testDb: ReturnType<typeof createTestDb>,
      base: ReturnType<typeof seedBaseData>
    ) {
      const mod1 = testDb
        .insert(schema.modules)
        .values({
          courseId: base.course.id,
          title: "Module 1",
          position: 1,
        })
        .returning()
        .get();

      const lesson1 = testDb
        .insert(schema.lessons)
        .values({
          moduleId: mod1.id,
          title: "Lesson 1",
          position: 1,
        })
        .returning()
        .get();

      const lesson2 = testDb
        .insert(schema.lessons)
        .values({
          moduleId: mod1.id,
          title: "Lesson 2",
          position: 2,
        })
        .returning()
        .get();

      const mod2 = testDb
        .insert(schema.modules)
        .values({
          courseId: base.course.id,
          title: "Module 2",
          position: 2,
        })
        .returning()
        .get();

      const lesson3 = testDb
        .insert(schema.lessons)
        .values({
          moduleId: mod2.id,
          title: "Lesson 3",
          position: 1,
        })
        .returning()
        .get();

      return { mod1, mod2, lesson1, lesson2, lesson3 };
    }

    it("returns empty data when course has no lessons", () => {
      const result = getDropoffAnalytics(base.course.id);

      expect(result.totalEnrolled).toBe(0);
      expect(result.lessons).toHaveLength(0);
    });

    it("returns 0% completion when no enrollments exist", () => {
      createCourseStructure(testDb, base);

      const result = getDropoffAnalytics(base.course.id);

      expect(result.totalEnrolled).toBe(0);
      expect(result.lessons).toHaveLength(3);
      expect(result.lessons.every((l) => l.completedPercent === 0)).toBe(true);
    });

    it("returns lessons ordered by module position then lesson position", () => {
      createCourseStructure(testDb, base);

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      const result = getDropoffAnalytics(base.course.id);

      expect(result.lessons).toHaveLength(3);
      expect(result.lessons[0].lessonTitle).toBe("Lesson 1");
      expect(result.lessons[0].moduleTitle).toBe("Module 1");
      expect(result.lessons[0].position).toBe(1);
      expect(result.lessons[1].lessonTitle).toBe("Lesson 2");
      expect(result.lessons[1].position).toBe(2);
      expect(result.lessons[2].lessonTitle).toBe("Lesson 3");
      expect(result.lessons[2].moduleTitle).toBe("Module 2");
      expect(result.lessons[2].position).toBe(3);
    });

    it("calculates correct completion percentages", () => {
      const { lesson1, lesson2, lesson3 } = createCourseStructure(
        testDb,
        base
      );

      const user2 = testDb
        .insert(schema.users)
        .values({
          name: "User 2",
          email: "user2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      // 2 enrolled students
      testDb
        .insert(schema.enrollments)
        .values([
          { userId: base.user.id, courseId: base.course.id },
          { userId: user2.id, courseId: base.course.id },
        ])
        .run();

      // Both complete lesson 1
      testDb
        .insert(schema.lessonProgress)
        .values([
          {
            userId: base.user.id,
            lessonId: lesson1.id,
            status: schema.LessonProgressStatus.Completed,
            completedAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: user2.id,
            lessonId: lesson1.id,
            status: schema.LessonProgressStatus.Completed,
            completedAt: "2025-06-16T10:00:00.000Z",
          },
        ])
        .run();

      // Only user1 completes lesson 2
      testDb
        .insert(schema.lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: lesson2.id,
          status: schema.LessonProgressStatus.Completed,
          completedAt: "2025-06-17T10:00:00.000Z",
        })
        .run();

      // No one completes lesson 3

      const result = getDropoffAnalytics(base.course.id);

      expect(result.totalEnrolled).toBe(2);
      expect(result.lessons[0].completedCount).toBe(2);
      expect(result.lessons[0].completedPercent).toBe(100);
      expect(result.lessons[1].completedCount).toBe(1);
      expect(result.lessons[1].completedPercent).toBe(50);
      expect(result.lessons[2].completedCount).toBe(0);
      expect(result.lessons[2].completedPercent).toBe(0);
    });

    it("returns 100% when all students complete all lessons", () => {
      const { lesson1 } = createCourseStructure(testDb, base);

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();

      testDb
        .insert(schema.lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: lesson1.id,
          status: schema.LessonProgressStatus.Completed,
          completedAt: "2025-06-15T10:00:00.000Z",
        })
        .run();

      const result = getDropoffAnalytics(base.course.id);

      expect(result.lessons[0].completedPercent).toBe(100);
    });

    it("only counts enrolled users' progress", () => {
      const { lesson1 } = createCourseStructure(testDb, base);

      // Only user is enrolled
      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();

      // Instructor has progress but is not enrolled
      testDb
        .insert(schema.lessonProgress)
        .values([
          {
            userId: base.user.id,
            lessonId: lesson1.id,
            status: schema.LessonProgressStatus.Completed,
            completedAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.instructor.id,
            lessonId: lesson1.id,
            status: schema.LessonProgressStatus.Completed,
            completedAt: "2025-06-16T10:00:00.000Z",
          },
        ])
        .run();

      const result = getDropoffAnalytics(base.course.id);

      expect(result.totalEnrolled).toBe(1);
      expect(result.lessons[0].completedCount).toBe(1);
      expect(result.lessons[0].completedPercent).toBe(100);
    });

    it("does not count in_progress as completed", () => {
      const { lesson1 } = createCourseStructure(testDb, base);

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();

      testDb
        .insert(schema.lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: lesson1.id,
          status: schema.LessonProgressStatus.InProgress,
        })
        .run();

      const result = getDropoffAnalytics(base.course.id);

      expect(result.lessons[0].completedCount).toBe(0);
      expect(result.lessons[0].completedPercent).toBe(0);
    });

    it("does not include lessons from other courses", () => {
      createCourseStructure(testDb, base);

      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const otherMod = testDb
        .insert(schema.modules)
        .values({
          courseId: otherCourse.id,
          title: "Other Module",
          position: 1,
        })
        .returning()
        .get();

      testDb
        .insert(schema.lessons)
        .values({
          moduleId: otherMod.id,
          title: "Other Lesson",
          position: 1,
        })
        .run();

      const result = getDropoffAnalytics(base.course.id);

      expect(result.lessons).toHaveLength(3);
      expect(result.lessons.every((l) => l.moduleTitle !== "Other Module")).toBe(
        true
      );
    });
  });

  // ─── Platform-wide Analytics (Admin) ───

  describe("getPlatformRevenue", () => {
    it("returns 0 when there are no purchases", () => {
      expect(getPlatformRevenue("all")).toBe(0);
    });

    it("returns total revenue across all courses", () => {
      const instructor2 = testDb
        .insert(schema.users)
        .values({
          name: "Instructor 2",
          email: "inst2@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Course 2",
          slug: "course-2",
          description: "Second course",
          instructorId: instructor2.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 5000,
            createdAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: course2.id,
            pricePaid: 3000,
            createdAt: "2025-06-20T10:00:00.000Z",
          },
        ])
        .run();

      expect(getPlatformRevenue("all")).toBe(8000);
    });

    it("filters by time period", () => {
      const now = new Date();
      const recent = new Date(now);
      recent.setDate(recent.getDate() - 5);
      const old = new Date(now);
      old.setDate(old.getDate() - 60);

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            createdAt: recent.toISOString(),
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 3000,
            createdAt: old.toISOString(),
          },
        ])
        .run();

      expect(getPlatformRevenue("7d")).toBe(2000);
      expect(getPlatformRevenue("30d")).toBe(2000);
      expect(getPlatformRevenue("all")).toBe(5000);
    });
  });

  describe("getPlatformEnrollments", () => {
    it("returns 0 when there are no enrollments", () => {
      expect(getPlatformEnrollments("all")).toBe(0);
    });

    it("returns total enrollments across all courses", () => {
      const instructor2 = testDb
        .insert(schema.users)
        .values({
          name: "Instructor 2",
          email: "inst2@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Course 2",
          slug: "course-2",
          description: "Second course",
          instructorId: instructor2.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: course2.id,
            enrolledAt: "2025-06-20T10:00:00.000Z",
          },
        ])
        .run();

      expect(getPlatformEnrollments("all")).toBe(2);
    });

    it("filters by time period", () => {
      const now = new Date();
      const recent = new Date(now);
      recent.setDate(recent.getDate() - 3);
      const old = new Date(now);
      old.setDate(old.getDate() - 45);

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: recent.toISOString(),
          },
          {
            userId: base.instructor.id,
            courseId: base.course.id,
            enrolledAt: old.toISOString(),
          },
        ])
        .run();

      expect(getPlatformEnrollments("7d")).toBe(1);
      expect(getPlatformEnrollments("all")).toBe(2);
    });
  });

  describe("getTopEarningCourse", () => {
    it("returns null when there are no purchases", () => {
      expect(getTopEarningCourse("all")).toBeNull();
    });

    it("returns the course with the highest revenue", () => {
      const instructor2 = testDb
        .insert(schema.users)
        .values({
          name: "Instructor 2",
          email: "inst2@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Top Earner",
          slug: "top-earner",
          description: "Top course",
          instructorId: instructor2.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            createdAt: "2025-06-15T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: course2.id,
            pricePaid: 9000,
            createdAt: "2025-06-20T10:00:00.000Z",
          },
        ])
        .run();

      const result = getTopEarningCourse("all");
      expect(result).not.toBeNull();
      expect(result!.courseId).toBe(course2.id);
      expect(result!.courseTitle).toBe("Top Earner");
      expect(result!.revenue).toBe(9000);
    });

    it("respects time period filter", () => {
      const now = new Date();
      const recent = new Date(now);
      recent.setDate(recent.getDate() - 3);
      const old = new Date(now);
      old.setDate(old.getDate() - 60);

      const instructor2 = testDb
        .insert(schema.users)
        .values({
          name: "Instructor 2",
          email: "inst2@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Old Earner",
          slug: "old-earner",
          description: "Old course",
          instructorId: instructor2.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            createdAt: recent.toISOString(),
          },
          {
            userId: base.user.id,
            courseId: course2.id,
            pricePaid: 9000,
            createdAt: old.toISOString(),
          },
        ])
        .run();

      const recentResult = getTopEarningCourse("7d");
      expect(recentResult).not.toBeNull();
      expect(recentResult!.courseId).toBe(base.course.id);

      const allResult = getTopEarningCourse("all");
      expect(allResult).not.toBeNull();
      expect(allResult!.courseId).toBe(course2.id);
    });
  });
});
