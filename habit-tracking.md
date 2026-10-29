# Habit Tracking Project Review

**Reviewed:** 2026-10-20

## Findings

### 🟡 WARNING — APIs have no access control

**Location:** [api/hobbies.php](./api/hobbies.php), [api/memorable_moments.php](./api/memorable_moments.php), [api/daily_scores.php](./api/daily_scores.php)  
**Confidence:** High

The APIs allow unauthenticated clients to read journal entries and hobby history, create or change records, and delete hobbies. This is acceptable for a private local XAMPP setup, but a publicly reachable installation would expose personal journal data and permit unauthorized changes. Require suitable authentication and authorization before public deployment. If cookie-based authentication is introduced, add request protections such as CSRF tokens and appropriate cookie settings.

## Suggestions for improvement

- **Return a client error for malformed journal dates.** In [api/memorable_moments.php](./api/memorable_moments.php), the `date` query parameter is passed to `DateTimeImmutable::createFromFormat` without first checking that it is a string. An array-shaped value such as `date[]=...` raises a `TypeError`, which the top-level handler turns into HTTP 500 instead of a validation response. Validate the parameter type and return HTTP 400 for invalid input.
- **Paginate full journal history (implemented).** The `all` period in [api/memorable_moments.php](./api/memorable_moments.php) previously returned every entry, and [dashboard.js](./dashboard.js) rendered the full response. As the journal grows, this can increase query, transfer, and rendering time. Pagination has been added:

  - **API (`api/memorable_moments.php`):** The `period=all` path now accepts optional `page` (default `1`) and `pageSize` (default `25`, capped at `100`) query parameters. Both are validated as positive integers via `FILTER_VALIDATE_INT`; invalid values return HTTP 400. A `SELECT COUNT(*)` query determines the total, and the entries query appends `LIMIT :offset, :pageSize` while preserving the existing `ORDER BY moment_date DESC, time_created DESC, momentID DESC`. The response body remains the entries array (no structural change). Pagination metadata is communicated via response headers: `X-Total-Count`, `X-Page`, `X-Page-Size`, `X-Total-Pages`.
  - **Frontend (`dashboard.js`):** `loadJournal()` resets `journalPage` to 1 and sends `page`/`pageSize` when `period === 'all'`. It reads the pagination headers and updates `journalTotalEntries` / `journalTotalPages`. A new `loadMoreJournal()` appends the next page of entries to the existing list. A `journalRequestId` guard ignores stale responses when the period or date changes mid-flight. `updateJournalPaginationUI()` hides the "Load more" button when the period is not `all`, when on the last page, or when there are no entries.
  - **Frontend (`dashboard.html`):** A "Load more entries" button (`id="journalLoadMore"`) appears in the journal history section when more pages remain; it is hidden otherwise.
- **Add automated regression coverage for date-driven sleep behavior.** The sleep date accepts MySQL-supported dates, loads the selected month, and redraws the graph for that month. Tests for leap February, months with 30 and 31 days, switching months while a request is in flight, and the 1000/9999 year boundaries would help protect this behavior.

## Strengths

- API writes use PDO prepared statements, and read queries with user-provided dates use bound parameters.
- Hobby check updates lock the hobby row in a transaction and record no more than one history check per hobby per calendar day.
- User-provided hobby and journal content is inserted into the DOM with `textContent`, avoiding HTML interpretation.
- The daily summary loads hobbies, journal entries, and sleep independently, so a failure in one source does not suppress the other sections.
- Sleep records can be saved for any MySQL-supported date; the selected month controls the chart, and the date picker loads saved times for editing.
- Database and API validation reject invalid hobby names, journal entries, dates, and equal sleep/wake times.

## Scope reviewed

Reviewed project guidance, dashboard and hobbies pages, their JavaScript and shared CSS, all three PHP APIs, and `database.sql`. No application source files were changed.

**Validation:** Static review only. Runtime tests were not run as part of this review.
