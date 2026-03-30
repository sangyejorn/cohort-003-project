import { useState } from "react";
import { Link, useSearchParams, useRevalidator, Form } from "react-router";
import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/instructor.$courseId.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { getCourseById } from "~/services/courseService";
import {
  getRevenueAnalytics,
  getEnrollmentAnalytics,
  getCompletionAnalytics,
  getQuizAnalytics,
  getDropoffAnalytics,
} from "~/services/analyticsService";
import {
  exportRevenueCsv,
  exportEnrollmentCsv,
  exportCompletionCsv,
  exportQuizCsv,
  exportDropoffCsv,
} from "~/services/csvExportService";
import { UserRole } from "~/db/schema";
import { formatPrice } from "~/lib/utils";
import { RevenueChart } from "~/components/analytics/RevenueChart";
import { EnrollmentChart } from "~/components/analytics/EnrollmentChart";
import { CompletionChart } from "~/components/analytics/CompletionChart";
import { QuizAnalyticsPanel } from "~/components/analytics/QuizAnalyticsPanel";
import { DropoffFunnel } from "~/components/analytics/DropoffFunnel";
import { StatCard } from "~/components/analytics/StatCard";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  ArrowLeft,
  DollarSign,
  Users,
  Award,
  Brain,
  Download,
  RefreshCw,
  BarChart3,
  TrendingUp,
  CheckCircle,
  HelpCircle,
  GitFork,
} from "lucide-react";
import { parseParams } from "~/lib/validation";

const paramsSchema = z.object({
  courseId: z.coerce.number().int(),
});

const TABS = ["revenue", "enrollment", "completion", "quizzes", "drop-off"] as const;
type TabValue = (typeof TABS)[number];

function getDefaultDateRange() {
  const now = new Date();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
  return { start, end };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Analytics";
  return [
    { title: `Analytics: ${title} — Cadence` },
    { name: "description", content: `Analytics for ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (
    !user ||
    (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)
  ) {
    throw data("Only instructors and admins can access this page.", {
      status: 403,
    });
  }

  const { courseId } = parseParams(params, paramsSchema);
  const course = getCourseById(courseId);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId && user.role !== UserRole.Admin) {
    throw data("You can only view analytics for your own courses.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") as TabValue) || "revenue";
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");

  const defaults = getDefaultDateRange();
  const dateRange = {
    start: startParam || defaults.start,
    end: endParam || defaults.end,
  };

  const revenueData = getRevenueAnalytics(courseId, dateRange);
  const enrollmentData = getEnrollmentAnalytics(courseId, dateRange);
  const completionData = getCompletionAnalytics(courseId);

  const quizIdParam = url.searchParams.get("quizId");
  const selectedQuizId = quizIdParam ? Number(quizIdParam) : undefined;
  const quizData = getQuizAnalytics(courseId, selectedQuizId);
  const dropoffData = getDropoffAnalytics(courseId);

  return {
    course,
    tab,
    dateRange,
    revenueData,
    enrollmentData,
    completionData,
    quizData,
    dropoffData,
    selectedQuizId: selectedQuizId ?? null,
    averageQuizScore: quizData.averageScore,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("You must be logged in.", { status: 401 });
  }

  const user = getUserById(currentUserId);
  if (
    !user ||
    (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)
  ) {
    throw data("Only instructors and admins can export data.", { status: 403 });
  }

  const { courseId } = parseParams(params, paramsSchema);
  const course = getCourseById(courseId);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId && user.role !== UserRole.Admin) {
    throw data("You can only export your own course data.", { status: 403 });
  }

  const formData = await request.formData();
  const exportTab = formData.get("exportTab") as string;
  const start = formData.get("start") as string;
  const end = formData.get("end") as string;

  const dateRange = start && end ? { start, end } : undefined;

  if (exportTab === "revenue") {
    const revenueData = getRevenueAnalytics(courseId, dateRange);
    const csv = exportRevenueCsv(revenueData);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="revenue-${courseId}.csv"`,
      },
    });
  }

  if (exportTab === "enrollment") {
    const enrollmentData = getEnrollmentAnalytics(courseId, dateRange);
    const csv = exportEnrollmentCsv(enrollmentData);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="enrollment-${courseId}.csv"`,
      },
    });
  }

  if (exportTab === "completion") {
    const completionData = getCompletionAnalytics(courseId);
    const csv = exportCompletionCsv(completionData);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="completion-${courseId}.csv"`,
      },
    });
  }

  if (exportTab === "quizzes") {
    const quizIdStr = formData.get("quizId") as string;
    const quizIdNum = quizIdStr ? Number(quizIdStr) : undefined;
    const quizData = getQuizAnalytics(courseId, quizIdNum);
    const csv = exportQuizCsv(quizData);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="quiz-${courseId}.csv"`,
      },
    });
  }

  if (exportTab === "drop-off") {
    const dropoffData = getDropoffAnalytics(courseId);
    const csv = exportDropoffCsv(dropoffData);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="dropoff-${courseId}.csv"`,
      },
    });
  }

  throw data("Export not available for this tab.", { status: 400 });
}

export default function AnalyticsDashboard({
  loaderData,
}: Route.ComponentProps) {
  const {
    course,
    tab,
    dateRange,
    revenueData,
    enrollmentData,
    completionData,
    quizData,
    dropoffData,
    selectedQuizId,
    averageQuizScore,
  } = loaderData;

  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();

  const activeTab = (searchParams.get("tab") as TabValue) || tab;
  const startMonth = searchParams.get("start") || dateRange.start;
  const endMonth = searchParams.get("end") || dateRange.end;

  function handleTabChange(value: string) {
    setSearchParams((prev) => {
      prev.set("tab", value);
      return prev;
    });
  }

  function handleDateChange(field: "start" | "end", value: string) {
    setSearchParams((prev) => {
      prev.set(field, value);
      return prev;
    });
  }

  function handleQuizChange(quizId: string) {
    setSearchParams((prev) => {
      prev.set("quizId", quizId);
      return prev;
    });
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/instructor/${course.id}`}
          className="hover:text-foreground"
        >
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <Link
        to={`/instructor/${course.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to Course Editor
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{course.title} — Analytics</h1>
      </div>

      {/* Summary Stat Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatPrice(revenueData.totalRevenue)}
          icon={<DollarSign className="size-5" />}
        />
        <StatCard
          label="Total Students"
          value={String(enrollmentData.totalEnrollments)}
          icon={<Users className="size-5" />}
        />
        <StatCard
          label="Completion Rate"
          value={`${completionData.completionRate}%`}
          icon={<Award className="size-5" />}
        />
        <StatCard
          label="Avg Quiz Score"
          value={averageQuizScore !== null ? `${averageQuizScore}%` : "—"}
          icon={<Brain className="size-5" />}
        />
      </div>

      {/* Controls Row */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="start-month" className="text-muted-foreground">
            From
          </label>
          <input
            id="start-month"
            type="month"
            value={startMonth}
            onChange={(e) => handleDateChange("start", e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          />
          <label htmlFor="end-month" className="text-muted-foreground">
            To
          </label>
          <input
            id="end-month"
            type="month"
            value={endMonth}
            onChange={(e) => handleDateChange("end", e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Form method="post">
            <input type="hidden" name="exportTab" value={activeTab} />
            <input type="hidden" name="start" value={startMonth} />
            <input type="hidden" name="end" value={endMonth} />
            {selectedQuizId && (
              <input type="hidden" name="quizId" value={selectedQuizId} />
            )}
            <Button type="submit" variant="outline" size="sm">
              <Download className="mr-1.5 size-4" />
              Export CSV
            </Button>
          </Form>

          <Button
            variant="outline"
            size="sm"
            onClick={() => revalidator.revalidate()}
            disabled={revalidator.state === "loading"}
          >
            <RefreshCw
              className={`mr-1.5 size-4 ${revalidator.state === "loading" ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="revenue">
            <DollarSign className="size-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="enrollment">
            <TrendingUp className="size-4" />
            Enrollment
          </TabsTrigger>
          <TabsTrigger value="completion">
            <CheckCircle className="size-4" />
            Completion
          </TabsTrigger>
          <TabsTrigger value="quizzes">
            <HelpCircle className="size-4" />
            Quizzes
          </TabsTrigger>
          <TabsTrigger value="drop-off">
            <GitFork className="size-4" />
            Drop-off
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Monthly Revenue</h2>
              <p className="text-sm text-muted-foreground">
                Revenue per month with cumulative total overlay
              </p>
            </CardHeader>
            <CardContent>
              <RevenueChart data={revenueData.monthlyRevenue} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollment" className="mt-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Monthly Enrollments</h2>
              <p className="text-sm text-muted-foreground">
                New enrollments per month with cumulative total
              </p>
            </CardHeader>
            <CardContent>
              <EnrollmentChart data={enrollmentData.monthlyEnrollments} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completion" className="mt-6">
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Completion Rate"
              value={`${completionData.completionRate}%`}
              icon={<Award className="size-5" />}
            />
            <StatCard
              label="Total Completed"
              value={String(completionData.totalCompleted)}
              icon={<CheckCircle className="size-5" />}
            />
            <StatCard
              label="Total Enrolled"
              value={String(completionData.totalEnrolled)}
              icon={<Users className="size-5" />}
            />
          </div>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Completions Over Time</h2>
              <p className="text-sm text-muted-foreground">
                Monthly course completions with cumulative total
              </p>
            </CardHeader>
            <CardContent>
              <CompletionChart data={completionData.monthlyCompletions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quizzes" className="mt-6">
          <QuizAnalyticsPanel
            data={quizData}
            selectedQuizId={selectedQuizId}
            onQuizChange={handleQuizChange}
          />
        </TabsContent>

        <TabsContent value="drop-off" className="mt-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Lesson Drop-off Funnel</h2>
              <p className="text-sm text-muted-foreground">
                Percentage of enrolled students who completed each lesson
              </p>
            </CardHeader>
            <CardContent>
              <DropoffFunnel data={dropoffData} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
