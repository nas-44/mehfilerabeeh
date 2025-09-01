// --- Data and Constants ---
const ADMIN_PASSWORD = "nas";
const STORAGE_KEY = "artsFestData";
const SCORE_POINTS = { '1st': 10, '2nd': 7, '3rd': 5 };

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
const resultsContainer = document.getElementById('results-container');
const backToPublicBtn = document.getElementById('back-to-public-btn');

// --- Global State ---
let data = {};
let currentCategory = null;
const database = firebase.database();

// --- Helper Functions ---
const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
const saveData = () => database.ref(STORAGE_KEY).set(data);

// --- Rendering Functions ---

const renderCategoryTabs = () => {
    categoryTabsContainer.innerHTML = '';
    (data.categories || []).forEach(category => {
        const tab = document.createElement('div');
        tab.className = 'category-tab';
        tab.textContent = category.name;
        tab.dataset.id = category.id;
        if (currentCategory && category.id === currentCategory.id) tab.classList.add('active');

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
            if (confirm(`Delete "${category.name}" and all its competitions?`)) deleteCategory(category.id);
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
        const isPublished = comp.isPublished || false;
        const publishBtnText = isPublished ? 'Unpublish' : 'Publish';
        const publishBtnClass = isPublished ? 'unpublish-btn' : 'publish-btn';

        const compCard = document.createElement('div');
        compCard.className = 'competition-card';
        compCard.innerHTML = `
            <h4>${comp.name}</h4>
            <div class="edit-delete-buttons">
                <button class="generate-competition-poster-btn" data-id="${comp.id}">List Poster</button>
                <button class="${publishBtnClass}" data-id="${comp.id}">${publishBtnText}</button>
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
    (data.teams || []).forEach(team => teamScores[team.name] = 0);
    const categoryScores = {};
    (data.categories || []).forEach(category => {
        categoryScores[category.name] = {};
        (data.teams || []).forEach(team => categoryScores[category.name][team.name] = 0);
    });
    const publishedCompetitions = (data.competitions || []).filter(comp => comp.isPublished);
    publishedCompetitions.forEach(comp => {
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
    const sortScores = scores => Object.entries(scores).sort(([, a], [, b]) => b - a);
    return {
        overall: sortScores(teamScores),
        categories: Object.keys(categoryScores).reduce((acc, cat) => ({...acc, [cat]: sortScores(categoryScores[cat])}), {})
    };
};

const renderPublicView = () => {
    const scores = calculateTeamScores();
    resultsContainer.innerHTML = '';
    const createTable = (headers, rows) => {
        const table = document.createElement('table');
        table.className = 'result-table';
        table.innerHTML = `
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        `;
        return table;
    };
    const overallSection = document.createElement('section');
    overallSection.innerHTML = '<h3>Overall Team Leaderboard</h3>';
    if (scores.overall.length > 0 && scores.overall.some(s => s[1] > 0)) {
        const rows = scores.overall.map(([team, score], i) => [i + 1, team, score]);
        overallSection.appendChild(createTable(['Rank', 'Team', 'Score'], rows));
    } else {
        overallSection.innerHTML += '<p class="no-results-msg">No published results to display.</p>';
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
            catSection.innerHTML += `<p class="no-results-msg">No published results for ${catName} yet.</p>`;
        }
        resultsContainer.appendChild(catSection);
    });
};

// --- Admin Actions ---

const generateCompetitionPoster = (compId) => {
    const competition = (data.competitions || []).find(c => c.id === compId);
    const category = (data.categories || []).find(c => c.id === competition.categoryId);
    if (!competition) {
        alert("Competition data not found.");
        return;
    }

    const canvas = document.getElementById('poster-canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    const dome = new Image();
    dome.src = 'dome.png';

    dome.onload = () => {
        // 1. The Background
        const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
        gradient.addColorStop(0, '#1c233f');
        gradient.addColorStop(1, '#0c0d14');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Subtle Edge Glow
        const edgeGlowGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        edgeGlowGradient.addColorStop(0, 'rgba(255, 215, 0, 0.05)');
        edgeGlowGradient.addColorStop(0.5, 'rgba(255, 215, 0, 0)');
        edgeGlowGradient.addColorStop(1, 'rgba(255, 215, 0, 0.05)');
        ctx.fillStyle = edgeGlowGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);


        // 3. The Dome: Moved downward for better composition.
        ctx.globalAlpha = 0.2;
        const domeWidth = 750;
        const domeHeight = domeWidth * (dome.height / dome.width);
        const domeX = (canvas.width / 2) - (domeWidth / 2);
        const domeY = canvas.height - domeHeight + 50; // Increased Y value moves it down
        ctx.drawImage(dome, domeX, domeY, domeWidth, domeHeight);
        ctx.globalAlpha = 1.0;

        // 4. The Main Logo Text
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = "120px 'Ramadhan Amazing', sans-serif";
        ctx.fillText("Mehfile RabeeE", canvas.width / 2, 140);
        
        // "meelad fest" text size increased and position adjusted
        ctx.font = "85px 'Ramadhan Amazing', sans-serif";
        ctx.fillText("meelad fest", canvas.width / 2, 220);


        // 5. The "WINNERS" Subtitle
        ctx.font = "bold 30px 'Poppins', sans-serif";
        ctx.fillText((category.name.toUpperCase() + " - " + competition.name.toUpperCase()), canvas.width / 2, 290); // Adjusted Y
        
        const winnerTextGradient = ctx.createLinearGradient(0, 300, 0, 400);
        winnerTextGradient.addColorStop(0, '#FFD700');
        winnerTextGradient.addColorStop(1, '#FFA500');
        ctx.fillStyle = winnerTextGradient;
        ctx.font = "bold 90px 'Poppins', sans-serif";
        ctx.fillText('WINNERS', canvas.width / 2, 380);

        // 6. The Winners List
        const sortedResults = (competition.results || [])
            .filter(r => r.name)
            .sort((a, b) => parseInt(a.place) - parseInt(b.place));

        let startY = 520;
        sortedResults.forEach((winner, index) => {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(200, startY - 20, 40, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.fillStyle = '#0c0d14';
            ctx.font = "bold 40px 'Poppins', sans-serif";
            ctx.textAlign = 'center';
            ctx.fillText(index + 1, 200, startY - 8);

            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'left';
            ctx.font = "bold 55px 'Poppins', sans-serif";
            ctx.fillText(winner.name.toUpperCase(), 280, startY);
            ctx.font = "30px 'Poppins', sans-serif";
            ctx.fillStyle = '#DDDDDD';
            ctx.fillText(winner.team || '', 280, startY + 40);

            startY += 150;
        });

        // 7. The Footer
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.font = "bold 28px 'Poppins', sans-serif";
        ctx.fillText('HAYATHUL ISLAM HIGHER SECONDARY MADRASA', canvas.width / 2, 980);
        ctx.font = "bold 24px 'Poppins', sans-serif";
        ctx.fillText('Muringampurayi, Mukkam', canvas.width / 2, 1020);

        // --- Trigger Download ---
        const link = document.createElement('a');
        link.download = `Winners - ${competition.name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
    dome.onerror = () => {
        alert("Could not generate poster. Make sure 'dome.png' is in your project folder.");
    };
};

const handlePublishToggle = (id) => {
    const comp = (data.competitions || []).find(c => c.id == id);
    if (comp) {
        comp.isPublished = !comp.isPublished;
        saveData();
        const action = comp.isPublished ? "published" : "hidden";
        alert(`Competition "${comp.name}" is now ${action}.`);
    }
};

const deleteCategory = (id) => {
    data.categories = (data.categories || []).filter(cat => cat.id !== id);
    data.competitions = (data.competitions || []).filter(comp => comp.categoryId !== id);
    if (currentCategory && currentCategory.id === id) {
        currentCategory = null;
        competitionEntry.classList.add('hidden');
    }
    saveData();
    alert("Category deleted.");
};

const handleEditCompetition = (id) => {
    const comp = (data.competitions || []).find(c => c.id == id);
    if (comp) {
        const newName = prompt("Enter new name:", comp.name);
        if (newName && newName.trim()) {
            comp.name = newName.trim();
            saveData();
            alert("Competition updated.");
        }
    }
};

const handleDeleteCompetition = (id) => {
    if (confirm("Delete this competition?")) {
        data.competitions = (data.competitions || []).filter(comp => comp.id != id);
        saveData();
        alert("Competition deleted.");
    }
};

const handleSaveAllResults = (compId) => {
    const comp = (data.competitions || []).find(c => c.id == compId);
    if (!comp) return;
    const resultForm = document.querySelector(`.result-entry-form[data-id="${compId}"]`);
    const studentRows = resultForm.querySelectorAll('.student-row');
    const newResults = [];
    studentRows.forEach(row => {
        const name = row.querySelector('.student-name-input').value.trim();
        if (name) {
            newResults.push({
                place: row.dataset.place,
                name: name,
                class: row.querySelector('.student-class-input').value.trim(),
                team: row.querySelector('.student-team-select').value
            });
        }
    });
    comp.results = newResults;
    saveData();
    alert(`Results for "${comp.name}" saved.`);
};

// --- Event Listeners Setup ---
const setupEventListeners = () => {
    const toggleAdminView = () => {
        adminPanel.classList.toggle('hidden');
        publicView.classList.toggle('hidden');
    };
    adminLoginBtn.addEventListener('click', toggleAdminView);
    backToPublicBtn.addEventListener('click', toggleAdminView);

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (adminPasswordInput.value === ADMIN_PASSWORD) {
            loginForm.classList.add('hidden');
            adminContent.classList.remove('hidden');
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
            if (!data.categories) data.categories = [];
            data.categories.push({ id: generateUniqueId(), name });
            saveData();
            categoryNameInput.value = '';
        }
    });

    submitTeamBtn.addEventListener('click', () => {
        const name = teamNameInput.value.trim();
        if (name) {
            if (!data.teams) data.teams = [];
            data.teams.push({ id: generateUniqueId(), name });
            saveData();
            teamNameInput.value = '';
        }
    });

    addCompetitionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = competitionNameInput.value.trim();
        if (name && currentCategory) {
            if (!data.competitions) data.competitions = [];
            data.competitions.push({ id: generateUniqueId(), categoryId: currentCategory.id, name, results: [], isPublished: false });
            saveData();
            competitionNameInput.value = '';
        }
    });

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('close-form-btn')) {
            document.getElementById(target.dataset.form).classList.add('hidden');
        }
        const compId = target.dataset.id;
        if (target.classList.contains('publish-btn') || target.classList.contains('unpublish-btn')) handlePublishToggle(compId);
        if (target.classList.contains('edit-comp-btn')) handleEditCompetition(compId);
        if (target.classList.contains('delete-comp-btn')) handleDeleteCompetition(compId);
        if (target.classList.contains('save-all-results-btn')) handleSaveAllResults(compId);
        
        if (target.classList.contains('generate-competition-poster-btn')) {
            generateCompetitionPoster(compId);
        }
    });
};

// --- Initialization ---
const init = () => {
    database.ref(STORAGE_KEY).on('value', (snapshot) => {
        const firebaseData = snapshot.val();
        const defaultData = { categories: [], teams: [], competitions: [] };
        data = { ...defaultData, ...firebaseData };
        
        renderCategoryTabs();
        renderPublicView();
        if (currentCategory) {
            const categoryStillExists = (data.categories || []).some(c => c.id === currentCategory.id);
            if (categoryStillExists) {
                renderCompetitions();
            } else {
                currentCategory = null;
                competitionEntry.classList.add('hidden');
            }
        }
    });
    setupEventListeners();
};

init();