const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvasElement');
const imagePreview = document.getElementById('imagePreview');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const alertBox = document.getElementById('alertBox');
const logList = document.getElementById('logList');
const currentModeTxt = document.getElementById('currentModeDisplay');
const emptyLogMessage = document.getElementById('emptyLogMessage');

const uploadArea = document.getElementById('uploadArea');
const mediaInput = document.getElementById('mediaInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const personsCountTxt = document.getElementById('personsCount');
const currentActionTxt = document.getElementById('currentActionTxt');
const riskLevelTxt = document.getElementById('riskLevel');
const processingTimeTxt = document.getElementById('processingTime');
const liveUptimeTxt = document.getElementById('liveUptime');

let stream = null;
let detectionInterval = null;
let uptimeInterval = null;
let currentMode = 'camera'; 
let isSystemRunning = false;

let sessionStartTime = null;

let totalFallsCount = 0;
let totalFramesAnalyzed = 0;
let sumConfidence = 0;
let confidenceCount = 0;
let processingTimesArr = [];

let lastAlertTime = 0;
let alertCooldown = 5000;
let minFallConfidence = 0.50;
let audioEnabled = false;
let desktopNotifEnabled = false;
let showBoundingBoxes = true;

const modals = document.querySelectorAll('.modal');
const closeBtns = document.querySelectorAll('.closeModal');

document.getElementById('aboutBtn').onclick = () => document.getElementById('aboutModal').style.display = 'block';
document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsModal').style.display = 'block';
document.getElementById('statsBtn').onclick = () => {
    updateStatisticsUI();
    document.getElementById('statsModal').style.display = 'block';
};

closeBtns.forEach(btn => {
    btn.onclick = function() { this.closest('.modal').style.display = 'none'; }
});
window.onclick = (e) => {
    if (e.target.classList.contains('modal')) e.target.style.display = 'none';
};

document.getElementById('confSlider').oninput = function() {
    document.getElementById('confValueDisplay').innerText = this.value;
    minFallConfidence = this.value / 100;
};
document.getElementById('cooldownSelect').onchange = function() {
    alertCooldown = parseInt(this.value);
};
document.getElementById('audioToggle').onchange = function() {
    audioEnabled = this.checked;
};
document.getElementById('bboxToggle').onchange = function() {
    showBoundingBoxes = this.checked;
};

document.getElementById('desktopNotifToggle').onchange = function() {
    if (this.checked) {
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notification");
            this.checked = false;
            return;
        }
        if (Notification.permission !== "granted") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") desktopNotifEnabled = true;
                else { this.checked = false; desktopNotifEnabled = false; }
            });
        } else {
            desktopNotifEnabled = true;
        }
    } else {
        desktopNotifEnabled = false;
    }
};

document.querySelectorAll('.dummy-link').forEach(link => {
    link.onclick = () => alert('This feature is currently under development.');
});

function playAlarmSound() {
    if (!audioEnabled) return;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
}

function sendDesktopNotification(confidence) {
    if (!desktopNotifEnabled || Notification.permission !== "granted") return;
    const notif = new Notification("CRITICAL FALL DETECTED", {
        body: `System detected a fall with ${Math.round(confidence * 100)}% confidence. Check dashboard immediately.`,
        icon: "https://cdn-icons-png.flaticon.com/512/1161/1161388.png"
    });
    setTimeout(() => notif.close(), 5000);
}

function updateUptimeTracker() {
    if (isSystemRunning && sessionStartTime) {
        const diffSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
        const mins = String(Math.floor(diffSeconds / 60)).padStart(2, '0');
        const secs = String(diffSeconds % 60).padStart(2, '0');
        liveUptimeTxt.innerText = `${mins}:${secs}`;
    }
}

function updateStatisticsUI() {
    document.getElementById('statTotalFalls').innerText = totalFallsCount;
    document.getElementById('statFrames').innerText = totalFramesAnalyzed;
    
    const fallRate = totalFramesAnalyzed > 0 ? ((totalFallsCount / totalFramesAnalyzed) * 100).toFixed(1) : 0;
    document.getElementById('statFallRate').innerText = `${fallRate}%`;

    const avgConf = confidenceCount > 0 ? ((sumConfidence / confidenceCount) * 100).toFixed(1) : 0;
    document.getElementById('statAvgConf').innerText = `${avgConf}%`;

    if (processingTimesArr.length > 0) {
        const sum = processingTimesArr.reduce((a, b) => a + b, 0);
        const avg = (sum / processingTimesArr.length).toFixed(2);
        document.getElementById('statAvgTime').innerText = `${avg}s`;
    } else {
        document.getElementById('statAvgTime').innerText = "0.00s";
    }
}

mediaInput.onchange = function() {
    if (this.files && this.files.length > 0) {
        fileNameDisplay.innerText = this.files[0].name;
    } else {
        fileNameDisplay.innerText = "Click here to choose a file...";
    }
};

function switchTab(mode, btnElement) {
    currentMode = mode;
    currentModeTxt.innerText = `MODE: ${mode.toUpperCase()}`;
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    
    stopDetection();

    if (mode === 'camera') {
        uploadArea.style.display = 'none';
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Camera';
    } else {
        uploadArea.style.display = 'flex';
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Process File';
        mediaInput.accept = mode === 'video' ? 'video/*' : 'image/*';
        mediaInput.value = '';
        fileNameDisplay.innerText = mode === 'video' ? "Click here to choose a video..." : "Click here to choose an image...";
    }
}

document.getElementById('tabCamera').onclick = () => switchTab('camera', document.getElementById('tabCamera'));
document.getElementById('tabVideo').onclick = () => switchTab('video', document.getElementById('tabVideo'));
document.getElementById('tabImage').onclick = () => switchTab('image', document.getElementById('tabImage'));

startBtn.onclick = async () => {
    isSystemRunning = true;
    sessionStartTime = Date.now();
    
    clearInterval(uptimeInterval);
    uptimeInterval = setInterval(updateUptimeTracker, 1000);

    if (currentMode === 'camera') startCamera();
    else if (currentMode === 'video') startVideoFile();
    else if (currentMode === 'image') processStaticImage();
};

stopBtn.onclick = stopDetection;

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.style.display = 'block';
        imagePreview.style.display = 'none';

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            detectionInterval = setInterval(() => sendFrameToAPI(video), 300);
        };
    } catch (err) {
        alert("Camera access denied.");
    }
}

function startVideoFile() {
    const file = mediaInput.files[0];
    if (!file) return alert("Please upload a video file first!");

    video.src = URL.createObjectURL(file);
    video.srcObject = null;
    video.style.display = 'block';
    imagePreview.style.display = 'none';

    video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        video.play();
        detectionInterval = setInterval(() => sendFrameToAPI(video), 300);
    };

    video.onended = stopDetection;
}

function processStaticImage() {
    const file = mediaInput.files[0];
    if (!file) return alert("Please upload an image file first!");

    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        video.style.display = 'none';
        
        imagePreview.onload = () => {
            canvas.width = imagePreview.naturalWidth;
            canvas.height = imagePreview.naturalHeight;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
            tempCanvas.getContext('2d').drawImage(imagePreview, 0, 0);
            tempCanvas.toBlob(blob => sendBlobToAPI(blob), 'image/jpeg');
        };
    };
    reader.readAsDataURL(file);
}

function stopDetection() {
    isSystemRunning = false;
    clearInterval(uptimeInterval);
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (video) { video.pause(); video.src = ""; video.srcObject = null; }
    
    clearInterval(detectionInterval);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    imagePreview.style.display = 'none';
    alertBox.style.display = 'none';
    
    personsCountTxt.innerText = "0";
    currentActionTxt.innerText = "None";
    currentActionTxt.style.color = "#38bdf8";
    riskLevelTxt.innerText = "Low";
    riskLevelTxt.style.color = "#10b981";
    processingTimeTxt.innerText = "0.00";
    liveUptimeTxt.innerText = "00:00";
}

async function sendFrameToAPI(videoSource) {
    if (!videoSource.videoWidth) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoSource.videoWidth;
    tempCanvas.height = videoSource.videoHeight;
    tempCanvas.getContext('2d').drawImage(videoSource, 0, 0);
    tempCanvas.toBlob(blob => sendBlobToAPI(blob), 'image/jpeg');
}

async function sendBlobToAPI(blob) {
    const formData = new FormData();
    formData.append('file', blob, 'frame.jpg');

    try {
        const response = await fetch('http://127.0.0.1:8000/detect/', { method: 'POST', body: formData });
        const data = await response.json();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        totalFramesAnalyzed++;
        personsCountTxt.innerText = data.boxes.length;
        
        const pTime = parseFloat(data.processing_time || 0);
        processingTimeTxt.innerText = pTime.toFixed(2);
        if (pTime > 0) processingTimesArr.push(pTime);
        if (processingTimesArr.length > 100) processingTimesArr.shift();

        let maxFallConfidence = 0;
        let highestActionConf = 0;
        let dominantAction = "Clear";

        data.boxes.forEach(box => {
            const { x1, y1, x2, y2, class_name, confidence } = box;
            const isFall = class_name.toLowerCase().includes("fall");
            const color = isFall ? '#e11d48' : '#38bdf8';
            
            if (confidence > highestActionConf) {
                highestActionConf = confidence;
                dominantAction = class_name.toLowerCase();
            }

            if (isFall && confidence > maxFallConfidence) {
                maxFallConfidence = confidence;
            }
            
            if (showBoundingBoxes) {
                ctx.strokeStyle = color; ctx.lineWidth = 3;
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                
                ctx.fillStyle = color;
                ctx.fillRect(x1, y1 - 25, ctx.measureText(class_name).width + 45, 25);
                
                ctx.fillStyle = 'white';
                ctx.font = '14px sans-serif';
                ctx.fillText(`${class_name} ${confidence}`, x1 + 5, y1 - 7);
            }
        });

        if (highestActionConf > 0) {
            sumConfidence += highestActionConf;
            confidenceCount++;
        }

        if (dominantAction !== "Clear") {
            currentActionTxt.innerText = dominantAction.toUpperCase();
        } else {
            currentActionTxt.innerText = "None";
        }

        if (maxFallConfidence >= minFallConfidence) {
            alertBox.style.display = 'block';
            riskLevelTxt.innerText = "High (Fall)";
            riskLevelTxt.style.color = "#e11d48";
            currentActionTxt.style.color = "#e11d48";
            
            triggerFallAlert(maxFallConfidence);
        } else {
            alertBox.style.display = 'none';
            riskLevelTxt.innerText = "Low";
            riskLevelTxt.style.color = "#10b981";
            currentActionTxt.style.color = "#38bdf8";
        }
    } catch (error) {
        console.error("API error:", error);
    }
}

function triggerFallAlert(confidence) {
    const now = Date.now();
    if (now - lastAlertTime > alertCooldown) {
        totalFallsCount++;
        if (emptyLogMessage) emptyLogMessage.style.display = 'none';
        
        playAlarmSound();
        sendDesktopNotification(confidence);

        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const confPercent = Math.round(confidence * 100);
        const sourceName = currentMode === 'camera' ? 'Live Camera' : 'File Upload';
        
        const li = document.createElement('li');
        li.className = 'log-item';
        li.innerHTML = `<strong><i class="fa-solid fa-triangle-exclamation"></i> Fall Detected</strong> <br> 
                        <span style="color: #94a3b8; font-size: 0.8rem;">${timeString} | Source: ${sourceName} | Confidence: ${confPercent}%</span>`;
        
        logList.prepend(li);
        lastAlertTime = now;
    }
}