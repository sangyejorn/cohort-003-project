import type {
  RevenueAnalytics,
  EnrollmentAnalytics,
  CompletionAnalytics,
} from "./analyticsService";

export function exportRevenueCsv(data: RevenueAnalytics): string {
  const lines = ["Month,Revenue ($),Cumulative Revenue ($)"];
  for (const row of data.monthlyRevenue) {
    lines.push(
      `${row.month},${(row.revenue / 100).toFixed(2)},${(row.cumulative / 100).toFixed(2)}`
    );
  }
  return lines.join("\n");
}

export function exportEnrollmentCsv(data: EnrollmentAnalytics): string {
  const lines = ["Month,New Enrollments,Cumulative Enrollments"];
  for (const row of data.monthlyEnrollments) {
    lines.push(`${row.month},${row.count},${row.cumulative}`);
  }
  return lines.join("\n");
}

export function exportCompletionCsv(data: CompletionAnalytics): string {
  const lines = [
    `Completion Rate,${data.completionRate}%`,
    `Total Completed,${data.totalCompleted}`,
    `Total Enrolled,${data.totalEnrolled}`,
    "",
    "Month,Completions,Cumulative Completions",
  ];
  for (const row of data.monthlyCompletions) {
    lines.push(`${row.month},${row.completions},${row.cumulative}`);
  }
  return lines.join("\n");
}
