// --- Constants and State ---
const STORAGE_KEY = "artsFestData";
let allData = {};
const database = firebase.database();
let tempPosterData = null; 
let cropper = null; 
let cameraStream = null; 

// --- DOM Elements ---
const categorySelect = document.getElementById('category-select');
const competitionSelect = document.getElementById('competition-select');
const resultsContainer = document.getElementById('individual-results-container');
const imageUploader = document.getElementById('image-uploader');
const choiceModal = document.getElementById('choice-modal');
const cropperModal = document.getElementById('cropper-modal');
const cameraModal = document.getElementById('camera-modal');

/**
 * FINAL, PROFESSIONAL REDESIGN (Individual Poster): A complete overhaul based on user
 * feedback, focusing on a dynamic layout, professional typography, and sophisticated graphics.
 */
const generateIndividualPoster = (imageSrc, posterData) => {
    const canvas = document.getElementById('poster-canvas');
    canvas.width = 1080;
    canvas.height = 1350; // Taller format for better layout
    const ctx = canvas.getContext('2d');

    const studentImg = new Image();
    studentImg.crossOrigin = "Anonymous";
    const bgImg = new Image();
    bgImg.src = 'bg.png'; // Using the dome as a background element

    bgImg.onload = () => {
        studentImg.onload = () => {
            // --- START DRAWING ---

            // 1. Background: Dark blue gradient
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#1d2b4a');
            gradient.addColorStop(1, '#1e2b5dff');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Background Image (bg) - Subtle and faded
            ctx.globalAlpha = 0.1; // Make it very subtle
            ctx.drawImage(bgImg, canvas.width / 4 - bgImg.width / 4, canvas.height - bgImg.height + 180, bgImg.width, bgImg.height);
            ctx.globalAlpha = 1.0;

            // 3. Main Logo (Top Center)
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFFFFF';
            ctx.font = "110px 'Ramadhan Amazing', sans-serif";
            ctx.fillText("Mehfile RabeeE", canvas.width / 2, 150);
            ctx.font = "120px 'Ramadhan Amazing', sans-serif";
            ctx.fillText("meelad fest", canvas.width / 2, 230);

            // 4. "CONGRATULATIONS" Title - FONT SIZE INCREASED
            ctx.font = "bold 75px 'Poppins', sans-serif"; // Increased from 55px to 60px
            ctx.fillStyle = '#FFD700'; // Gold color
            ctx.shadowColor = 'rgba(247, 244, 228, 0.5)';
            ctx.shadowBlur = 15;
            ctx.fillText('CONGRATULATIONS', canvas.width / 2, 320);
            ctx.shadowBlur = 0; // Reset shadow

            // 5. Student Image (Centered)
            const imgCenterY = 580;
            const radius = 200;
            ctx.save();
            ctx.beginPath();
            ctx.arc(canvas.width / 2, imgCenterY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 10;
            ctx.stroke();
            ctx.clip();
            ctx.drawImage(studentImg, canvas.width / 2 - radius, imgCenterY - radius, radius * 2, radius * 2);
            ctx.restore();

            // 6. Winner's Name - INCREASED DISTANCE FROM PHOTO
            // The Y-coordinate is increased to add more space below the photo.
            ctx.fillStyle = '#FFFFFF';
            let winnerFontSize = 120;
            ctx.font = `bold ${winnerFontSize}px 'Poppins', sans-serif`;
            while (ctx.measureText(posterData.name.toUpperCase()).width > canvas.width - 100) {
                winnerFontSize -= 5;
                ctx.font = `bold ${winnerFontSize}px 'Poppins', sans-serif`;
            }
            ctx.fillText(posterData.name.toUpperCase(), canvas.width / 2, 920); // Y increased from 900 to 920

            // 7. Prize Details (and subsequent text) - Shifted down to maintain spacing
            const prizeText = { '1st': 'FIRST PRIZE', '2nd': 'SECOND PRIZE', '3rd': 'THIRD PRIZE' }[posterData.place] || posterData.place.toUpperCase();
            ctx.fillStyle = '#FFD700';
            ctx.font = "bold 60px 'Poppins', sans-serif";
            ctx.fillText(prizeText, canvas.width / 2, 1020); // Y increased

            // 8. Competition and Team Name
            ctx.fillStyle = '#ffffffff';
            ctx.font = "bold 38px 'Poppins', sans-serif";
            ctx.fillText(posterData.competitionName.toUpperCase(), canvas.width / 2, 1080); // Y increased
            if (posterData.team) {
                ctx.fillText(`TEAM: ${posterData.team.toUpperCase()}`, canvas.width / 2, 1130); // Y increased
            }

            // 9. Footer
            ctx.fillStyle = '#FFFFFF';
            ctx.font = "bold 30px 'Poppins', sans-serif";
            ctx.fillText('HAYATHUL ISLAM HIGHER SECONDARY MADRASA', canvas.width / 2, canvas.height - 90);
            ctx.font = "24px 'Poppins', sans-serif";
            ctx.fillText('Muringampurayi, Mukkam', canvas.width / 2, canvas.height - 50);

            // --- Trigger Download ---
            const link = document.createElement('a');
            link.download = `Congratulations-${posterData.name}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        studentImg.src = imageSrc;
    };

    bgImg.onerror = () => {
        alert("Could not load background image. Make sure 'dome.png' is available.");
        // Fallback to drawing without the background image
        studentImg.onload();
    };
};

// --- UI and Data Functions (No changes below this line) ---
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
    const results = (competition.results || []).sort((a, b) => parseInt(a.place) - parseInt(b.place));

    if (results.length > 0 && results.some(r => r.name)) {
        const table = document.createElement('table');
        table.className = 'result-table';
        table.innerHTML = `<thead><tr><th>Place</th><th>Student</th><th>Class</th><th>Team</th><th>Action</th></tr></thead>`;
        const tbody = document.createElement('tbody');
        results.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.place || ''}</td>
                <td>${r.name || ''}</td>
                <td>${r.class || ''}</td>
                <td>${r.team || ''}</td>
                <td>
                    <button class="generate-public-poster-btn" 
                            data-name="${r.name || ''}"
                            data-place="${r.place || ''}"
                            data-team="${r.team || ''}"
                            data-competition-name="${competition.name || ''}">
                        Create Poster
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        section.appendChild(table);
    } else {
        section.innerHTML += '<p class="no-results-msg">No results have been entered for this competition yet.</p>';
    }
    resultsContainer.appendChild(section);
};

const populateCompetitionFilter = () => {
    const selectedCategoryId = categorySelect.value;
    competitionSelect.innerHTML = '<option value="">-- Choose a competition --</option>'; 
    if (!selectedCategoryId) return;
    const competitions = (allData.competitions || [])
        .filter(comp => comp.categoryId === selectedCategoryId && comp.isPublished)
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
    const publishedCompetitions = allData.competitions.filter(c => c.isPublished);
    const categoriesWithPublishedResults = categories.filter(cat => 
        publishedCompetitions.some(comp => comp.categoryId === cat.id)
    );
    categoriesWithPublishedResults.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
};

const closeModal = (modal) => {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    modal.classList.add('hidden');
};

const openCropperModal = (imageURL, file) => {
    cropperModal.classList.remove('hidden');
    const image = document.getElementById('image-to-crop');
    image.src = imageURL;
    
    const fileInfo = document.getElementById('file-info');
    if(file) {
        fileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    } else {
        fileInfo.textContent = 'your captured photo.';
    }

    if (cropper) {
        cropper.destroy();
    }
    cropper = new Cropper(image, {
        aspectRatio: 1,
        viewMode: 1,
        background: false,
        autoCropArea: 1,
    });
};

const openCameraModal = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera access is not supported by your browser.");
        return;
    }
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            cameraModal.classList.remove('hidden');
            const videoElement = document.getElementById('camera-stream');
            videoElement.srcObject = stream;
            cameraStream = stream;
        })
        .catch(err => {
            alert("Could not access the camera. Please ensure you grant permission.");
            console.error("Camera error:", err);
        });
};

const init = () => {
    database.ref(STORAGE_KEY).on('value', (snapshot) => {
        allData = { categories: [], teams: [], competitions: [], ...snapshot.val() };
        populateCategoryFilter();
    });

    categorySelect.addEventListener('change', () => {
        populateCompetitionFilter();
        resultsContainer.innerHTML = '<p class="no-results-msg">Select a competition to view the results.</p>';
    });
    competitionSelect.addEventListener('change', renderSelectedCompetition);

    resultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('generate-public-poster-btn')) {
            const button = e.target;
            tempPosterData = {
                name: button.dataset.name,
                place: button.dataset.place,
                team: button.dataset.team,
                competitionName: button.dataset.competitionName
            };
            choiceModal.classList.remove('hidden');
        }
    });

    imageUploader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                openCropperModal(event.target.result, file);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = null; 
    });

    document.getElementById('upload-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        imageUploader.click();
    });

    document.getElementById('camera-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        openCameraModal();
    });
    
    // MODIFIED: Event listeners now point to the new image files.
    document.getElementById('male-icon-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        generateIndividualPoster('boy.jpg', tempPosterData);
        tempPosterData = null;
    });
    
    document.getElementById('female-icon-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        generateIndividualPoster('girl.jpg', tempPosterData);
        tempPosterData = null;
    });

    document.getElementById('crop-confirm-btn').addEventListener('click', () => {
        if (cropper) {
            const croppedCanvas = cropper.getCroppedCanvas({ width: 500, height: 500 });
            generateIndividualPoster(croppedCanvas.toDataURL(), tempPosterData);
            closeModal(cropperModal);
            tempPosterData = null;
        }
    });
    
    document.getElementById('snapshot-btn').addEventListener('click', () => {
        const videoElement = document.getElementById('camera-stream');
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        canvas.getContext('2d').drawImage(videoElement, 0, 0);
        closeModal(cameraModal);
        openCropperModal(canvas.toDataURL('image/png'), null);
    });

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById(btn.dataset.modalId);
            closeModal(modal);
        });
    });
};

init();