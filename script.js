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

const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

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
                <button class="save-all-results-btn" data-id="${comp.id}">Save All Results</button>
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
            <div class="student-row" data-place="${place}">
                <label>${place}:</label>
                <input type="text" class="student-name-input" placeholder="Student Name" value="${result.name}">
                <input type="text" class="student-class-input" placeholder="Class" value="${result.class}">
                <select class="student-team-select">
                    <option value="">Select Team</option>
                    ${(data.teams || []).map(team => `<option value="${team.name}" ${team.name === result.team ? 'selected' : ''}>${team.name}</option>`).join('')}
                </select>
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
    resultsContainer.innerHTML = ''; // Clear previous content

    const createTable = (headers, rows) => {
        const table = document.createElement('table');
        table.className = 'result-table';
        table.innerHTML = `
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        `;
        return table;
    };

    // Render Overall Leaderboard
    const overallSection = document.createElement('section');
    overallSection.innerHTML = '<h3>Overall Team Leaderboard</h3>';
    if (scores.overall.length > 0) {
        const rows = scores.overall.map(([team, score], i) => [i + 1, team, score]);
        overallSection.appendChild(createTable(['Rank', 'Team', 'Score'], rows));
    } else {
        overallSection.innerHTML += '<p class="no-results-msg">No team scores yet.</p>';
    }
    resultsContainer.appendChild(overallSection);

    // Render Category-wise Leaderboards
    Object.keys(scores.categories).forEach(catName => {
        const catSection = document.createElement('section');
        catSection.innerHTML = `<h3>${catName} Leaderboard</h3>`;
        const catScores = scores.categories[catName].filter(([, score]) => score > 0);
        if (catScores.length > 0) {
            const rows = catScores.map(([team, score], i) => [i + 1, team, score]);
            catSection.appendChild(createTable(['Rank', 'Team', 'Score'], rows));
        } else {
            catSection.innerHTML += `<p class="no-results-msg">No scores for ${catName} yet.</p>`;
        }
        resultsContainer.appendChild(catSection);
    });
    
    // NEW: Render Individual Competition Results
    renderIndividualResults();
    populatePublicFilters();
};

const renderIndividualResults = (competitions = data.competitions || []) => {
    const individualResultsSection = document.createElement('section');
    individualResultsSection.id = 'individual-results';
    individualResultsSection.innerHTML = '<h3>Individual Competition Results</h3>';
    
    if (competitions.length > 0) {
        competitions.forEach(comp => {
            const cat = (data.categories || []).find(c => c.id === comp.categoryId);
            const compResultsDiv = document.createElement('div');
            compResultsDiv.innerHTML = `<h4>${comp.name} - ${cat ? cat.name : 'Unknown'}</h4>`;
            
            const results = comp.results || [];
            if (results.length > 0 && results.some(r => r.name)) {
                const rows = results.map(r => [r.place, r.name, r.class, r.team]);
                compResultsDiv.appendChild(createTable(['Place', 'Student', 'Class', 'Team'], rows));
            } else {
                compResultsDiv.innerHTML += '<p class="no-results-msg">No results entered for this competition yet.</p>';
            }
            individualResultsSection.appendChild(compResultsDiv);
        });
    } else {
        individualResultsSection.innerHTML += '<p class="no-results-msg">No competitions to display.</p>';
    }
    // Append at the end of the main results container
    resultsContainer.appendChild(individualResultsSection);
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
        renderPublicView(); // If filters cleared, show everything
        return;
    }

    let filteredComps = data.competitions || [];
    if (catId) filteredComps = filteredComps.filter(c => c.categoryId == catId);
    if (compId) filteredComps = filteredComps.filter(c => c.id == compId);
    
    // Clear the view and render only the individual results for the filtered competitions
    resultsContainer.innerHTML = '';
    renderIndividualResults(filteredComps);
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

const handleSaveAllResults = (compId) => {
    const competition = (data.competitions || []).find(comp => comp.id == compId);
    if (!competition) return;

    const resultForm = document.querySelector(`.result-entry-form[data-id="${compId}"]`);
    const studentRows = resultForm.querySelectorAll('.student-row');
    
    const newResults = [];
    studentRows.forEach(row => {
        const place = row.dataset.place;
        const name = row.querySelector('.student-name-input').value.trim();
        const studentClass = row.querySelector('.student-class-input').value.trim();
        const team = row.querySelector('.student-team-select').value;
        
        // Only add the result if a student name has been entered
        if (name) {
            newResults.push({ name, place, class: studentClass, team });
        }
    });

    competition.results = newResults;
    saveData();
    alert(`Results for "${competition.name}" saved successfully!`);
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
            categoryNameInput.value = '';
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
            teamNameInput.value = '';
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

    document.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.classList.contains('close-form-btn')) {
            document.getElementById(target.dataset.form).classList.add('hidden');
        }

        const compId = target.dataset.id;
        if (target.classList.contains('edit-comp-btn')) handleEditCompetition(compId);
        if (target.classList.contains('delete-comp-btn')) handleDeleteCompetition(compId);
        if (target.classList.contains('save-all-results-btn')) handleSaveAllResults(compId);
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
            const updatedCategory = (data.categories || []).find(c => c.id === currentCategory.id);
            if (updatedCategory) {
                currentCategory = updatedCategory;
                renderCompetitions();
            } else {
                currentCategory = null;
                competitionEntry.classList.add('hidden');
            }
        }
    });

    setupEventListeners();
};

// Start the application
init();