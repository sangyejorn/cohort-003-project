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
  getTotalEnrollmentCount,
  getCompletionRate,
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
});
