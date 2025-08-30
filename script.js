// --- Data and Constants ---
const ADMIN_PASSWORD = "nas";
const STORAGE_KEY = "artsFestData";
const SCORE_POINTS = {
    '1st': 10,
    '2nd': 7,
    '3rd': 5
};

// --- DOM Elements ---
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminPanel = document.getElementById('admin-panel');
const publicView = document.getElementById('public-view');
const loginForm = document.getElementById('login-form');
const adminPasswordInput = document.getElementById('admin-password');
const adminContent = document.getElementById('admin-content');
const addCategoryBtn = document.getElementById('add-category-btn');
const addTeamBtn = document.getElementById('add-team-btn');
const addCategoryForm = document.getElementById('add-category-form');
const addTeamForm = document.getElementById('add-team-form');
const categoryNameInput = document.getElementById('category-name-input');
const teamNameInput = document.getElementById('team-name-input');
const submitCategoryBtn = document.getElementById('submit-category-btn');
const submitTeamBtn = document.getElementById('submit-team-btn');
const categoryTabsContainer = document.getElementById('category-tabs-container');
const competitionEntry = document.getElementById('competition-entry');
const currentCategoryTitle = document.getElementById('current-category-title');
const addCompetitionForm = document.getElementById('add-competition-form');
const competitionNameInput = document.getElementById('competition-name-input');
const competitionsList = document.getElementById('competitions-list');
const publicCompetitionFilter = document.getElementById('competition-filter');
const publicCategoryFilter = document.getElementById('category-filter');
const resultsContainer = document.getElementById('results-container');

// --- Global State ---
let data = {};
let currentCategory = null;
const database = firebase.database();

// --- Helper Functions ---

/**
 * Generates a more unique ID than Date.now() to prevent collisions.
 * @returns {string} A unique identifier.
 */
const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

/**
 * Saves the entire data object to Firebase.
 */
const saveData = () => {
    database.ref(STORAGE_KEY).set(data);
};

// --- Rendering Functions ---

const renderCategoryTabs = () => {
    categoryTabsContainer.innerHTML = '';
    (data.categories || []).forEach(category => {
        const tab = document.createElement('div');
        tab.className = 'category-tab';
        tab.textContent = category.name;
        tab.dataset.id = category.id;

        if (currentCategory && category.id === currentCategory.id) {
            tab.classList.add('active');
        }

        tab.addEventListener('click', () => {
            currentCategory = category;
            renderCategoryTabs();
            renderCompetitions();
            competitionEntry.classList.remove('hidden');
            currentCategoryTitle.textContent = `Competitions for: ${category.name}`;
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.style.marginLeft = '10px';
        deleteBtn.style.backgroundColor = '#dc3545';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${category.name}"? All its competitions will also be removed.`)) {
                deleteCategory(category.id);
            }
        });
        tab.appendChild(deleteBtn);
        categoryTabsContainer.appendChild(tab);
    });
};

const renderCompetitions = () => {
    competitionsList.innerHTML = '';
    if (!currentCategory) return;

    const categoryCompetitions = (data.competitions || []).filter(comp => comp.categoryId === currentCategory.id);

    categoryCompetitions.forEach(comp => {
        const compCard = document.createElement('div');
        compCard.className = 'competition-card';
        compCard.innerHTML = `
            <h4>${comp.name}</h4>
            <div class="edit-delete-buttons">
                <button class="edit-comp-btn" data-id="${comp.id}">Edit Name</button>
                <button class="delete-comp-btn" data-id="${comp.id}">Delete</button>
            </div>
            <div class="result-entry-form" data-id="${comp.id}">
                ${renderResultRows(comp)}
            </div>
        `;
        competitionsList.appendChild(compCard);
    });
};

const renderResultRows = (competition) => {
    let html = '';
    const places = ['1st', '2nd', '3rd'];

    places.forEach(place => {
        const result = (competition.results || []).find(r => r.place === place) || { name: '', class: '', team: '' };
        html += `
            <div class="student-row">
                <label>${place}:</label>
                <input type="text" class="student-name-input" placeholder="Student Name" value="${result.name}">
                <input type="text" class="student-class-input" placeholder="Class" value="${result.class}">
                <select class="student-team-select">
                    <option value="">Select Team</option>
                    ${(data.teams || []).map(team => `<option value="${team.name}" ${team.name === result.team ? 'selected' : ''}>${team.name}</option>`).join('')}
                </select>
                <button class="save-result-btn" data-place="${place}">Save</button>
            </div>
        `;
    });
    return html;
};

// --- Public View Logic ---

const calculateTeamScores = () => {
    const teamScores = {};
    (data.teams || []).forEach(team => { teamScores[team.name] = 0; });

    const categoryScores = {};
    (data.categories || []).forEach(category => {
        categoryScores[category.name] = {};
        (data.teams || []).forEach(team => { categoryScores[category.name][team.name] = 0; });
    });

    (data.competitions || []).forEach(comp => {
        const category = (data.categories || []).find(cat => cat.id === comp.categoryId);
        if (!category) return;
        (comp.results || []).forEach(result => {
            const points = SCORE_POINTS[result.place];
            if (points && result.team && teamScores.hasOwnProperty(result.team)) {
                teamScores[result.team] += points;
                categoryScores[category.name][result.team] += points;
            }
        });
    });

    const sortScores = (scores) => Object.entries(scores).sort(([, a], [, b]) => b - a);
    const sortedOverall = sortScores(teamScores);
    const sortedCategories = Object.keys(categoryScores).reduce((acc, cat) => {
        acc[cat] = sortScores(categoryScores[cat]);
        return acc;
    }, {});

    return { overall: sortedOverall, categories: sortedCategories };
};

const renderPublicView = () => {
    const scores = calculateTeamScores();

    const createTable = (headers, rows) => {
        const table = document.createElement('table');
        table.className = 'result-table';
        table.innerHTML = `
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        `;
        return table;
    };

    resultsContainer.innerHTML = '';

    const overallSection = document.createElement('section');
    overallSection.innerHTML = '<h3>Overall Team Leaderboard</h3>';
    if (scores.overall.length > 0) {
        const rows = scores.overall.map(([team, score], i) => [i + 1, team, score]);
        overallSection.appendChild(createTable(['Rank', 'Team', 'Score'], rows));
    } else {
        overallSection.innerHTML += '<p class="no-results-msg">No team scores yet.</p>';
    }
    resultsContainer.appendChild(overallSection);

    Object.keys(scores.categories).forEach(catName => {
        const catSection = document.createElement('section');
        catSection.innerHTML = `<h3>${catName} Leaderboard</h3>`;
        const catScores = scores.categories[catName].filter(([, score]) => score > 0);
        if (catScores.length > 0) {
            const rows = catScores.map(([team, score], i) => [i + 1, team, score]);
            catSection.appendChild(createTable(['Rank', 'Team', 'Score'], rows));
        } else {
            catSection.innerHTML += '<p class="no-results-msg">No scores for this category yet.</p>';
        }
        resultsContainer.appendChild(catSection);
    });

    populatePublicFilters();
};

const populatePublicFilters = () => {
    const populate = (select, data, defaultOption) => {
        select.innerHTML = `<option value="">${defaultOption}</option>`;
        (data || []).forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });
    };
    populate(publicCategoryFilter, data.categories, 'All Categories');
    populate(publicCompetitionFilter, data.competitions, 'All Competitions');
};

const filterPublicResults = () => {
    const compId = publicCompetitionFilter.value;
    const catId = publicCategoryFilter.value;

    if (!compId && !catId) {
        renderPublicView();
        return;
    }

    resultsContainer.innerHTML = '';
    let filteredComps = data.competitions || [];
    if (catId) filteredComps = filteredComps.filter(c => c.categoryId == catId);
    if (compId) filteredComps = filteredComps.filter(c => c.id == compId);

    if (filteredComps.length > 0) {
        filteredComps.forEach(comp => {
            const cat = (data.categories || []).find(c => c.id === comp.categoryId);
            const section = document.createElement('section');
            section.innerHTML = `<h3>${comp.name} - ${cat ? cat.name : 'Unknown'}</h3>`;
            const results = comp.results || [];
            if (results.length > 0) {
                const rows = results.map(r => [r.place, r.name, r.class, r.team]);
                section.appendChild(createTable(['Place', 'Student', 'Class', 'Team'], rows));
            } else {
                section.innerHTML += '<p class="no-results-msg">No results entered for this competition.</p>';
            }
            resultsContainer.appendChild(section);
        });
    } else {
        resultsContainer.innerHTML = '<p class="no-results-msg">No competitions match the selected filters.</p>';
    }
};

// --- Admin Actions ---

const deleteCategory = (id) => {
    data.categories = (data.categories || []).filter(cat => cat.id !== id);
    data.competitions = (data.competitions || []).filter(comp => comp.categoryId !== id);
    if (currentCategory && currentCategory.id === id) {
        currentCategory = null;
        competitionEntry.classList.add('hidden');
    }
    saveData();
    alert("Category and its competitions deleted.");
};

const handleEditCompetition = (id) => {
    const competition = (data.competitions || []).find(comp => comp.id == id);
    if (competition) {
        const newName = prompt("Enter new competition name:", competition.name);
        if (newName && newName.trim()) {
            competition.name = newName.trim();
            saveData();
            alert("Competition name updated.");
        }
    }
};

const handleDeleteCompetition = (id) => {
    if (confirm("Are you sure you want to delete this competition?")) {
        data.competitions = (data.competitions || []).filter(comp => comp.id != id);
        saveData();
        alert("Competition deleted.");
    }
};

const handleSaveResult = (e) => {
    const compCard = e.target.closest('.competition-card');
    const compId = compCard.querySelector('.result-entry-form').dataset.id;
    const competition = (data.competitions || []).find(comp => comp.id == compId);

    if (competition) {
        const place = e.target.dataset.place;
        const studentRow = e.target.closest('.student-row');
        const name = studentRow.querySelector('.student-name-input').value.trim();
        const studentClass = studentRow.querySelector('.student-class-input').value.trim();
        const team = studentRow.querySelector('.student-team-select').value;

        if (!competition.results) competition.results = [];

        const newResult = { name, place, class: studentClass, team };
        const index = competition.results.findIndex(r => r.place === place);

        if (index !== -1) {
            competition.results[index] = newResult;
        } else {
            competition.results.push(newResult);
        }
        saveData();
        alert(`Result for ${place} place saved.`);
    }
};


// --- Event Listeners Setup ---

const setupEventListeners = () => {
    adminLoginBtn.addEventListener('click', () => {
        adminPanel.classList.toggle('hidden');
        publicView.classList.toggle('hidden');
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (adminPasswordInput.value === ADMIN_PASSWORD) {
            loginForm.classList.add('hidden');
            adminContent.classList.remove('hidden');
            alert("Login successful!");
        } else {
            alert("Incorrect password.");
        }
        adminPasswordInput.value = '';
    });

    addCategoryBtn.addEventListener('click', () => addCategoryForm.classList.toggle('hidden'));
    addTeamBtn.addEventListener('click', () => addTeamForm.classList.toggle('hidden'));

    submitCategoryBtn.addEventListener('click', () => {
        const name = categoryNameInput.value.trim();
        if (name) {
            data.categories.push({ id: generateUniqueId(), name });
            saveData();
            categoryNameInput.value = ''; // Clear input but keep form open
            alert("Category created.");
        } else {
            alert("Please enter a category name.");
        }
    });

    submitTeamBtn.addEventListener('click', () => {
        const name = teamNameInput.value.trim();
        if (name) {
            data.teams.push({ id: generateUniqueId(), name });
            saveData();
            teamNameInput.value = ''; // Clear input but keep form open
            alert("Team created.");
        } else {
            alert("Please enter a team name.");
        }
    });

    addCompetitionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = competitionNameInput.value.trim();
        if (name && currentCategory) {
            data.competitions.push({
                id: generateUniqueId(),
                categoryId: currentCategory.id,
                name,
                results: []
            });
            saveData();
            competitionNameInput.value = '';
            alert("Competition added.");
        } else {
            alert("Please select a category and enter a name.");
        }
    });

    publicCategoryFilter.addEventListener('change', filterPublicResults);
    publicCompetitionFilter.addEventListener('change', filterPublicResults);

    // Global listener for dynamically created buttons
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.classList.contains('close-form-btn')) {
            const formId = target.dataset.form;
            document.getElementById(formId).classList.add('hidden');
        }

        const compId = target.dataset.id;
        if (target.classList.contains('edit-comp-btn')) handleEditCompetition(compId);
        if (target.classList.contains('delete-comp-btn')) handleDeleteCompetition(compId);
        if (target.classList.contains('save-result-btn')) handleSaveResult(e);
    });
};

// --- Initialization ---

const init = () => {
    database.ref(STORAGE_KEY).on('value', (snapshot) => {
        const firebaseData = snapshot.val();
        
        const defaultData = { categories: [], teams: [], competitions: [] };
        data = { ...defaultData, ...firebaseData };

        console.log("Data synchronized with Firebase:", data);

        renderCategoryTabs();
        renderPublicView();
        if (currentCategory) {
            renderCompetitions();
        }
    });

    setupEventListeners();
};

// Start the application
init();