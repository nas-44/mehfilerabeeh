// --- Constants and State ---
const STORAGE_KEY = "artsFestData";
let allData = {};
const database = firebase.database();

// --- DOM Elements ---
const categorySelect = document.getElementById('category-select');
const competitionSelect = document.getElementById('competition-select');
const resultsContainer = document.getElementById('individual-results-container');

// --- Functions ---

const createTable = (headers, rows) => {
    const table = document.createElement('table');
    table.className = 'result-table';
    table.innerHTML = `
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    `;
    return table;
};

const renderSelectedCompetition = () => {
    const selectedCompId = competitionSelect.value;
    resultsContainer.innerHTML = '';

    if (!selectedCompId) {
        resultsContainer.innerHTML = '<p class="no-results-msg">Select a competition to view the results.</p>';
        return;
    }

    const competition = (allData.competitions || []).find(comp => comp.id === selectedCompId);
    if (!competition) return;

    const category = (allData.categories || []).find(cat => cat.id === competition.categoryId);
    const section = document.createElement('section');
    section.innerHTML = `<h3>${competition.name} - ${category ? category.name : 'Unknown'}</h3>`;

    const results = competition.results || [];
    const sortedResults = results.sort((a, b) => parseInt(a.place) - parseInt(b.place));

    if (sortedResults.length > 0 && sortedResults.some(r => r.name)) {
        const rows = sortedResults.map(r => [r.place, r.name, r.class, r.team]);
        section.appendChild(createTable(['Place', 'Student', 'Class', 'Team'], rows));
    } else {
        section.innerHTML += '<p class="no-results-msg">No results have been entered for this competition yet.</p>';
    }
    resultsContainer.appendChild(section);
};

const populateCompetitionFilter = () => {
    const selectedCategoryId = categorySelect.value;
    competitionSelect.innerHTML = '<option value="">-- Choose a competition --</option>'; // Reset
    
    if (!selectedCategoryId) return;

    const competitions = (allData.competitions || [])
        .filter(comp => comp.categoryId === selectedCategoryId)
        .sort((a, b) => a.name.localeCompare(b.name));

    competitions.forEach(comp => {
        const option = document.createElement('option');
        option.value = comp.id;
        option.textContent = comp.name;
        competitionSelect.appendChild(option);
    });
};

const populateCategoryFilter = () => {
    const categories = (allData.categories || []).sort((a, b) => a.name.localeCompare(b.name));
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
};

const init = () => {
    database.ref(STORAGE_KEY).on('value', (snapshot) => {
        const firebaseData = snapshot.val();
        const defaultData = { categories: [], teams: [], competitions: [] };
        allData = { ...defaultData, ...firebaseData };

        console.log("Data loaded for results page:", allData);
        populateCategoryFilter();
    });

    categorySelect.addEventListener('change', () => {
        populateCompetitionFilter();
        resultsContainer.innerHTML = '<p class="no-results-msg">Select a competition to view the results.</p>';
    });
    competitionSelect.addEventListener('change', renderSelectedCompetition);
};

init();