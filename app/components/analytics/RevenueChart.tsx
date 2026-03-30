import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import type { MonthlyRevenue } from "~/services/analyticsService";

interface RevenueChartProps {
  data: MonthlyRevenue[];
}

function formatDollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No revenue data for the selected period.
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
          tickFormatter={formatDollars}
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
          label={{
            value: "Monthly ($)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12 },
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={formatDollars}
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
          label={{
            value: "Cumulative ($)",
            angle: 90,
            position: "insideRight",
            style: { fontSize: 12 },
          }}
        />
        <Tooltip
          formatter={(value, name) => {
            const cents = Number(value) || 0;
            const label = name === "revenue" ? "Monthly Revenue" : "Cumulative Revenue";
            return [`$${(cents / 100).toFixed(2)}`, label];
          }}
        />
        <Legend
          formatter={(value) =>
            value === "revenue" ? "Monthly Revenue" : "Cumulative Revenue"
          }
        />
        <Bar
          yAxisId="left"
          dataKey="revenue"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cumulative"
          stroke="hsl(var(--chart-2, 160 60% 45%))"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
