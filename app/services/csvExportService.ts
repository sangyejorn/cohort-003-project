import type { RevenueAnalytics } from "./analyticsService";

export function exportRevenueCsv(data: RevenueAnalytics): string {
  const lines = ["Month,Revenue ($),Cumulative Revenue ($)"];
  for (const row of data.monthlyRevenue) {
    lines.push(
      `${row.month},${(row.revenue / 100).toFixed(2)},${(row.cumulative / 100).toFixed(2)}`
    );
  }
  return lines.join("\n");
}
