import type {
  RevenueAnalytics,
  EnrollmentAnalytics,
  CompletionAnalytics,
  QuizAnalytics,
  DropoffAnalytics,
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

export function exportQuizCsv(data: QuizAnalytics): string {
  const lines = [
    `Pass Rate,${data.passRate}%`,
    `Total Attempts,${data.totalAttempts}`,
    `Average Score,${data.averageScore}%`,
    "",
    "Question,Total Answers,Incorrect Count,Incorrect Rate (%)",
  ];
  for (const q of data.questionIncorrectRates) {
    const text = q.questionText.includes(",")
      ? `"${q.questionText.replace(/"/g, '""')}"`
      : q.questionText;
    lines.push(`${text},${q.totalAnswers},${q.incorrectCount},${q.incorrectRate}`);
  }
  lines.push("");
  lines.push("Score Bucket,Count");
  for (const b of data.scoreDistribution) {
    lines.push(`${b.bucket},${b.count}`);
  }
  lines.push("");
  lines.push("Month,Attempts");
  for (const m of data.monthlyAttempts) {
    lines.push(`${m.month},${m.attempts}`);
  }
  return lines.join("\n");
}

export function exportDropoffCsv(data: DropoffAnalytics): string {
  const lines = [
    `Total Enrolled,${data.totalEnrolled}`,
    "",
    "Position,Module,Lesson,Completed Count,Completed %",
  ];
  for (const l of data.lessons) {
    const moduleTitle = l.moduleTitle.includes(",")
      ? `"${l.moduleTitle.replace(/"/g, '""')}"`
      : l.moduleTitle;
    const lessonTitle = l.lessonTitle.includes(",")
      ? `"${l.lessonTitle.replace(/"/g, '""')}"`
      : l.lessonTitle;
    lines.push(
      `${l.position},${moduleTitle},${lessonTitle},${l.completedCount},${l.completedPercent}`
    );
  }
  return lines.join("\n");
}
