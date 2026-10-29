<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_THROW_ON_ERROR);
    exit;
}

function readJsonBody(): array
{
    try {
        $body = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        respond(400, ['error' => 'Request body must contain valid JSON.']);
    }

    if (!is_array($body)) {
        respond(400, ['error' => 'Request body must be a JSON object.']);
    }

    return $body;
}

try {
    $host = getenv('HABIT_DB_HOST');
    $database = getenv('HABIT_DB_NAME');
    $username = getenv('HABIT_DB_USER');
    $password = getenv('HABIT_DB_PASSWORD');
    $host = $host === false || $host === '' ? '127.0.0.1' : $host;
    $database = $database === false || $database === '' ? 'habit_tracking' : $database;
    $username = $username === false || $username === '' ? 'root' : $username;
    $password = $password === false ? '' : $password;

    $pdo = new PDO(
        "mysql:host={$host};dbname={$database};charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            $period = $_GET['period'] ?? 'all';
            $dateValue = $_GET['date'] ?? date('Y-m-d');
            $startDate = null;
            $endDate = null;

            if (!in_array($period, ['day', 'week', 'month', 'year', 'all'], true)) {
                respond(400, ['error' => 'Period must be day, week, month, year, or all.']);
            }

            if ($period !== 'all') {
                $date = DateTimeImmutable::createFromFormat('!Y-m-d', $dateValue);
                $dateErrors = DateTimeImmutable::getLastErrors();

                if (
                    $date === false
                    || ($dateErrors !== false && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0))
                    || $date->format('Y-m-d') !== $dateValue
                ) {
                    respond(400, ['error' => 'A valid reference date in YYYY-MM-DD format is required.']);
                }

                $startDate = match ($period) {
                    'day' => $date,
                    'week' => $date->modify('monday this week'),
                    'month' => $date->modify('first day of this month'),
                    'year' => $date->setDate((int) $date->format('Y'), 1, 1),
                    default => null,
                };
                $endDate = match ($period) {
                    'day' => $startDate->modify('+1 day'),
                    'week' => $startDate->modify('+1 week'),
                    'month' => $startDate->modify('+1 month'),
                    'year' => $startDate->modify('+1 year'),
                    default => null,
                };
            }

            if ($period === 'all') {
                $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
                if ($page === false) {
                    respond(400, ['error' => 'Page must be a positive integer.']);
                }

                $pageSize = filter_var($_GET['pageSize'] ?? 25, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
                if ($pageSize === false) {
                    respond(400, ['error' => 'Page size must be a positive integer.']);
                }

                $pageSize = min($pageSize, 100);
                $offset = ($page - 1) * $pageSize;

                $countStatement = $pdo->query('SELECT COUNT(*) FROM memorable_moments');
                $totalEntries = (int) $countStatement->fetchColumn();
                $totalPages = (int) ceil($totalEntries / $pageSize);

                $statement = $pdo->prepare(
                    'SELECT momentID, memorable_moment AS moment,
                            DATE_FORMAT(moment_date, \'%Y-%m-%d\') AS momentDate
                     FROM memorable_moments
                     ORDER BY moment_date DESC, time_created DESC, momentID DESC
                     LIMIT :offset, :pageSize'
                );
                $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
                $statement->bindValue(':pageSize', $pageSize, PDO::PARAM_INT);
                $statement->execute();

                header('X-Total-Count: ' . $totalEntries);
                header('X-Page: ' . $page);
                header('X-Page-Size: ' . $pageSize);
                header('X-Total-Pages: ' . $totalPages);
            } else {
                $statement = $pdo->prepare(
                    'SELECT momentID, memorable_moment AS moment,
                            DATE_FORMAT(moment_date, \'%Y-%m-%d\') AS momentDate
                     FROM memorable_moments
                     WHERE moment_date >= :startDate AND moment_date < :endDate
                     ORDER BY moment_date DESC, time_created DESC, momentID DESC'
                );
                $statement->execute([
                    'startDate' => $startDate->format('Y-m-d'),
                    'endDate' => $endDate->format('Y-m-d'),
                ]);
            }
            respond(200, $statement->fetchAll());

        case 'POST':
            $body = readJsonBody();

            if (!is_string($body['moment'] ?? null)) {
                respond(400, ['error' => 'A non-empty journal entry is required.']);
            }

            $moment = trim($body['moment']);

            if ($moment === '') {
                respond(400, ['error' => 'A non-empty journal entry is required.']);
            }

            if (mb_strlen($moment) > 10000) {
                respond(400, ['error' => 'Journal entries must be 10,000 characters or fewer.']);
            }

            $statement = $pdo->prepare(
                'INSERT INTO memorable_moments (memorable_moment)
                 VALUES (:moment)'
            );
            $statement->execute(['moment' => $moment]);

            $statement = $pdo->prepare(
                'SELECT momentID, memorable_moment AS moment,
                        DATE_FORMAT(moment_date, \'%Y-%m-%d\') AS momentDate
                 FROM memorable_moments
                 WHERE momentID = :momentID'
            );
            $statement->execute(['momentID' => (int) $pdo->lastInsertId()]);
            $created = $statement->fetch();

            if ($created === false) {
                respond(500, ['error' => 'The journal entry was saved but could not be loaded.']);
            }

            respond(201, $created);

        default:
            header('Allow: GET, POST');
            respond(405, ['error' => 'Method not allowed.']);
    }
} catch (Throwable $exception) {
    error_log($exception->__toString());
    respond(500, ['error' => 'A server error prevented the journal request from completing.']);
}
