const itemInput = document.getElementById('itemInput');
const addBtn = document.getElementById('addBtn');
const hobbyTableBody = document.getElementById('hobbyTableBody');
const statusMessage = document.getElementById('statusMessage');
const hobbiesApi = 'api/hobbies.php';
const hobbyCheckChannel = typeof BroadcastChannel === 'function'
    ? new BroadcastChannel('habit-tracking-hobby-checks')
    : null;
let isRefreshingHobbyChecks = false;

document.body.classList.toggle(
    'embedded-hobbies',
    new URLSearchParams(window.location.search).get('embedded') === '1'
);

itemInput.disabled = true;
addBtn.disabled = true;

async function requestHobbiesApi(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    const responseText = await response.text();
    let result;

    if (responseText.trim() === '') {
        throw new Error(
            `The PHP endpoint returned an empty response (HTTP ${response.status}). ` +
            'Make sure the page is opened through XAMPP Apache and PHP is enabled.'
        );
    }

    try {
        result = JSON.parse(responseText);
    } catch {
        throw new Error(
            `The PHP endpoint returned a non-JSON response (HTTP ${response.status}). ` +
            'Check the XAMPP Apache/PHP error log.'
        );
    }

    if (!response.ok) {
        const message = result && typeof result.error === 'string'
            ? result.error
            : 'The request could not be completed.';
        throw new Error(message);
    }

    return result;
}

function showStatus(message) {
    statusMessage.textContent = message;
}

function formatTimestamp(timestamp) {
    if (!timestamp) {
        return 'Not checked';
    }

    const date = new Date(timestamp.replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function createHobbyRow(hobby) {
    const row = document.createElement('tr');
    row.dataset.hobbyId = hobby.hobbyID;

    const checkboxCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'hobby-checkbox';
    checkbox.checked = hobby.timeChecked !== null;
    checkbox.setAttribute('aria-label', `Mark ${hobby.hobby} as complete`);
    checkboxCell.appendChild(checkbox);

    const hobbyCell = document.createElement('th');
    hobbyCell.scope = 'row';
    const textSpan = document.createElement('span');
    textSpan.className = 'hobby-text';
    textSpan.textContent = hobby.hobby;
    hobbyCell.appendChild(textSpan);

    const createdCell = document.createElement('td');
    createdCell.textContent = formatTimestamp(hobby.timeCreated);

    const checkedCell = document.createElement('td');
    checkedCell.textContent = formatTimestamp(hobby.timeChecked);

    const actionsCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', `Delete ${hobby.hobby}`);
    actionsCell.appendChild(deleteBtn);

    checkbox.addEventListener('change', async function() {
        const selected = checkbox.checked;
        checkbox.disabled = true;
        showStatus('');

        try {
            const updated = await requestHobbiesApi(hobbiesApi, {
                method: 'PATCH',
                body: JSON.stringify({
                    hobbyID: hobby.hobbyID,
                    selected
                })
            });
            checkbox.checked = updated.timeChecked !== null;
            checkedCell.textContent = formatTimestamp(updated.timeChecked);
            if (selected) {
                hobbyCheckChannel?.postMessage('updated');
            }
        } catch (error) {
            checkbox.checked = !selected;
            showStatus(`Could not update hobby: ${error.message}`);
        } finally {
            checkbox.disabled = false;
        }
    });

    deleteBtn.addEventListener('click', async function() {
        if (!window.confirm(`Are you sure you want to delete "${hobby.hobby}"?`)) {
            return;
        }

        deleteBtn.disabled = true;
        showStatus('');

        try {
            await requestHobbiesApi(`${hobbiesApi}?hobbyID=${encodeURIComponent(hobby.hobbyID)}`, {
                method: 'DELETE'
            });
            row.remove();
        } catch (error) {
            deleteBtn.disabled = false;
            showStatus(`Could not delete hobby: ${error.message}`);
        }
    });

    row.append(checkboxCell, hobbyCell, createdCell, checkedCell, actionsCell);
    return row;
}

async function loadHobbies() {
    try {
        const hobbies = await requestHobbiesApi(hobbiesApi);
        hobbyTableBody.replaceChildren(...hobbies.map(createHobbyRow));
    } catch (error) {
        showStatus(`Could not load hobbies: ${error.message}`);
    } finally {
        itemInput.disabled = false;
        addBtn.disabled = false;
    }
}

async function refreshHobbyChecks() {
    if (isRefreshingHobbyChecks || document.hidden) {
        return;
    }

    isRefreshingHobbyChecks = true;

    try {
        const hobbies = await requestHobbiesApi(hobbiesApi, { cache: 'no-store' });
        const hobbiesById = new Map(
            hobbies.map(hobby => [String(hobby.hobbyID), hobby])
        );

        for (const row of hobbyTableBody.rows) {
            const hobby = hobbiesById.get(row.dataset.hobbyId);
            const checkbox = row.querySelector('.hobby-checkbox');

            if (!hobby || checkbox.disabled) {
                continue;
            }

            checkbox.checked = hobby.timeChecked !== null;
            row.cells[3].textContent = formatTimestamp(hobby.timeChecked);
        }
    } catch (error) {
        showStatus(`Could not refresh hobby checks: ${error.message}`);
    } finally {
        isRefreshingHobbyChecks = false;
    }
}

async function addItem() {
    if (addBtn.disabled) {
        return;
    }

    const itemText = itemInput.value.trim();

    if (itemText === '') {
        showStatus('Please enter a hobby.');
        itemInput.focus();
        return;
    }

    addBtn.disabled = true;
    showStatus('');

    try {
        const result = await requestHobbiesApi(hobbiesApi, {
            method: 'POST',
            body: JSON.stringify({ hobby: itemText })
        });
        hobbyTableBody.appendChild(createHobbyRow(result));
        itemInput.value = '';
        itemInput.focus();
    } catch (error) {
        showStatus(`Could not save hobby: ${error.message}`);
    } finally {
        addBtn.disabled = false;
    }
}

addBtn.addEventListener('click', addItem);

itemInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addItem();
    }
});

document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        refreshHobbyChecks();
    }
});

window.setInterval(refreshHobbyChecks, 60_000);

loadHobbies();
