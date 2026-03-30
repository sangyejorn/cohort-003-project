import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
} from "recharts";
import type { MonthlyCompletion } from "~/services/analyticsService";

interface CompletionChartProps {
  data: MonthlyCompletion[];
}

export function CompletionChart({ data }: CompletionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No completion data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
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
            value: "Completions",
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
              name === "completions"
                ? "Completions"
                : "Cumulative Completions";
            return [value, label];
          }}
        />
        <Legend
          formatter={(value) =>
            value === "completions"
              ? "Completions"
              : "Cumulative Completions"
          }
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="completions"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cumulative"
          stroke="hsl(var(--chart-2, 160 60% 45%))"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
