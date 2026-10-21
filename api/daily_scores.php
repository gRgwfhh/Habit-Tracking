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
            $month = $_GET['month'] ?? date('Y-m');

            if (
                !is_string($month)
                || preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month) !== 1
                || (int) substr($month, 0, 4) < 1000
            ) {
                respond(400, ['error' => 'A valid month in YYYY-MM format is required.']);
            }

            $startDate = DateTimeImmutable::createFromFormat('!Y-m-d', "{$month}-01");
            if ($startDate === false || $startDate->format('Y-m') !== $month) {
                respond(400, ['error' => 'A valid month in YYYY-MM format is required.']);
            }
            $endDate = $startDate->modify('last day of this month');

            $statement = $pdo->prepare(
                'SELECT DATE_FORMAT(score_date, \'%Y-%m-%d\') AS scoreDate,
                        TIME_FORMAT(sleep_start, \'%H:%i\') AS sleepStart,
                        TIME_FORMAT(wake_time, \'%H:%i\') AS wakeTime,
                        score
                 FROM daily_scores
                 WHERE score_date >= :startDate
                   AND score_date <= :endDate
                   AND sleep_start IS NOT NULL
                   AND wake_time IS NOT NULL
                 ORDER BY score_date'
            );
            $statement->execute([
                'startDate' => $startDate->format('Y-m-d'),
                'endDate' => $endDate->format('Y-m-d'),
            ]);
            respond(200, $statement->fetchAll());

        case 'POST':
            $body = readJsonBody();
            $date = $body['date'] ?? null;
            $sleepStart = $body['sleepStart'] ?? null;
            $wakeTime = $body['wakeTime'] ?? null;

            if (
                !is_string($date)
                || preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) !== 1
                || (int) substr($date, 0, 4) < 1000
                || !checkdate(
                    (int) substr($date, 5, 2),
                    (int) substr($date, 8, 2),
                    (int) substr($date, 0, 4)
                )
            ) {
                respond(400, ['error' => 'A valid date in YYYY-MM-DD format is required.']);
            }

            if (
                !is_string($sleepStart)
                || preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $sleepStart) !== 1
                || !is_string($wakeTime)
                || preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $wakeTime) !== 1
            ) {
                respond(400, ['error' => 'Valid sleep start and wake times in HH:MM format are required.']);
            }

            if ($sleepStart === $wakeTime) {
                respond(400, ['error' => 'Sleep start and wake times must be different.']);
            }

            [$sleepHour, $sleepMinute] = array_map('intval', explode(':', $sleepStart));
            [$wakeHour, $wakeMinute] = array_map('intval', explode(':', $wakeTime));
            $sleepMinutes = $sleepHour * 60 + $sleepMinute;
            $wakeMinutes = $wakeHour * 60 + $wakeMinute;
            if ($wakeMinutes <= $sleepMinutes) {
                $wakeMinutes += 24 * 60;
            }
            $score = round(($wakeMinutes - $sleepMinutes) / 60, 2);

            $statement = $pdo->prepare(
                'INSERT INTO daily_scores (score_date, sleep_start, wake_time, score)
                 VALUES (:scoreDate, :sleepStart, :wakeTime, :score)
                 ON DUPLICATE KEY UPDATE
                    sleep_start = VALUES(sleep_start),
                    wake_time = VALUES(wake_time),
                    score = VALUES(score)'
            );
            $statement->execute([
                'scoreDate' => $date,
                'sleepStart' => $sleepStart,
                'wakeTime' => $wakeTime,
                'score' => $score,
            ]);

            respond(200, [
                'scoreDate' => $date,
                'sleepStart' => $sleepStart,
                'wakeTime' => $wakeTime,
                'score' => number_format($score, 2, '.', ''),
            ]);

        default:
            header('Allow: GET, POST');
            respond(405, ['error' => 'Method not allowed.']);
    }
} catch (Throwable $exception) {
    error_log($exception->__toString());
    respond(500, ['error' => 'A server error prevented the score request from completing.']);
}
