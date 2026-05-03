// ===== CONFIGURATION =====
// Replace this with your actual Formspree Form ID from Step 1
const FORMSPREE_FORM_ID = 'mdabagdv'; // Pedro's Galvão Ortopedia Form

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

// ===== VAS SLIDER (Canvas-based) =====
function initVASCanvas() {
    const canvas = document.getElementById('vas-canvas');
    const ctx = canvas.getContext('2d');
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    let isDragging = false;
    
    function drawVAS() {
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);
        
        // Draw track
        const trackY = h / 2;
        const trackStart = 30;
        const trackEnd = w - 30;
        
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(trackStart, trackY);
        ctx.lineTo(trackEnd, trackY);
        ctx.stroke();
        
        // Draw circle (thumb)
        const percent = appState.vasScore / 10;
        const circleX = trackStart + (trackEnd - trackStart) * percent;
        const circleY = trackY;
        const circleRadius = 16;
        
        ctx.fillStyle = isDragging ? '#27AAE1' : '#044767';
        ctx.beginPath();
        ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(appState.vasScore, circleX, circleY);
        
        // Draw tick marks
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = trackStart + (trackEnd - trackStart) * (i / 10);
            ctx.beginPath();
            ctx.moveTo(x, trackY - 8);
            ctx.lineTo(x, trackY + 8);
            ctx.stroke();
        }
    }
    
    function updateEmojiAndScore() {
        const emojis = ['😊', '😌', '😐', '😕', '😟', '😣', '😤', '😫', '😩', '😭', '😭'];
        document.getElementById('emoji-display').textContent = emojis[appState.vasScore];
        document.getElementById('vas-score-display').textContent = appState.vasScore;
    }
    
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        updateVASFromEvent(e);
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) updateVASFromEvent(e);
    });
    
    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        drawVAS();
    });
    
    canvas.addEventListener('touchstart', (e) => {
        isDragging = true;
        updateVASFromEvent(e.touches[0]);
    });
    
    canvas.addEventListener('touchmove', (e) => {
        if (isDragging) updateVASFromEvent(e.touches[0]);
    });
    
    canvas.addEventListener('touchend', () => {
        isDragging = false;
        drawVAS();
    });
    
    function updateVASFromEvent(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const trackStart = 30;
        const trackEnd = rect.width - 30;
        const percent = Math.max(0, Math.min(1, (x - trackStart) / (trackEnd - trackStart)));
        appState.vasScore = Math.round(percent * 10);
        updateEmojiAndScore();
        drawVAS();
    }
    
    drawVAS();
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
    }
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
    
    // Try to send to Formspree
    if (FORMSPREE_FORM_ID !== 'YOUR_FORMSPREE_ID_HERE') {
        try {
            const response = await fetch(`https://formspree.io/f/${FORMSPREE_FORM_ID}`, {
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
                console.log('Data sent to Formspree!');
            } else {
                console.log('Formspree error, but data saved locally');
            }
        } catch (e) {
            console.log('Network error, data saved locally:', e);
        }
    } else {
        console.log('Formspree ID not configured. Data saved locally.');
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
    appState = {
        ...appState,
        patientName: '',
        patientAge: '',
        patientGender: '',
        vasScore: 0,
        generalNotes: '',
        selectedRegions: {},
        consentGiven: false
    };
    
    // Clear form inputs
    document.getElementById('patient-name').value = '';
    document.getElementById('patient-age').value = '';
    document.getElementById('patient-gender').value = '';
    document.getElementById('general-notes').value = '';
    document.getElementById('consent-checkbox').checked = false;
    document.getElementById('regions-container').innerHTML = '<p class="text-xs text-gray-500">Nenhuma região selecionada</p>';
    
    // Reset VAS
    initVASCanvas();
    
    // Reset message
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
    const saved = localStorage.getItem('vasAppState');
    if (saved) {
        appState = { ...appState, ...JSON.parse(saved) };
    }
}
