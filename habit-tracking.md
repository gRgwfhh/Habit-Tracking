# Habit Tracking Project Review

**Reviewed:** 2026-10-20

## Findings

### 🟡 WARNING — APIs have no access control

**Location:** [api/hobbies.php](./api/hobbies.php), [api/memorable_moments.php](./api/memorable_moments.php), [api/daily_scores.php](./api/daily_scores.php)  
**Confidence:** High

The APIs allow unauthenticated clients to read journal entries and hobby history, create or change records, and delete hobbies. This is acceptable for a private local XAMPP setup, but a publicly reachable installation would expose personal journal data and permit unauthorized changes. Require suitable authentication and authorization before public deployment. If cookie-based authentication is introduced, add request protections such as CSRF tokens and appropriate cookie settings.

## Suggestions for improvement

- **Return a client error for malformed journal dates.** In [api/memorable_moments.php](./api/memorable_moments.php), the `date` query parameter is passed to `DateTimeImmutable::createFromFormat` without first checking that it is a string. An array-shaped value such as `date[]=...` raises a `TypeError`, which the top-level handler turns into HTTP 500 instead of a validation response. Validate the parameter type and return HTTP 400 for invalid input.
- **Paginate full journal history.** The `all` period in [api/memorable_moments.php](./api/memorable_moments.php) returns every entry, and [dashboard.js](./dashboard.js) renders the full response. As the journal grows, this can increase query, transfer, and rendering time. Add pagination if the history is expected to grow substantially.
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
