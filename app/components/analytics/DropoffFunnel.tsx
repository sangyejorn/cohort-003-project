import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Cell,
} from "recharts";
import type { DropoffAnalytics } from "~/services/analyticsService";

interface DropoffFunnelProps {
  data: DropoffAnalytics;
}

export function DropoffFunnel({ data }: DropoffFunnelProps) {
  if (data.lessons.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No lesson data available for this course.
      </div>
    );
  }

  // Find biggest drop-off points (drops > 10pp from previous lesson)
  const bigDropoffs = new Set<number>();
  for (let i = 1; i < data.lessons.length; i++) {
    const drop =
      data.lessons[i - 1].completedPercent - data.lessons[i].completedPercent;
    if (drop > 10) {
      bigDropoffs.add(i);
    }
  }

  const chartData = data.lessons.map((l) => ({
    name: `${l.moduleTitle}: ${l.lessonTitle}`,
    completedPercent: l.completedPercent,
    completedCount: l.completedCount,
  }));

  const chartHeight = Math.max(300, data.lessons.length * 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
          label={{
            value: "Completion %",
            position: "insideBottom",
            offset: -5,
            style: { fontSize: 12 },
          }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={200}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
        />
        <Tooltip
          formatter={(value, _name, props) => [
            `${value}% (${props.payload.completedCount} students)`,
            "Completed",
          ]}
        />
        <Bar dataKey="completedPercent" radius={[0, 4, 4, 0]}>
          {chartData.map((_, index) => (
            <Cell
              key={index}
              fill={
                bigDropoffs.has(index)
                  ? "hsl(var(--destructive, 0 84% 60%))"
                  : "hsl(var(--primary))"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
