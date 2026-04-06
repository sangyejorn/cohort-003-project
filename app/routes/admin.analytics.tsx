import { Link, useSearchParams } from "react-router";
import { data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/admin.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import {
  getPlatformRevenue,
  getPlatformEnrollments,
  getTopEarningCourse,
  type TimePeriod,
} from "~/services/analyticsService";
import { UserRole } from "~/db/schema";
import { formatPrice } from "~/lib/utils";
import { StatCard } from "~/components/analytics/StatCard";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
  AlertTriangle,
  BarChart3,
  DollarSign,
  Trophy,
  Users,
} from "lucide-react";

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "12m", label: "12 Months" },
  { value: "all", label: "All Time" },
];

function isValidPeriod(value: string | null): value is TimePeriod {
  return value === "7d" || value === "30d" || value === "12m" || value === "all";
}

export function meta() {
  return [
    { title: "Admin Analytics — Cadence" },
    { name: "description", content: "Platform-wide analytics dashboard" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period: TimePeriod = isValidPeriod(periodParam) ? periodParam : "30d";

  const totalRevenue = getPlatformRevenue(period);
  const totalEnrollments = getPlatformEnrollments(period);
  const topCourse = getTopEarningCourse(period);

  return { period, totalRevenue, totalEnrollments, topCourse };
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-5 w-72" />
      </div>
      <Skeleton className="mb-8 h-10 w-80" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const { period, totalRevenue, totalEnrollments, topCourse } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  function handlePeriodChange(newPeriod: TimePeriod) {
    const params = new URLSearchParams(searchParams);
    params.set("period", newPeriod);
    setSearchParams(params);
  }

  const hasData = totalRevenue > 0 || totalEnrollments > 0;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Admin Analytics</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Revenue and enrollment metrics across all courses
        </p>
      </div>

      {/* Time period tabs */}
      <div className="mb-8 flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {TIME_PERIODS.map((tp) => (
          <button
            key={tp.value}
            onClick={() => handlePeriodChange(tp.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              period === tp.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tp.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="mb-4 size-12 text-muted-foreground/50" />
            <h2 className="text-lg font-medium">No data yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Revenue and enrollment data will appear here once students start
              purchasing and enrolling in courses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Revenue"
            value={formatPrice(totalRevenue)}
            icon={<DollarSign className="size-5" />}
          />
          <StatCard
            label="Total Enrollments"
            value={totalEnrollments.toLocaleString()}
            icon={<Users className="size-5" />}
          />
          <StatCard
            label="Top Earning Course"
            value={
              topCourse
                ? `${topCourse.courseTitle} (${formatPrice(topCourse.revenue)})`
                : "—"
            }
            icon={<Trophy className="size-5" />}
          />
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "Only admins can access this page.";
    } else {
      title = `Error ${error.status}`;
      message =
        typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
