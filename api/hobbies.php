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

function hobbyIdFromValue(mixed $value): int
{
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

    if ($id === false) {
        respond(400, ['error' => 'A valid hobbyID is required.']);
    }

    return $id;
}

function findHobby(PDO $pdo, int $hobbyId): ?array
{
    $statement = $pdo->prepare(
        'SELECT hobbyID, hobby, time_created AS timeCreated, time_checked AS timeChecked
         FROM hobbies WHERE hobbyID = :hobbyID'
    );
    $statement->execute(['hobbyID' => $hobbyId]);
    $hobby = $statement->fetch(PDO::FETCH_ASSOC);

    return $hobby === false ? null : $hobby;
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

    $pdo->exec(
        'UPDATE hobbies
         SET time_checked = NULL
         WHERE time_checked IS NOT NULL
           AND time_checked <= CURRENT_TIMESTAMP - INTERVAL 24 HOUR'
    );

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            if (isset($_GET['period'])) {
                $period = $_GET['period'];
                if ($period === 'date') {
                    $dateValue = $_GET['date'] ?? '';
                    $date = is_string($dateValue)
                        ? DateTimeImmutable::createFromFormat('!Y-m-d', $dateValue)
                        : false;
                    $dateErrors = DateTimeImmutable::getLastErrors();

                    if (
                        $date === false
                        || ($dateErrors !== false && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0))
                        || $date->format('Y-m-d') !== $dateValue
                    ) {
                        respond(400, ['error' => 'A valid date in YYYY-MM-DD format is required.']);
                    }

                    $statement = $pdo->prepare(
                        'SELECT history.hobby_name AS hobby, COUNT(DISTINCT DATE(history.checked_at)) AS checkCount
                         FROM hobby_check_history AS history
                         WHERE history.checked_at >= :startDate
                           AND history.checked_at < :endDate
                         GROUP BY history.hobby_name
                         ORDER BY checkCount DESC, history.hobby_name'
                    );
                    $statement->execute([
                        'startDate' => $date->format('Y-m-d'),
                        'endDate' => $date->modify('+1 day')->format('Y-m-d'),
                    ]);
                    respond(200, [
                        'period' => $period,
                        'date' => $date->format('Y-m-d'),
                        'hobbies' => $statement->fetchAll(),
                    ]);
                }

                $periodStart = match ($period) {
                    'week' => 'DATE_SUB(CURRENT_DATE, INTERVAL WEEKDAY(CURRENT_DATE) DAY)',
                    'month' => "DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')",
                    'year' => 'MAKEDATE(YEAR(CURRENT_DATE), 1)',
                    default => null,
                };

                if ($periodStart === null) {
                    respond(400, ['error' => 'Period must be week, month, or year.']);
                }

                $statement = $pdo->query(
                    "SELECT history.hobby_name AS hobby, COUNT(DISTINCT DATE(history.checked_at)) AS checkCount
                     FROM hobby_check_history AS history
                     WHERE history.checked_at >= {$periodStart}
                     GROUP BY history.hobby_name
                     ORDER BY checkCount DESC, history.hobby_name"
                );
                respond(200, [
                    'period' => $period,
                    'hobbies' => $statement->fetchAll(),
                ]);
            }

            $statement = $pdo->query(
                'SELECT hobbyID, hobby, time_created AS timeCreated, time_checked AS timeChecked
                 FROM hobbies ORDER BY time_created, hobbyID'
            );
            respond(200, $statement->fetchAll());

        case 'POST':
            $body = readJsonBody();

            if (!is_string($body['hobby'] ?? null)) {
                respond(400, ['error' => 'A non-empty hobby is required.']);
            }

            $hobby = trim($body['hobby']);

            if ($hobby === '') {
                respond(400, ['error' => 'A non-empty hobby is required.']);
            }

            if (mb_strlen($hobby) > 255) {
                respond(400, ['error' => 'Hobby names must be 255 characters or fewer.']);
            }

            $statement = $pdo->prepare('INSERT INTO hobbies (hobby) VALUES (:hobby)');
            $statement->execute(['hobby' => $hobby]);
            $created = findHobby($pdo, (int) $pdo->lastInsertId());

            if ($created === null) {
                respond(500, ['error' => 'The hobby was saved but could not be loaded.']);
            }

            respond(201, $created);

        case 'PATCH':
            $body = readJsonBody();
            $hobbyId = hobbyIdFromValue($body['hobbyID'] ?? null);

            if (!is_bool($body['selected'] ?? null)) {
                respond(400, ['error' => 'The selected field must be a boolean.']);
            }

            $pdo->beginTransaction();
            $statement = $pdo->prepare(
                'SELECT time_checked FROM hobbies WHERE hobbyID = :hobbyID FOR UPDATE'
            );
            $statement->execute(['hobbyID' => $hobbyId]);
            $current = $statement->fetch();

            if ($current === false) {
                $pdo->rollBack();
                respond(404, ['error' => 'Hobby not found.']);
            }

            $wasSelected = $current['time_checked'] !== null;
            $isTransitionToSelected = $body['selected'] && !$wasSelected;

            if ($wasSelected !== $body['selected']) {
                $statement = $pdo->prepare(
                    'UPDATE hobbies
                     SET time_checked = IF(:selected, CURRENT_TIMESTAMP, NULL)
                     WHERE hobbyID = :hobbyID'
                );
                $statement->bindValue(':selected', $body['selected'], PDO::PARAM_BOOL);
                $statement->bindValue(':hobbyID', $hobbyId, PDO::PARAM_INT);
                $statement->execute();
            }

            $updated = findHobby($pdo, $hobbyId);

            if ($updated === null) {
                $pdo->rollBack();
                respond(404, ['error' => 'Hobby not found.']);
            }

            if ($isTransitionToSelected) {
                $statement = $pdo->prepare(
                    'SELECT 1
                     FROM hobby_check_history
                     WHERE hobbyID = :hobbyID
                       AND checked_at >= CURRENT_DATE
                       AND checked_at < CURRENT_DATE + INTERVAL 1 DAY
                     LIMIT 1'
                );
                $statement->execute(['hobbyID' => $hobbyId]);

                if ($statement->fetchColumn() === false) {
                    $statement = $pdo->prepare(
                        'INSERT INTO hobby_check_history (hobbyID, hobby_name)
                         VALUES (:hobbyID, :hobbyName)'
                    );
                    $statement->execute([
                        'hobbyID' => $hobbyId,
                        'hobbyName' => $updated['hobby'],
                    ]);
                }
            }

            $pdo->commit();
            respond(200, $updated);

        case 'DELETE':
            $hobbyId = hobbyIdFromValue($_GET['hobbyID'] ?? null);
            $statement = $pdo->prepare('DELETE FROM hobbies WHERE hobbyID = :hobbyID');
            $statement->execute(['hobbyID' => $hobbyId]);

            if ($statement->rowCount() === 0) {
                respond(404, ['error' => 'Hobby not found.']);
            }

            respond(200, ['deleted' => true]);

        default:
            header('Allow: GET, POST, PATCH, DELETE');
            respond(405, ['error' => 'Method not allowed.']);
    }
} catch (Throwable $exception) {
    error_log($exception->__toString());
    respond(500, ['error' => 'A server error prevented the hobby request from completing.']);
}
