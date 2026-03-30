import {
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import type { MonthlyEnrollment } from "~/services/analyticsService";

interface EnrollmentChartProps {
  data: MonthlyEnrollment[];
}

export function EnrollmentChart({ data }: EnrollmentChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No enrollment data for the selected period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
        />
        <YAxis
          yAxisId="left"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
          label={{
            value: "New Enrollments",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12 },
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
          label={{
            value: "Cumulative",
            angle: 90,
            position: "insideRight",
            style: { fontSize: 12 },
          }}
        />
        <Tooltip
          formatter={(value, name) => {
            const label =
              name === "count" ? "New Enrollments" : "Cumulative Enrollments";
            return [value, label];
          }}
        />
        <Legend
          formatter={(value) =>
            value === "count" ? "New Enrollments" : "Cumulative Enrollments"
          }
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="count"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="cumulative"
          fill="hsl(var(--chart-2, 160 60% 45%))"
          fillOpacity={0.15}
          stroke="hsl(var(--chart-2, 160 60% 45%))"
          strokeWidth={2}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
