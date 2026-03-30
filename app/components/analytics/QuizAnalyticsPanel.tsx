import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  LineChart,
} from "recharts";
import type { QuizAnalytics } from "~/services/analyticsService";
import { StatCard } from "./StatCard";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Award, Target, TrendingUp } from "lucide-react";

interface QuizAnalyticsPanelProps {
  data: QuizAnalytics;
  selectedQuizId: number | null;
  onQuizChange: (quizId: string) => void;
}

export function QuizAnalyticsPanel({
  data,
  selectedQuizId,
  onQuizChange,
}: QuizAnalyticsPanelProps) {
  if (data.quizzes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No quizzes found for this course.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quiz selector */}
      {data.quizzes.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="quiz-select" className="text-sm text-muted-foreground">
            Quiz
          </label>
          <select
            id="quiz-select"
            value={selectedQuizId ?? data.quizzes[0].quizId}
            onChange={(e) => onQuizChange(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            {data.quizzes.map((q) => (
              <option key={q.quizId} value={q.quizId}>
                {q.quizTitle}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Pass Rate"
          value={`${data.passRate}%`}
          icon={<Award className="size-5" />}
        />
        <StatCard
          label="Total Attempts"
          value={String(data.totalAttempts)}
          icon={<Target className="size-5" />}
        />
        <StatCard
          label="Average Score"
          value={`${data.averageScore}%`}
          icon={<TrendingUp className="size-5" />}
        />
      </div>

      {/* Question incorrect rates */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Question Incorrect Rates</h3>
          <p className="text-sm text-muted-foreground">
            Percentage of answers that were incorrect for each question
          </p>
        </CardHeader>
        <CardContent>
          {data.questionIncorrectRates.length === 0 ||
          data.questionIncorrectRates.every((q) => q.totalAnswers === 0) ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              No answer data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.questionIncorrectRates.map((q, i) => ({
                  name: `Q${i + 1}`,
                  incorrectRate: q.incorrectRate,
                  questionText: q.questionText,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  label={{
                    value: "Incorrect %",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12 },
                  }}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Incorrect Rate"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.questionText ?? ""
                  }
                />
                <Bar
                  dataKey="incorrectRate"
                  fill="hsl(var(--destructive, 0 84% 60%))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Score distribution histogram */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Score Distribution</h3>
          <p className="text-sm text-muted-foreground">
            Distribution of quiz scores across percentage buckets
          </p>
        </CardHeader>
        <CardContent>
          {data.scoreDistribution.every((b) => b.count === 0) ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              No score data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  label={{
                    value: "Attempts",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12 },
                  }}
                />
                <Tooltip formatter={(value) => [value, "Attempts"]} />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Attempt trends over time */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Attempt Trends</h3>
          <p className="text-sm text-muted-foreground">
            Quiz attempts per month over time
          </p>
        </CardHeader>
        <CardContent>
          {data.monthlyAttempts.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              No attempt data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyAttempts}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  label={{
                    value: "Attempts",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12 },
                  }}
                />
                <Tooltip formatter={(value) => [value, "Attempts"]} />
                <Legend formatter={() => "Attempts"} />
                <Line
                  type="monotone"
                  dataKey="attempts"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
