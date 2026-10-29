const hobbyChartPeriod = document.getElementById('hobbyChartPeriod');
const hobbyChart = document.getElementById('hobbyChart');
const hobbyChartLegend = document.getElementById('hobbyChartLegend');
const hobbyChartStatus = document.getElementById('hobbyChartStatus');
const hobbyChartTotal = document.getElementById('hobbyChartTotal');
const hobbyChartDate = document.getElementById('hobbyChartDate');
const manageHobbiesDialog = document.getElementById('manageHobbiesDialog');
const openHobbiesDialog = document.getElementById('openHobbiesDialog');
const closeHobbiesDialog = document.getElementById('closeHobbiesDialog');
const hobbiesFrame = document.getElementById('hobbiesFrame');
const journalToday = document.getElementById('journalToday');
const journalForm = document.getElementById('journalForm');
const journalEntry = document.getElementById('journalEntry');
const journalSaveButton = document.getElementById('journalSaveButton');
const journalStatus = document.getElementById('journalStatus');
const journalEntries = document.getElementById('journalEntries');
const journalHistoryEmpty = document.getElementById('journalHistoryEmpty');
const journalPeriod = document.getElementById('journalPeriod');
const journalDate = document.getElementById('journalDate');
const dailySummaryDate = document.getElementById('dailySummaryDate');
const dailySummaryHobbies = document.getElementById('dailySummaryHobbies');
const dailySummaryHobbiesStatus = document.getElementById('dailySummaryHobbiesStatus');
const dailySummaryMoments = document.getElementById('dailySummaryMoments');
const dailySummaryMomentsStatus = document.getElementById('dailySummaryMomentsStatus');
const dailySummarySleep = document.getElementById('dailySummarySleep');
const dailySummarySleepStatus = document.getElementById('dailySummarySleepStatus');
const dailyScoreForm = document.getElementById('dailyScoreForm');
const dailyScoreDate = document.getElementById('dailyScoreDate');
const dailySleepStart = document.getElementById('dailySleepStart');
const dailyWakeTime = document.getElementById('dailyWakeTime');
const dailyScoreSaveButton = document.getElementById('dailyScoreSaveButton');
const dailyScoreChart = document.getElementById('dailyScoreChart');
const dailyScoreMonth = document.getElementById('dailyScoreMonth');
const dailyScoreStatus = document.getElementById('dailyScoreStatus');
const dailyScoreApi = 'api/daily_scores.php';
const dailyScoreToday = new Date();
const dailyScoreYear = dailyScoreToday.getFullYear();
const dailyScoreMonthIndex = dailyScoreToday.getMonth();
const dailyScoreMonthValue = [
    dailyScoreYear,
    String(dailyScoreMonthIndex + 1).padStart(2, '0')
].join('-');
const hobbyChartColors = [
    '#2563eb',
    '#db2777',
    '#d97706',
    '#059669',
    '#7c3aed',
    '#0891b2',
    '#dc2626',
    '#4f46e5',
    '#65a30d',
    '#c2410c'
];
const hobbyCheckChannel = typeof BroadcastChannel === 'function'
    ? new BroadcastChannel('habit-tracking-hobby-checks')
    : null;
let activeHobbyChartFilter = 'period';
let dailyScoresByDate = new Map();
const loadedDailyScoreMonths = new Set();
let dailySummaryRequestId = 0;
let selectedScoreDateRequestId = 0;
let journalPage = 1;
let journalPageSize = 25;
let journalTotalEntries = 0;
let journalTotalPages = 0;
let journalRequestId = 0;

function formatJournalDate(dateValue) {
    const [year, month, day] = dateValue.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'full'
    }).format(date);
}

function createJournalEntry(moment) {
    const item = document.createElement('li');
    item.className = 'journal-entry';

    const date = document.createElement('time');
    date.dateTime = moment.momentDate;
    date.textContent = formatJournalDate(moment.momentDate);

    const text = document.createElement('p');
    text.textContent = moment.moment;

    item.append(date, text);
    return item;
}

function createScoreSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    Object.entries(attributes).forEach(([name, value]) => {
        element.setAttribute(name, String(value));
    });
    return element;
}

function drawDailyScoreChart(scores, month = dailyScoreMonthValue) {
    const left = 52;
    const right = 990;
    const top = 24;
    const bottom = 366;
    const [year, monthNumber] = month.split('-').map(Number);
    const monthDays = new Date(year, monthNumber, 0).getDate();
    const xForDay = day => left + ((day - 1) / (monthDays - 1)) * (right - left);
    const yForScore = hours => bottom - (Math.min(hours, 12) / 12) * (bottom - top);
    const scoresByDay = new Map(
        scores
            .filter(item => item.scoreDate.startsWith(`${month}-`))
            .map(item => [Number(item.scoreDate.slice(8, 10)), {
                hours: Number(item.score),
                sleepStart: item.sleepStart,
                wakeTime: item.wakeTime
            }])
    );
    const monthLabel = new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric'
    }).format(new Date(year, monthNumber - 1, 1));
    dailyScoreMonth.textContent = monthLabel;

    dailyScoreChart.replaceChildren();
    dailyScoreChart.setAttribute(
        'aria-label',
        `Daily sleep duration from 0 to 12 hours for ${monthLabel}`
    );

    for (let hours = 0; hours <= 12; hours += 1) {
        const y = yForScore(hours);
        dailyScoreChart.appendChild(createScoreSvgElement('line', {
            x1: left,
            y1: y,
            x2: right,
            y2: y,
            class: 'daily-score-gridline'
        }));
        const label = createScoreSvgElement('text', {
            x: left - 12,
            y: y + 4,
            class: 'daily-score-axis-label',
            'text-anchor': 'end'
        });
        label.textContent = String(hours);
        dailyScoreChart.appendChild(label);
    }

    for (let day = 1; day <= monthDays; day += 1) {
        const x = xForDay(day);
        dailyScoreChart.appendChild(createScoreSvgElement('line', {
            x1: x,
            y1: top,
            x2: x,
            y2: bottom,
            class: 'daily-score-gridline daily-score-gridline-vertical'
        }));
        const label = createScoreSvgElement('text', {
            x,
            y: bottom + 24,
            class: 'daily-score-axis-label daily-score-day-label',
            'text-anchor': 'middle'
        });
        label.textContent = String(day);
        dailyScoreChart.appendChild(label);
    }

    dailyScoreChart.appendChild(createScoreSvgElement('line', {
        x1: left,
        y1: yForScore(5),
        x2: right,
        y2: yForScore(5),
        class: 'daily-score-threshold'
    }));

    let previousPoint = null;
    for (let day = 1; day <= monthDays; day += 1) {
        const score = scoresByDay.get(day);
        if (score === undefined) {
            previousPoint = null;
            continue;
        }

        const point = {
            x: xForDay(day),
            y: yForScore(score.hours),
            hours: Math.min(score.hours, 12),
            day,
            score
        };
        if (previousPoint && previousPoint.day === day - 1) {
            const previousBelow = previousPoint.hours < 5;
            const currentBelow = point.hours < 5;

            if (previousBelow !== currentBelow) {
                const crossingRatio = (5 - previousPoint.hours) / (point.hours - previousPoint.hours);
                const crossingX = previousPoint.x + crossingRatio * (point.x - previousPoint.x);
                const crossingY = yForScore(5);
                const firstClass = previousBelow
                    ? 'daily-score-line daily-score-line-low'
                    : 'daily-score-line';
                const secondClass = currentBelow
                    ? 'daily-score-line daily-score-line-low'
                    : 'daily-score-line';

                dailyScoreChart.append(
                    createScoreSvgElement('line', {
                        x1: previousPoint.x,
                        y1: previousPoint.y,
                        x2: crossingX,
                        y2: crossingY,
                        class: firstClass
                    }),
                    createScoreSvgElement('line', {
                        x1: crossingX,
                        y1: crossingY,
                        x2: point.x,
                        y2: point.y,
                        class: secondClass
                    })
                );
            } else {
                dailyScoreChart.appendChild(createScoreSvgElement('line', {
                    x1: previousPoint.x,
                    y1: previousPoint.y,
                    x2: point.x,
                    y2: point.y,
                    class: previousBelow
                        ? 'daily-score-line daily-score-line-low'
                        : 'daily-score-line'
                }));
            }
        }
        const marker = createScoreSvgElement('circle', {
            cx: point.x,
            cy: point.y,
            r: 5,
            class: 'daily-score-point'
        });
        const title = createScoreSvgElement('title');
        const scoreTimes = score.sleepStart && score.wakeTime
            ? ` (${score.sleepStart}–${score.wakeTime})`
            : '';
        title.textContent =
            `${formatJournalDate(`${month}-${String(day).padStart(2, '0')}`)}: ` +
            `${score.hours.toFixed(2)} hours${scoreTimes}` +
            (score.hours > 12 ? ' (display capped at 12 hours)' : '');
        marker.appendChild(title);
        dailyScoreChart.appendChild(marker);
        previousPoint = point;
    }

    const xAxisLabel = createScoreSvgElement('text', {
        x: (left + right) / 2,
        y: 416,
        class: 'daily-score-axis-label',
        'text-anchor': 'middle'
    });
    xAxisLabel.textContent = 'Day of month (sleep duration in hours; values above 12 capped)';
    dailyScoreChart.appendChild(xAxisLabel);
}

function populateDailyScoreTimes() {
    const savedScore = dailyScoresByDate.get(dailyScoreDate.value);
    dailySleepStart.value = savedScore?.sleepStart ?? '';
    dailyWakeTime.value = savedScore?.wakeTime ?? '';
}

async function loadDailyScores(month = dailyScoreMonthValue, selectedDate = '') {
    const isSelectedMonth = month === dailyScoreDate.value.slice(0, 7);
    if (isSelectedMonth) {
        dailyScoreStatus.textContent = '';
        dailyScoreStatus.classList.remove('daily-score-status-error');
    }

    try {
        const response = await fetch(
            `${dailyScoreApi}?month=${encodeURIComponent(month)}`,
            { cache: 'no-store' }
        );
        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                typeof result.error === 'string' ? result.error : 'Could not load daily scores.'
            );
        }

        if (!Array.isArray(result)) {
            throw new Error('The daily scores API returned an invalid response.');
        }

        for (const scoreDate of dailyScoresByDate.keys()) {
            if (scoreDate.startsWith(`${month}-`)) {
                dailyScoresByDate.delete(scoreDate);
            }
        }
        for (const score of result) {
            dailyScoresByDate.set(score.scoreDate, score);
        }
        loadedDailyScoreMonths.add(month);

        const isStillSelectedMonth = month === dailyScoreDate.value.slice(0, 7);
        if (isStillSelectedMonth) {
            drawDailyScoreChart(result, month);
        }
        if (selectedDate !== '' && selectedDate === dailyScoreDate.value) {
            populateDailyScoreTimes();
        } else if (isStillSelectedMonth) {
            populateDailyScoreTimes();
        }
        return true;
    } catch (error) {
        if (month === dailyScoreDate.value.slice(0, 7)) {
            dailyScoreStatus.classList.add('daily-score-status-error');
            dailyScoreStatus.textContent = `Could not load sleep scores: ${error.message}`;
        }
        return false;
    }
}

async function loadSelectedDailyScoreTimes() {
    const date = dailyScoreDate.value;
    const requestId = ++selectedScoreDateRequestId;

    if (date === '') {
        dailySleepStart.value = '';
        dailyWakeTime.value = '';
        dailyScoreStatus.textContent = '';
        dailyScoreStatus.classList.remove('daily-score-status-error');
        return;
    }

    const month = date.slice(0, 7);
    drawDailyScoreChart(
        [...dailyScoresByDate.values()].filter(score => score.scoreDate.startsWith(`${month}-`)),
        month
    );
    if (loadedDailyScoreMonths.has(month)) {
        populateDailyScoreTimes();
        dailyScoreStatus.textContent = '';
        dailyScoreStatus.classList.remove('daily-score-status-error');
        return;
    }

    dailyScoreStatus.textContent = 'Loading saved sleep times...';
    dailyScoreStatus.classList.remove('daily-score-status-error');
    const loaded = await loadDailyScores(month, date);

    if (requestId === selectedScoreDateRequestId && loaded) {
        dailyScoreStatus.textContent = '';
        dailyScoreStatus.classList.remove('daily-score-status-error');
    }
}

async function fetchDailySummaryData(url) {
    const response = await fetch(url, { cache: 'no-store' });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            typeof result.error === 'string' ? result.error : 'Could not load daily summary.'
        );
    }

    return result;
}

async function loadDailySummary() {
    const date = dailySummaryDate.value;
    const requestId = ++dailySummaryRequestId;
    if (date === '') {
        dailySummaryHobbies.replaceChildren();
        dailySummaryMoments.replaceChildren();
        dailySummarySleep.textContent = '';
        dailySummaryHobbiesStatus.textContent = 'Choose a date to view hobby check-ins.';
        dailySummaryMomentsStatus.textContent = 'Choose a date to view memorable moments.';
        dailySummarySleepStatus.textContent = 'Choose a date to view sleep.';
        return;
    }

    dailySummaryHobbies.replaceChildren();
    dailySummaryMoments.replaceChildren();
    dailySummarySleep.textContent = '';
    dailySummaryHobbiesStatus.textContent = 'Loading hobbies...';
    dailySummaryMomentsStatus.textContent = 'Loading memorable moments...';
    dailySummarySleepStatus.textContent = 'Loading sleep...';

    const month = date.slice(0, 7);
    const hobbyParams = new URLSearchParams({ period: 'date', date });
    const momentParams = new URLSearchParams({ period: 'day', date });
    const [hobbiesResult, momentsResult, sleepResult] = await Promise.allSettled([
        fetchDailySummaryData(`api/hobbies.php?${hobbyParams}`),
        fetchDailySummaryData(`api/memorable_moments.php?${momentParams}`),
        fetchDailySummaryData(`${dailyScoreApi}?month=${encodeURIComponent(month)}`)
    ]);

    if (requestId !== dailySummaryRequestId) {
        return;
    }

    if (hobbiesResult.status === 'rejected') {
        dailySummaryHobbiesStatus.textContent =
            `Could not load hobbies: ${hobbiesResult.reason.message}`;
    } else {
        const hobbies = hobbiesResult.value?.hobbies;
        if (!Array.isArray(hobbies)) {
            dailySummaryHobbiesStatus.textContent = 'Could not load hobbies: Invalid response.';
        } else if (hobbies.length === 0) {
            dailySummaryHobbiesStatus.textContent = 'No hobby check-ins recorded for this date.';
        } else {
            dailySummaryHobbies.replaceChildren(...hobbies.map(hobby => {
                const item = document.createElement('li');
                item.textContent = hobby.hobby;
                return item;
            }));
            dailySummaryHobbiesStatus.textContent = '';
        }
    }

    if (momentsResult.status === 'rejected') {
        dailySummaryMomentsStatus.textContent =
            `Could not load memorable moments: ${momentsResult.reason.message}`;
    } else if (!Array.isArray(momentsResult.value)) {
        dailySummaryMomentsStatus.textContent =
            'Could not load memorable moments: Invalid response.';
    } else if (momentsResult.value.length === 0) {
        dailySummaryMomentsStatus.textContent = 'No memorable moments recorded for this date.';
    } else {
        dailySummaryMoments.replaceChildren(...momentsResult.value.map(moment => {
            const item = document.createElement('li');
            item.textContent = moment.moment;
            return item;
        }));
        dailySummaryMomentsStatus.textContent = '';
    }

    if (sleepResult.status === 'rejected') {
        dailySummarySleepStatus.textContent =
            `Could not load sleep: ${sleepResult.reason.message}`;
    } else if (!Array.isArray(sleepResult.value)) {
        dailySummarySleepStatus.textContent = 'Could not load sleep: Invalid response.';
    } else {
        const sleep = sleepResult.value.find(entry => entry.scoreDate === date);
        if (!sleep) {
            dailySummarySleepStatus.textContent = 'No sleep times recorded for this date.';
        } else {
            dailySummarySleep.textContent =
                `${Number(sleep.score).toFixed(2)} hours (${sleep.sleepStart}–${sleep.wakeTime})`;
            dailySummarySleepStatus.textContent = '';
        }
    }
}

async function loadJournal() {
    journalPage = 1;
    journalStatus.textContent = '';
    journalStatus.classList.remove('journal-status-error');
    journalHistoryEmpty.hidden = true;

    try {
        const params = new URLSearchParams({ period: journalPeriod.value });
        if (journalPeriod.value !== 'all') {
            params.set('date', journalDate.value);
        } else {
            params.set('page', String(journalPage));
            params.set('pageSize', String(journalPageSize));
        }

        const requestId = ++journalRequestId;
        const response = await fetch(`api/memorable_moments.php?${params}`, { cache: 'no-store' });
        const result = await response.json();

        if (requestId !== journalRequestId) {
            return;
        }

        if (!response.ok) {
            throw new Error(
                typeof result.error === 'string' ? result.error : 'Could not load journal history.'
            );
        }

        journalTotalEntries = Number(response.headers.get('X-Total-Count') ?? 0);
        journalTotalPages = Number(response.headers.get('X-Total-Pages') ?? 0);

        journalEntries.replaceChildren(...result.map(createJournalEntry));
        journalHistoryEmpty.hidden = result.length > 0;
        updateJournalPaginationUI();
    } catch (error) {
        journalStatus.classList.add('journal-status-error');
        journalStatus.textContent = `Could not load journal history: ${error.message}`;
    }
}

async function loadMoreJournal() {
    if (journalPage >= journalTotalPages) {
        return;
    }

    journalPage++;

    try {
        const params = new URLSearchParams({
            period: journalPeriod.value,
            page: String(journalPage),
            pageSize: String(journalPageSize)
        });
        const response = await fetch(`api/memorable_moments.php?${params}`, { cache: 'no-store' });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                typeof result.error === 'string' ? result.error : 'Could not load more journal entries.'
            );
        }

        journalTotalEntries = Number(response.headers.get('X-Total-Count') ?? 0);
        journalTotalPages = Number(response.headers.get('X-Total-Pages') ?? 0);

        journalEntries.append(...result.map(createJournalEntry));
        updateJournalPaginationUI();
    } catch (error) {
        journalPage--;
        journalStatus.classList.add('journal-status-error');
        journalStatus.textContent = `Could not load more journal entries: ${error.message}`;
    }
}

function updateJournalPaginationUI() {
    const loadMoreButton = document.getElementById('journalLoadMore');
    if (journalPeriod.value !== 'all') {
        loadMoreButton.hidden = true;
        return;
    }
    if (journalPage >= journalTotalPages || journalTotalEntries === 0) {
        loadMoreButton.hidden = true;
    } else {
        loadMoreButton.hidden = false;
    }
}

const today = new Date();
journalDate.value = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
].join('-');
journalToday.dateTime = journalDate.value;
journalToday.textContent = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full'
}).format(today);
journalPeriod.addEventListener('change', function() {
    journalDate.disabled = journalPeriod.value === 'all';
    loadJournal();
});
journalDate.addEventListener('change', loadJournal);
document.getElementById('journalLoadMore').addEventListener('click', loadMoreJournal);
dailySummaryDate.value = journalDate.value;
dailySummaryDate.addEventListener('change', loadDailySummary);

journalForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const moment = journalEntry.value.trim();

    if (moment === '') {
        journalStatus.textContent = 'Write a journal entry before saving.';
        journalEntry.focus();
        return;
    }

    journalSaveButton.disabled = true;
    journalStatus.textContent = '';
    journalStatus.classList.remove('journal-status-error');

    try {
        const response = await fetch('api/memorable_moments.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moment })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                typeof result.error === 'string' ? result.error : 'Could not save journal entry.'
            );
        }

        await loadJournal();
        journalEntry.value = '';
        journalStatus.textContent = 'Journal entry saved.';
        if (dailySummaryDate.value === result.momentDate) {
            loadDailySummary();
        }
    } catch (error) {
        journalStatus.classList.add('journal-status-error');
        journalStatus.textContent = `Could not save journal entry: ${error.message}`;
    } finally {
        journalSaveButton.disabled = false;
    }
});

function drawHobbyChart(hobbies, period, dateValue) {
    const context = hobbyChart.getContext('2d');
    const bounds = hobbyChart.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const total = hobbies.reduce((sum, hobby) => sum + Number(hobby.checkCount), 0);

    hobbyChartTotal.textContent = String(total);
    hobbyChart.width = width * pixelRatio;
    hobbyChart.height = height * pixelRatio;
    context.scale(pixelRatio, pixelRatio);
    context.clearRect(0, 0, width, height);
    hobbyChartLegend.replaceChildren();

    if (total === 0) {
        context.fillStyle = '#555';
        context.font = '600 15px Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        const emptyMessage = period === 'date'
            ? `No check-ins on ${formatJournalDate(dateValue)}`
            : `No check-ins ${period === 'week' ? 'this week' : `this ${period}`}`;
        context.fillText(emptyMessage, width / 2, height / 2);
        return;
    }

    const radius = Math.min(width, height) / 2 - 4;
    let startAngle = -Math.PI / 2;

    hobbies.forEach((hobby, index) => {
        const count = Number(hobby.checkCount);
        const endAngle = startAngle + (count / total) * Math.PI * 2;
        const color = hobbyChartColors[index % hobbyChartColors.length];

        context.beginPath();
        context.moveTo(width / 2, height / 2);
        context.arc(width / 2, height / 2, radius, startAngle, endAngle);
        context.closePath();
        context.fillStyle = color;
        context.fill();
        startAngle = endAngle;

        const legendItem = document.createElement('li');
        const swatch = document.createElement('span');
        swatch.className = 'hobby-chart-swatch';
        swatch.style.backgroundColor = color;
        swatch.setAttribute('aria-hidden', 'true');

        const label = document.createElement('span');
        label.textContent = `${hobby.hobby}: ${count}`;
        legendItem.append(swatch, label);
        hobbyChartLegend.appendChild(legendItem);
    });
}

async function loadHobbyChart() {
    const period = activeHobbyChartFilter === 'date' ? 'date' : hobbyChartPeriod.value;
    const dateValue = hobbyChartDate.value;
    if (period === 'date' && dateValue === '') {
        hobbyChartStatus.textContent = 'Choose a date to view its hobby checks.';
        return;
    }

    hobbyChartPeriod.disabled = true;
    hobbyChartDate.disabled = true;
    hobbyChartStatus.textContent = '';

    try {
        const params = new URLSearchParams({ period });
        if (period === 'date') {
            params.set('date', dateValue);
        }

        const response = await fetch(`api/hobbies.php?${params}`, { cache: 'no-store' });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                typeof result.error === 'string' ? result.error : 'Could not load hobby checks.'
            );
        }

        drawHobbyChart(result.hobbies, period, dateValue);
        const displayRange = period === 'date'
            ? `on ${formatJournalDate(dateValue)}`
            : `this ${period}`;
        hobbyChart.setAttribute('aria-label', `Pie chart of hobby checks ${displayRange}`);
        const totalChecks = result.hobbies.reduce(
            (sum, hobby) => sum + Number(hobby.checkCount),
            0
        );
        hobbyChartTotal.parentElement.lastElementChild.textContent =
            `check${totalChecks === 1 ? '' : 's'} ${displayRange}`;
    } catch (error) {
        hobbyChartStatus.textContent = `Could not load hobby chart: ${error.message}`;
    } finally {
        hobbyChartPeriod.disabled = false;
        hobbyChartDate.disabled = false;
    }
}

openHobbiesDialog.addEventListener('click', function() {
    if (!hobbiesFrame.hasAttribute('src')) {
        hobbiesFrame.src = hobbiesFrame.dataset.src;
    }
    manageHobbiesDialog.showModal();
    closeHobbiesDialog.focus();
});

closeHobbiesDialog.addEventListener('click', function() {
    manageHobbiesDialog.close();
});

manageHobbiesDialog.addEventListener('click', function(event) {
    if (event.target === manageHobbiesDialog) {
        manageHobbiesDialog.close();
    }
});

manageHobbiesDialog.addEventListener('close', function() {
    openHobbiesDialog.focus();
    loadHobbyChart();
    loadJournal();
});

hobbyChartPeriod.addEventListener('change', function() {
    activeHobbyChartFilter = 'period';
    loadHobbyChart();
});
hobbyChartDate.addEventListener('change', function() {
    activeHobbyChartFilter = 'date';
    loadHobbyChart();
});
hobbyCheckChannel?.addEventListener('message', function() {
    loadHobbyChart();
    if (dailySummaryDate.value === journalDate.value) {
        loadDailySummary();
    }
});
window.addEventListener('resize', loadHobbyChart);
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        loadHobbyChart();
    }
});
window.setInterval(loadHobbyChart, 30000);

dailyScoreDate.value = [
    dailyScoreYear,
    String(dailyScoreMonthIndex + 1).padStart(2, '0'),
    String(dailyScoreToday.getDate()).padStart(2, '0')
].join('-');
drawDailyScoreChart([], dailyScoreMonthValue);
dailyScoreDate.addEventListener('change', loadSelectedDailyScoreTimes);
dailyScoreForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const date = dailyScoreDate.value;
    const sleepStart = dailySleepStart.value;
    const wakeTime = dailyWakeTime.value;

    if (!dailyScoreForm.reportValidity()) {
        return;
    }

    dailyScoreSaveButton.disabled = true;
    dailyScoreStatus.textContent = '';
    dailyScoreStatus.classList.remove('daily-score-status-error');

    try {
        const response = await fetch(dailyScoreApi, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, sleepStart, wakeTime })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                typeof result.error === 'string' ? result.error : 'Could not save the sleep score.'
            );
        }

        if (await loadDailyScores(date.slice(0, 7), date)) {
            dailyScoreStatus.textContent =
                `${Number(result.score).toFixed(2)} hours saved for ` +
                `${formatJournalDate(result.scoreDate)}.`;
            if (dailySummaryDate.value === result.scoreDate) {
                loadDailySummary();
            }
        }
    } catch (error) {
        dailyScoreStatus.classList.add('daily-score-status-error');
        dailyScoreStatus.textContent = `Could not save sleep score: ${error.message}`;
    } finally {
        dailyScoreSaveButton.disabled = false;
    }
});
loadDailyScores();
loadHobbyChart();
loadDailySummary();
