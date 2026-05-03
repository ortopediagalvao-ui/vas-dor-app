// ===== CONFIGURATION =====
// Google Apps Script webhook - posts directly to Google Sheet
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyahmtTqaNNZKxHI7Qhur2YE1DV8jktuboJ-4e5OpCncHOjCv0lXv0MLMS3lA1_NYh6/exec';

// ===== STATE MANAGEMENT =====
let appState = {
    currentScreen: 'onboarding',
    patientName: '',
    patientAge: '',
    patientGender: '',
    vasScore: 0,
    generalNotes: '',
    selectedRegions: {},
    trackingId: '',
    consentGiven: false,
    measurements: []
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    initVASCanvas();
    setupBodyDiagramListeners();
    setupConsentListener();
    showScreen('onboarding');
    registerServiceWorker();
});

// ===== SERVICE WORKER (PWA) =====
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker registered!');
        } catch (e) {
            console.log('Service Worker registration failed:', e);
        }
    }
}

// ===== SCREEN NAVIGATION =====
function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(`screen-${screenName}`).classList.remove('hidden');
    appState.currentScreen = screenName;
    
    if (screenName === 'review') {
        populateReviewScreen();
    } else if (screenName === 'history') {
        populateHistoryScreen();
    }
}

function switchScreen(screenName) {
    // Validate consent before moving past consent screen
    if (screenName === 'patient-form' && !appState.consentGiven) {
        alert('Por favor, concorde com a coleta de dados para continuar.');
        return;
    }
    // Validate patient form before moving to VAS
    if (screenName === 'vas' && (!document.getElementById('patient-name').value || !document.getElementById('patient-age').value)) {
        alert('Por favor, preencha Nome e Idade.');
        return;
    }
    
    // Save form data if on patient-form
    if (appState.currentScreen === 'patient-form') {
        appState.patientName = document.getElementById('patient-name').value;
        appState.patientAge = document.getElementById('patient-age').value;
        appState.patientGender = document.getElementById('patient-gender').value;
    }
    
    // Save notes if on VAS screen
    if (appState.currentScreen === 'vas') {
        appState.generalNotes = document.getElementById('general-notes').value;
    }
    
    showScreen(screenName);
}

// ===== CONSENT HANDLER =====
function setupConsentListener() {
    document.getElementById('consent-checkbox').addEventListener('change', (e) => {
        appState.consentGiven = e.target.checked;
        document.getElementById('consent-next').disabled = !e.target.checked;
        document.getElementById('consent-next').classList.toggle('opacity-50', !e.target.checked);
        document.getElementById('consent-next').classList.toggle('cursor-not-allowed', !e.target.checked);
    });
}

// ===== VAS SLIDER (HTML5 Range Input - Mobile Friendly) =====
function initVASCanvas() {
    const vasInput = document.getElementById('vas-input');
    if (!vasInput) {
        console.warn('VAS slider input not found in DOM');
        return;
    }

    const emojis = ['😊', '😌', '😐', '😕', '😟', '😣', '😤', '😫', '😩', '😭', '😭'];

    function updateEmojiAndScore() {
        const score = parseInt(vasInput.value) || 0;
        appState.vasScore = score;
        document.getElementById('emoji-display').textContent = emojis[score];
        document.getElementById('vas-score-display').textContent = score;
    }

    // Sync visual state with current appState (handles reset + first load)
    vasInput.value = appState.vasScore || 0;

    // Attach listeners only once (idempotent across resetApp() calls)
    if (!vasInput.dataset.listenersAttached) {
        vasInput.addEventListener('input', updateEmojiAndScore);
        vasInput.addEventListener('change', updateEmojiAndScore);
        vasInput.dataset.listenersAttached = 'true';
    }

    updateEmojiAndScore();
}

// ===== BODY DIAGRAM =====
function setupBodyDiagramListeners() {
    document.querySelectorAll('.body-region').forEach(region => {
        region.addEventListener('click', () => {
            const regionName = region.getAttribute('data-region');
            openRegionVASModal(regionName);
        });
    });
}

function openRegionVASModal(regionName) {
    const vasScore = prompt(`Dor em "${regionName}" (0-10):`, appState.selectedRegions[regionName] || '0');
    if (vasScore !== null) {
        const score = Math.max(0, Math.min(10, parseInt(vasScore)));
        if (score > 0) {
            appState.selectedRegions[regionName] = score;
        } else {
            delete appState.selectedRegions[regionName];
        }
        updateRegionsList();
        updateBodySvgSelection();
    }
}

// Sync the SVG's visual highlighting with appState.selectedRegions
function updateBodySvgSelection() {
    document.querySelectorAll('.body-region').forEach(el => {
        const region = el.getAttribute('data-region');
        if (appState.selectedRegions[region]) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
}

function updateRegionsList() {
    const container = document.getElementById('regions-container');
    const regions = Object.keys(appState.selectedRegions);
    
    if (regions.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500">Nenhuma região selecionada</p>';
        return;
    }
    
    container.innerHTML = regions.map(region => 
        `<div class="flex justify-between items-center bg-galvao-light p-2 rounded text-sm">
            <span class="capitalize">${region}</span>
            <div class="flex gap-2">
                <span class="font-bold text-galvao-sky">${appState.selectedRegions[region]}/10</span>
                <button onclick="deleteRegion('${region}')" class="text-red-500 font-bold text-xs">✕</button>
            </div>
        </div>`
    ).join('');
}

function deleteRegion(regionName) {
    delete appState.selectedRegions[regionName];
    updateRegionsList();
    updateBodySvgSelection();
}

// ===== REVIEW SCREEN =====
function populateReviewScreen() {
    document.getElementById('review-name').textContent = appState.patientName || '—';
    document.getElementById('review-age').textContent = appState.patientAge || '—';
    document.getElementById('review-vas').textContent = `${appState.vasScore}/10`;
    
    const regions = Object.keys(appState.selectedRegions);
    document.getElementById('review-regions').textContent = regions.length > 0 
        ? regions.map(r => `${r} (${appState.selectedRegions[r]}/10)`).join(', ')
        : 'Nenhuma';
}

// ===== SUBMIT MEASUREMENT =====
async function submitMeasurement() {
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Enviando...';
    
    // Generate unique tracking ID if needed
    if (!appState.trackingId) {
        appState.trackingId = generateTrackingId();
    }
    
    const measurement = {
        timestamp: new Date().toISOString(),
        trackingId: appState.trackingId,
        name: appState.patientName,
        age: appState.patientAge,
        gender: appState.patientGender || '—',
        vasGeneral: appState.vasScore,
        regions: JSON.stringify(appState.selectedRegions),
        notes: appState.generalNotes,
        consent: appState.consentGiven
    };
    
    // Save to localStorage
    appState.measurements.push(measurement);
    saveToLocalStorage();
    
    // Try to send to Google Apps Script (which writes to Google Sheet)
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                'timestamp': measurement.timestamp,
                'tracking_id': measurement.trackingId,
                'name': measurement.name,
                'age': measurement.age,
                'gender': measurement.gender,
                'vas_general': measurement.vasGeneral,
                'regions': measurement.regions,
                'notes': measurement.notes,
                'consent': measurement.consent ? 'Sim' : 'Não'
            })
        });
        
        if (response.ok) {
            console.log('Data sent to Google Sheet!');
        } else {
            console.log('Google Sheets error, but data saved locally');
        }
    } catch (e) {
        console.log('Network error, data saved locally:', e);
    }
    
    // Show success message
    document.getElementById('submit-message').classList.remove('hidden');
    submitBtn.textContent = '✅ Salvo!';
    submitBtn.disabled = false;
    
    // Reset after 2 seconds
    setTimeout(() => {
        resetApp();
    }, 2000);
}

function resetApp() {
    // Preserve measurements history; reset everything patient-specific
    const measurementsHistory = appState.measurements || [];
    appState = {
        currentScreen: 'onboarding',
        patientName: '',
        patientAge: '',
        patientGender: '',
        vasScore: 0,
        generalNotes: '',
        selectedRegions: {},
        trackingId: '',          // critical: each patient gets a fresh ID
        consentGiven: false,
        measurements: measurementsHistory
    };
    saveToLocalStorage();

    // Clear form inputs
    document.getElementById('patient-name').value = '';
    document.getElementById('patient-age').value = '';
    document.getElementById('patient-gender').value = '';
    document.getElementById('general-notes').value = '';
    document.getElementById('consent-checkbox').checked = false;
    document.getElementById('regions-container').innerHTML = '<p class="text-xs text-gray-500">Nenhuma região selecionada</p>';

    // Clear the visual "selected" highlighting on every body-region in the SVG
    document.querySelectorAll('.body-region.selected').forEach(el => el.classList.remove('selected'));

    // Reset VAS slider to 0
    const vasInput = document.getElementById('vas-input');
    if (vasInput) vasInput.value = 0;
    initVASCanvas();

    // Reset submit button + message
    document.getElementById('submit-message').classList.add('hidden');
    document.getElementById('submit-btn').textContent = '💾 Salvar Medição';

    showScreen('onboarding');
}

// ===== HISTORY SCREEN =====
function populateHistoryScreen() {
    const historyList = document.getElementById('history-list');
    
    if (appState.measurements.length === 0) {
        historyList.innerHTML = '<p class="text-gray-500 text-sm">Nenhuma medição salva ainda.</p>';
        return;
    }
    
    historyList.innerHTML = appState.measurements.map((m, idx) => `
        <div class="bg-white rounded-lg p-4 shadow border-l-4 border-galvao-sky">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <p class="font-bold text-galvao-dark">${m.name || 'Anônimo'}</p>
                    <p class="text-xs text-gray-500">${new Date(m.timestamp).toLocaleString('pt-BR')}</p>
                </div>
                <button onclick="deleteMeasurement(${idx})" class="text-red-500 text-sm font-bold">Deletar</button>
            </div>
            <div class="flex gap-4 text-sm">
                <div>
                    <p class="text-xs text-gray-600">DOR GERAL</p>
                    <p class="font-bold text-galvao-sky">${m.vasGeneral}/10</p>
                </div>
                <div>
                    <p class="text-xs text-gray-600">REGIÕES</p>
                    <p class="font-bold text-galvao-dark">${Object.keys(JSON.parse(m.regions)).length}</p>
                </div>
            </div>
            <p class="text-xs text-gray-600 mt-2">ID: ${m.trackingId}</p>
        </div>
    `).join('');
}

function deleteMeasurement(idx) {
    if (confirm('Deletar esta medição?')) {
        appState.measurements.splice(idx, 1);
        saveToLocalStorage();
        populateHistoryScreen();
    }
}

// ===== CSV EXPORT =====
function exportCSV() {
    if (appState.measurements.length === 0) {
        alert('Nenhuma medição para exportar.');
        return;
    }
    
    let csv = 'Data/Hora,ID Rastreamento,Nome,Idade,Gênero,Dor Geral (0-10),Regiões com Dor,Notas\n';
    
    appState.measurements.forEach(m => {
        const regions = Object.entries(JSON.parse(m.regions))
            .map(([region, score]) => `${region} (${score})`)
            .join('; ');
        
        csv += `"${new Date(m.timestamp).toLocaleString('pt-BR')}","${m.trackingId}","${m.name}","${m.age}","${m.gender}","${m.vasGeneral}","${regions}","${m.notes}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `VAS_Dor_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ===== TRACKING ID GENERATION =====
function generateTrackingId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// ===== LOCAL STORAGE =====
function saveToLocalStorage() {
    localStorage.setItem('vasAppState', JSON.stringify(appState));
}

function loadFromLocalStorage() {
    // Restore ONLY the measurements history — never in-progress patient form data.
    // This ensures each new patient on a shared device starts with a clean slate.
    const saved = localStorage.getItem('vasAppState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.measurements)) {
                appState.measurements = parsed.measurements;
            }
        } catch (e) {
            console.warn('Could not parse saved state:', e);
        }
    }
}
