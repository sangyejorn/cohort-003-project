# Plan: Instructor Analytics Dashboard

> Source PRD: `PRD/instructor-analytics-dashboard-prd.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Route**: `instructor.$courseId.analytics.tsx` — nested under the existing instructor layout. Linked from the instructor course management page.
- **Authorization**: Same pattern as existing instructor routes — verify user is logged in, has Instructor role, and owns the course (`course.instructorId === currentUserId`). Admins bypass ownership check.
- **Service layer**: New `analyticsService.ts` in `app/services/` following the existing pure-function pattern (no classes, direct Drizzle queries, returns plain data objects).
- **CSV export**: New `csvExportService.ts` in `app/services/`. Called from the route action, returns a `Response` with `Content-Type: text/csv` and `Content-Disposition: attachment` headers.
- **Schema**: No new tables. All queries use existing tables: `purchases`, `enrollments`, `lessonProgress`, `quizAttempts`, `quizAnswers`, `quizQuestions`, `quizOptions`, `lessons`, `modules`.
- **Charting**: Recharts (added via `pnpm add recharts`). Chart components live in `app/components/analytics/`.
- **State management**: Active tab, date range, and selected quiz stored in URL search params. Tab switches update search params without full navigation.
- **Date range**: Month-level granularity. Default range: last 12 months.
- **Money**: `purchases.pricePaid` is stored in cents. Display in dollars with proper formatting.
- **Testing**: Unit tests for analytics service functions using the existing in-memory SQLite test pattern (`createTestDb`, `seedBaseData`, `vi.mock("~/db")`). Integration tests for loader authorization. Component tests for chart rendering.

---

## Phase 1: Revenue Tab (end-to-end scaffold)

**User stories**: 1, 2, 3, 13, 14, 15, 16, 17, 18, 20

### What to build

The full analytics dashboard shell wired end-to-end with Revenue as the first tab. This phase establishes all shared infrastructure that later phases plug into.

An instructor navigates to their course's analytics page and sees a tabbed dashboard. The Revenue tab is selected by default, showing summary stat cards (total revenue, total students, completion rate, average quiz score — placeholder values for non-revenue cards), a date range picker defaulting to the last 12 months, a monthly revenue bar chart with a cumulative line overlay, a CSV export button that downloads revenue data, and a refresh button that revalidates without a full page reload.

The route loader verifies instructor ownership (403 otherwise), reads tab and date range from search params, and calls the revenue analytics service function. The route action handles CSV export by calling the CSV export service and returning a file download response.

### Acceptance criteria

- [ ] Analytics route exists and is accessible at `instructor/:courseId/analytics`
- [ ] Non-authenticated users get 401, non-instructors get 403, instructors who don't own the course get 403
- [ ] Tab bar renders with all five tabs (Revenue, Enrollment, Completion, Quizzes, Drop-off); only Revenue is functional
- [ ] Date range picker allows selecting start and end months, defaults to last 12 months
- [ ] Revenue chart displays monthly revenue as bars with a cumulative revenue line overlay
- [ ] Summary stat cards show total revenue (from real data) and placeholder values for other metrics
- [ ] CSV export downloads a `.csv` file with monthly revenue data
- [ ] Refresh button triggers `revalidator.revalidate()` to reload data without full page navigation
- [ ] Charts have clear axis labels, tooltips, and legends
- [ ] Revenue values display in dollars (converted from cents)
- [ ] Analytics service unit tests cover: no purchases, single month, multiple months, date range filtering, cumulative calculation
- [ ] Loader integration tests cover authorization scenarios
- [ ] Recharts is added as a project dependency
- [ ] Analytics page is linked from the instructor course management page

---

## Phase 2: Enrollment and Completion Tabs

**User stories**: 4, 5, 6, 7

### What to build

Add enrollment and completion analytics, plugging into the existing tab/export/date-range infrastructure from Phase 1.

The Enrollment tab shows monthly new enrollment counts as a line chart with a cumulative area fill, plus a summary card with total enrolled students. The date range picker filters enrollment data by `enrolledAt`.

The Completion tab shows the overall completion rate as a summary card (completed enrollments / total enrollments) and a line chart of completions over time (grouped by `completedAt` month). The completion rate card displays prominently (e.g., "68% completion rate").

Both tabs support CSV export using the same action pattern established in Phase 1. Summary stat cards at the top of the dashboard now show real values for total students and completion rate.

### Acceptance criteria

- [ ] Enrollment tab displays monthly new enrollment counts as a line chart with cumulative area fill
- [ ] Enrollment summary card shows total enrolled students
- [ ] Enrollment date range filtering works correctly
- [ ] Completion tab displays overall completion rate as a prominent summary card
- [ ] Completion tab shows completions over time as a line chart
- [ ] Dashboard summary cards show real values for total students and completion rate
- [ ] CSV export works for both Enrollment and Completion tabs
- [ ] Analytics service unit tests cover enrollment and completion edge cases (no enrollments, no completions, partial completions)
- [ ] Chart components render correctly with valid data and show empty/fallback states for no data

---

## Phase 3: Quiz and Drop-off Tabs

**User stories**: 8, 9, 10, 11, 12, 19

### What to build

Add quiz analytics and the lesson drop-off funnel, completing the dashboard.

The Quizzes tab is a composite view: a summary pass rate card, a bar chart showing per-question incorrect rates (which questions students get wrong most often), a histogram showing score distribution across buckets (0-10%, 10-20%, ..., 90-100%), and a line chart showing attempt counts over time. If the course has multiple quizzes, a dropdown selector lets the instructor switch between them. The quiz selector is stored in URL search params.

The Drop-off tab shows a lesson-level funnel as a horizontal bar chart. Each bar represents a lesson (ordered by module position, then lesson position), showing the percentage of enrolled students who completed it. The biggest drop-off points are visually highlighted. Lesson labels include the module title for context.

Both tabs support CSV export. The dashboard summary card for average quiz score now shows real data.

### Acceptance criteria

- [ ] Quiz tab displays per-quiz pass/fail rate as a summary card
- [ ] Quiz tab shows per-question incorrect rate as a bar chart
- [ ] Quiz tab shows score distribution as a histogram with 10 buckets
- [ ] Quiz tab shows attempt trends over time as a line chart
- [ ] Quiz selector dropdown appears when course has multiple quizzes and updates via search params
- [ ] Drop-off tab shows lesson-by-lesson completion percentage as a horizontal bar chart
- [ ] Lessons are ordered by module position then lesson position
- [ ] Biggest drop-off points are visually highlighted
- [ ] Lesson labels include module title for context
- [ ] Dashboard summary card shows real average quiz score
- [ ] CSV export works for both Quizzes and Drop-off tabs
- [ ] Analytics service unit tests cover quiz edge cases (no attempts, perfect scores, no quizzes) and drop-off edge cases (no progress, all lessons completed, single lesson)
- [ ] Chart components render correctly with valid data and show empty/fallback states for no data
