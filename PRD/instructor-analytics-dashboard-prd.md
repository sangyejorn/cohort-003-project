# PRD: Instructor Analytics Dashboard

## Problem Statement

Instructors on the Cadence platform have no visibility into how their courses are performing. They cannot see revenue trends, understand enrollment patterns, measure completion rates, evaluate quiz effectiveness, or identify where students disengage. Without this data, instructors cannot make informed decisions about how to improve their courses or grow their revenue.

## Solution

Build a per-course analytics dashboard accessible to instructors at `instructor/:courseId/analytics`. The dashboard is a single page with five tabs — Revenue, Enrollment, Completion, Quizzes, and Drop-off — each showing monthly data with a date range picker. Instructors can export any tab's data as CSV and manually refresh the dashboard to see the latest numbers.

All analytics are computed server-side in the React Router loader using existing database tables (purchases, enrollments, lessonProgress, quizAttempts, quizAnswers). No new database tables or schema changes are required.

## User Stories

1. As an instructor, I want to see a monthly revenue chart for my course, so that I can understand how my income is trending over time.
2. As an instructor, I want to see cumulative total revenue for my course, so that I know my all-time earnings at a glance.
3. As an instructor, I want to filter revenue data by a custom date range, so that I can analyze specific time periods (e.g., after a promotion).
4. As an instructor, I want to see monthly new enrollment counts, so that I can understand how effectively my course is attracting students.
5. As an instructor, I want to see total enrolled students over time, so that I can track overall growth.
6. As an instructor, I want to see my course's completion rate (completed enrollments / total enrollments), so that I can gauge how engaging my course is end-to-end.
7. As an instructor, I want to see completions over time, so that I can spot trends in student success.
8. As an instructor, I want to see the pass/fail rate for each quiz in my course, so that I can identify quizzes that may be too hard or too easy.
9. As an instructor, I want to see which specific quiz questions students get wrong most often, so that I can improve confusing questions or revisit the lesson material.
10. As an instructor, I want to see a score distribution histogram for each quiz, so that I understand the spread of student performance.
11. As an instructor, I want to see quiz attempt trends over time, so that I can correlate quiz performance with course changes.
12. As an instructor, I want to see a lesson-level funnel showing what percentage of enrolled students completed each lesson in sequence, so that I can identify exactly where students drop off.
13. As an instructor, I want to export any analytics tab's data as a CSV file, so that I can analyze it in a spreadsheet or share it with others.
14. As an instructor, I want a manual refresh button on the dashboard, so that I can see the latest data without a full page reload.
15. As an instructor, I want the analytics dashboard to be a tab-based single page, so that I can quickly switch between different analytics views without navigating away.
16. As an instructor, I want the date range picker to default to a sensible range (e.g., last 12 months), so that I see useful data immediately without configuring anything.
17. As an instructor, I want to see summary stat cards (total revenue, total students, completion rate, average quiz score) at the top of each tab, so that I get key numbers at a glance before diving into charts.
18. As an instructor, I want the dashboard to only show data for courses I own, so that I cannot see other instructors' data.
19. As an instructor, I want the drop-off funnel to show lessons in their sequential module/lesson order, so that the funnel reflects the actual student journey.
20. As an instructor, I want clear axis labels, tooltips, and legends on all charts, so that the data is easy to interpret.

## Implementation Decisions

### Modules to Build

**1. Analytics Service (`analyticsService`)**
The core data aggregation layer. A single service with focused query functions:
- `getRevenueAnalytics(courseId, dateRange)` — Queries the `purchases` table. Returns monthly revenue totals (sum of `pricePaid` grouped by month) and cumulative revenue. All monetary values in cents.
- `getEnrollmentAnalytics(courseId, dateRange)` — Queries the `enrollments` table. Returns monthly new enrollment counts (grouped by `enrolledAt` month) and running total.
- `getCompletionAnalytics(courseId)` — Queries `enrollments` for completion rate (`completedAt IS NOT NULL / total`) and completions over time (grouped by `completedAt` month).
- `getQuizAnalytics(courseId)` — Queries `quizAttempts`, `quizAnswers`, `quizQuestions`, and `quizOptions`. Returns per-quiz pass rate, per-question incorrect rate, score distribution buckets (e.g., 0-10%, 10-20%, ..., 90-100%), and attempt counts over time.
- `getDropoffAnalytics(courseId)` — Queries `lessonProgress` joined with `lessons` and `modules`. For each lesson (ordered by module position then lesson position), calculates the percentage of enrolled students who completed it. Returns an ordered array of `{ lessonTitle, moduleTitle, position, completedCount, completedPercent }`.

Each function returns plain data objects — no chart-specific formatting. The service is the primary testing surface.

**2. CSV Export Service (`csvExportService`)**
Converts the data objects returned by the analytics service into CSV strings. One export function per analytics type. Called from the route's form action — the action returns a `Response` with `Content-Type: text/csv` and `Content-Disposition: attachment` headers.

**3. Analytics Route (`instructor.$courseId.analytics.tsx`)**
- **Loader**: Verifies the current user is an instructor and owns the course (403 otherwise). Reads the selected tab and date range from URL search params. Calls the appropriate analytics service function(s) and returns the data. On initial load, defaults to the Revenue tab with the last 12 months.
- **Action**: Handles CSV export. Reads which tab to export from the form data, calls the analytics service + CSV export service, and returns the CSV file as a download.
- **UI**: Renders the tab bar (using shadcn Tabs), date range picker, refresh button, and the active tab's chart component. Tab switches update URL search params without full navigation.
- **Refresh**: The manual refresh button triggers a `revalidator.revalidate()` call using React Router's `useRevalidator` hook.

**4. Chart Components (`app/components/analytics/`)**
Built with Recharts. Each component receives pre-computed data from the loader and renders the visualization:
- `RevenueChart` — `BarChart` or `LineChart` with monthly revenue on the y-axis, months on x-axis. Includes a cumulative line overlay.
- `EnrollmentChart` — `LineChart` showing new enrollments per month with a cumulative area fill.
- `CompletionRateCard` — A summary stat card (e.g., "68% completion rate") with a small trend `LineChart` showing completions over time.
- `QuizAnalyticsPanel` — A composite component: summary pass rate card, a `BarChart` for question-level incorrect rates, a `BarChart` histogram for score distribution, and a `LineChart` for attempt trends. Includes a quiz selector dropdown if the course has multiple quizzes.
- `DropoffFunnel` — A horizontal `BarChart` (or waterfall chart) showing lesson-by-lesson retention percentage, ordered by module/lesson position. Highlights the biggest drop-off points.

### Architectural Decisions

- **Recharts** as the charting library — widely used with React, SSR-compatible, easy to style.
- **Server-side computation** — All analytics are computed in the loader. No client-side API routes. This keeps the architecture simple and consistent with the rest of the codebase.
- **No new database tables** — All required data already exists in `purchases`, `enrollments`, `lessonProgress`, `quizAttempts`, `quizAnswers`, and related tables.
- **URL search params for state** — The active tab, date range, and selected quiz are stored in URL search params, making the dashboard state bookmarkable and shareable.
- **Instructor-only access** — No admin analytics view. Instructors can only see data for courses where they are the `instructorId`.

## Testing Decisions

A good test verifies external behavior (inputs → outputs) without coupling to implementation details like internal query structure or intermediate variables. Tests should be resilient to refactoring — if the behavior doesn't change, the tests shouldn't break.

### Modules to Test

**1. Analytics Service (unit tests)**
Test each analytics function by seeding the database with known data and asserting the returned data shape and values. Test edge cases: no data, single data point, data spanning multiple months, boundary date ranges. Follow the pattern established by existing service tests in the codebase (e.g., `commentService.test.ts`).

**2. Loader Functions (integration tests)**
Test the route loader to verify:
- Correct authorization (403 for non-instructors, 403 for instructors who don't own the course)
- Correct data shape returned for each tab
- Default date range behavior
- Search param parsing

**3. Chart Components (component tests)**
Test that each chart component renders without errors given valid data, renders empty/fallback states for no data, and passes accessibility basics (labels, ARIA). Use Vitest with React Testing Library.

## Out of Scope

- **Admin-level analytics** — No cross-instructor or platform-wide analytics view.
- **Real-time or auto-refresh** — No polling or websocket-based live updates.
- **Video-level engagement analytics** — No per-video watch heatmaps or in-video drop-off analysis (despite `videoWatchEvents` data existing).
- **Refund tracking** — No refund table or net revenue calculations.
- **PPP breakdown** — No segmentation of revenue by full-price vs. PPP-discounted purchases.
- **Cohort analysis** — No filtering by team purchases vs. individual, or enrollment cohort comparisons.
- **PDF export or shareable links** — Only CSV export is included.
- **Mobile-optimized charts** — Charts will be responsive but not specifically designed for small screens.

## Further Notes

- The `purchases` table stores `pricePaid` in cents. All revenue figures in the UI should be displayed in dollars (or appropriate currency) with proper formatting.
- The drop-off funnel assumes a linear course structure (modules and lessons have a `position` field). If an instructor reorders lessons after students have progressed, historical funnel data may look inconsistent — this is an accepted limitation.
- The date range picker should use month-level granularity (select start month and end month), not day-level, since all charts aggregate by month.
- Recharts needs to be added as a dependency (`pnpm add recharts`).
- The analytics route should be linked from the existing instructor course management page (`instructor.$courseId.tsx`) with an "Analytics" button or nav link.
