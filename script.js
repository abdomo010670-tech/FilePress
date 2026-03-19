// =========================== الإعدادات العامة ===========================
let filesArray = [];                 // مصفوفة الكائنات الخاصة بالملفات
let currentFilter = 'all';            // الفلتر الحالي
let settings = {
    quality: 0.8,                     // جودة الصور (0-1)
    resizeEnabled: false,
    maxWidth: 1200,
    maxHeight: 1200
};
let isProcessing = false;

// عناصر DOM
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const filesListEl = document.getElementById('filesList');
const compressAllBtn = document.getElementById('compressAllBtn');
const advancedSettingsBtn = document.getElementById('advancedSettingsBtn');
const advancedPanel = document.getElementById('advancedPanel');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const globalProgressBar = document.getElementById('globalProgressBar');
const globalProgressFill = document.getElementById('globalProgressFill');
const toastContainer = document.getElementById('toastContainer');
const tabBtns = document.querySelectorAll('.tab-btn');
const presetBtns = document.querySelectorAll('.preset-btn');
const qualityRange = document.getElementById('qualityRange');
const qualityValue = document.getElementById('qualityValue');
const resizeCheckbox = document.getElementById('resizeCheckbox');

// =========================== وظائف مساعدة ===========================
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 بايت';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getFileEmoji(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType === 'application/pdf') return '📄';
    return '📁';
}

function getStatusText(status) {
    const map = {
        waiting: 'في الانتظار',
        processing: 'جاري المعالجة...',
        done: 'تم',
        error: 'خطأ',
        unsupported: 'غير مدعوم'
    };
    return map[status] || status;
}

// =========================== إدارة الملفات ===========================
function addFiles(newFiles) {
    for (const file of newFiles) {
        let type = 'other';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type === 'application/pdf') type = 'pdf';

        if (type === 'other') {
            showToast(`الملف "${file.name}" غير مدعوم`, 'error');
            continue;
        }

        const fileObj = {
            id: generateId(),
            file: file,
            type: type,
            originalSize: file.size,
            compressedSize: null,
            compressedBlob: null,
            status: 'waiting',
            progress: 0
        };
        filesArray.push(fileObj);
    }
    renderFileList();
    updateGlobalButtons();
}

function removeFile(id) {
    const index = filesArray.findIndex(f => f.id === id);
    if (index !== -1) {
        filesArray.splice(index, 1);
        renderFileList();
        updateGlobalButtons();
    }
}

function renderFileList() {
    const filtered = filesArray.filter(f => currentFilter === 'all' || f.type === currentFilter);
    if (filtered.length === 0) {
        filesListEl.innerHTML = '<div class="empty-state" style="text-align:center; padding:20px;">لا توجد ملفات</div>';
        return;
    }

    let html = '';
    filtered.forEach(fileObj => {
        const statusText = getStatusText(fileObj.status);
        const originalSize = formatBytes(fileObj.originalSize);
        const compressedSize = fileObj.compressedSize ? formatBytes(fileObj.compressedSize) : '—';
        const savings = fileObj.compressedSize ? ((1 - fileObj.compressedSize / fileObj.originalSize) * 100).toFixed(1) : 0;

        html += `
            <div class="file-card" data-id="${fileObj.id}">
                <div class="file-preview">${getFileEmoji(fileObj.file.type)}</div>
                <div class="file-info">
                    <div class="file-name">${fileObj.file.name}</div>
                    <div class="file-meta">
                        <span>الحجم الأصلي: ${originalSize}</span>
                        <span>بعد الضغط: ${compressedSize}</span>
                        ${fileObj.status === 'done' ? `<span>توفير: ${savings}%</span>` : ''}
                    </div>
                </div>
                <div class="file-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${fileObj.progress}%"></div>
                    </div>
                    <div class="file-status ${fileObj.status}">${statusText}</div>
                </div>
                <div class="file-actions">
                    ${fileObj.status === 'done' ? `<button class="icon-btn download-single" data-id="${fileObj.id}" title="تحميل"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></button>` : ''}
                    <button class="icon-btn remove-file" data-id="${fileObj.id}" title="حذف"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                </div>
            </div>
        `;
    });
    filesListEl.innerHTML = html;

    // إضافة مستمعات الأحداث للأزرار
    document.querySelectorAll('.download-single').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            downloadSingleFile(id);
        });
    });
    document.querySelectorAll('.remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            removeFile(id);
        });
    });
}

function updateGlobalButtons() {
    const anyDone = filesArray.some(f => f.status === 'done' || f.status === 'unsupported');
    downloadAllBtn.disabled = !anyDone;
}

function updateGlobalProgress() {
    const total = filesArray.length;
    if (total === 0) {
        globalProgressBar.classList.add('hidden');
        return;
    }
    const completed = filesArray.filter(f => f.status === 'done' || f.status === 'unsupported' || f.status === 'error').length;
    const percent = (completed / total) * 100;
    globalProgressFill.style.width = percent + '%';
    globalProgressBar.classList.remove('hidden');
}

// =========================== عمليات الضغط ===========================
// ضغط الصور باستخدام Canvas
async function compressImage(file, quality) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;

        img.onload = () => {
            URL.revokeObjectURL(url);
            let width = img.width;
            let height = img.height;

            if (settings.resizeEnabled) {
                const maxWidth = settings.maxWidth;
                const maxHeight = settings.maxHeight;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            let outputType = file.type;
            // إذا كانت الصورة شفافة نحافظ على الشفافية باستخدام PNG
            if (file.type === 'image/png' || file.type === 'image/webp') {
                outputType = file.type;
            } else {
                outputType = 'image/jpeg'; // للصور غير الشفافة نستخدم JPEG لتقليل الحجم
            }

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('فشل الضغط'));
                }
            }, outputType, quality);
        };
        img.onerror = reject;
    });
}

// ضغط PDF باستخدام pdf-lib (إزالة البيانات الوصفية ودمج المحتوى)
async function compressPDF(file) {
    if (!window.PDFLib) {
        showToast('مكتبة PDF غير متوفرة. يرجى وضع pdf-lib.min.js في مجلد libs/', 'error');
        return file; // إرجاع الملف الأصلي كـ fallback
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        // محاولة تقليل الحجم: إزالة البيانات الوصفية وضغط المحتوى (هذا بسيط)
        const compressedPdf = await PDFLib.PDFDocument.create();
        const pages = await compressedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        pages.forEach(page => compressedPdf.addPage(page));
        // حفظ بدون بيانات وصفية
        const compressedBytes = await compressedPdf.save({ useObjectStreams: true });
        return new Blob([compressedBytes], { type: 'application/pdf' });
    } catch (error) {
        console.error(error);
        showToast('فشل ضغط PDF، تم استخدام الملف الأصلي', 'error');
        return file;
    }
}

// ضغط الفيديو: باستخدام FFmpeg.wasm المحلي مع تحديد corePath
async function compressVideo(file) {
    // التحقق من وجود FFmpeg
    if (typeof FFmpeg === 'undefined' || !FFmpeg.createFFmpeg) {
        showToast('مكتبة FFmpeg غير موجودة. يرجى وضع ملفات FFmpeg في libs/ffmpeg/', 'error');
        return file; // fallback
    }

    try {
        const { createFFmpeg } = FFmpeg;
        // تعيين المسار إلى ملفات core (مهم جدًا للمكتبة المحلية)
        const ffmpeg = createFFmpeg({
            log: false,
            corePath: 'libs/ffmpeg/ffmpeg-core.js' // تحديد المسار المحلي للملفات الأساسية
        });
        
        showToast('جاري تحميل محرك FFmpeg... قد يستغرق بضع ثوانٍ', 'info');
        await ffmpeg.load();

        // كتابة الملف في نظام ملفات FFmpeg
        const inputName = 'input' + getFileExtension(file.name);
        ffmpeg.FS('writeFile', inputName, new Uint8Array(await file.arrayBuffer()));

        // تشغيل أمر ضغط (مثال: تقليل الجودة إلى 28 CRF، وإخراج بصيغة MP4)
        await ffmpeg.run('-i', inputName, '-crf', '28', '-preset', 'fast', 'output.mp4');

        // قراءة النتيجة
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const outputBlob = new Blob([data.buffer], { type: 'video/mp4' });

        ffmpeg.exit();
        return outputBlob;
    } catch (error) {
        console.error(error);
        showToast('فشل ضغط الفيديو، تم استخدام الملف الأصلي', 'error');
        return file;
    }
}

function getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.')) || '';
}

// معالجة ملف واحد
async function processFile(fileObj) {
    if (fileObj.status === 'done' || fileObj.status === 'processing') return;

    fileObj.status = 'processing';
    fileObj.progress = 20;
    renderFileList();

    try {
        let compressedBlob;
        if (fileObj.type === 'image') {
            compressedBlob = await compressImage(fileObj.file, settings.quality);
        } else if (fileObj.type === 'video') {
            compressedBlob = await compressVideo(fileObj.file);
        } else if (fileObj.type === 'pdf') {
            compressedBlob = await compressPDF(fileObj.file);
        } else {
            fileObj.status = 'unsupported';
            compressedBlob = fileObj.file;
        }

        fileObj.compressedBlob = compressedBlob;
        fileObj.compressedSize = compressedBlob.size;
        fileObj.status = 'done';
        fileObj.progress = 100;
    } catch (error) {
        console.error(error);
        fileObj.status = 'error';
        fileObj.progress = 100; // ننهي الشريط لكن حالة خطأ
        showToast(`خطأ في ضغط ${fileObj.file.name}`, 'error');
    }

    renderFileList();
    updateGlobalProgress();
    updateGlobalButtons();
}

// معالجة جميع الملفات بالتسلسل
async function processAllFiles() {
    if (isProcessing) return;
    isProcessing = true;
    compressAllBtn.disabled = true;

    const toProcess = filesArray.filter(f => f.status !== 'done' && f.status !== 'unsupported');
    for (const fileObj of toProcess) {
        await processFile(fileObj);
    }

    isProcessing = false;
    compressAllBtn.disabled = false;
    showToast('تمت المعالجة بنجاح', 'success');
}

// =========================== التحميل والـ ZIP ===========================
function downloadSingleFile(id) {
    const fileObj = filesArray.find(f => f.id === id);
    if (!fileObj || !fileObj.compressedBlob) return;

    const blob = fileObj.compressedBlob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileObj.file.name; // يمكن تعديل الاسم
    a.click();
    URL.revokeObjectURL(url);
}

async function downloadAllAsZip() {
    if (!window.JSZip) {
        showToast('مكتبة JSZip غير موجودة في libs/', 'error');
        return;
    }

    const filesToZip = filesArray.filter(f => f.compressedBlob);
    if (filesToZip.length === 0) {
        showToast('لا توجد ملفات مضغوطة', 'error');
        return;
    }

    downloadAllBtn.disabled = true;
    showToast('جاري إنشاء ملف ZIP...', 'info');

    const zip = new JSZip();
    for (const fileObj of filesToZip) {
        zip.file(fileObj.file.name, fileObj.compressedBlob);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'FilePress-Compressed.zip';
    a.click();
    URL.revokeObjectURL(url);

    downloadAllBtn.disabled = false;
    showToast('تم إنشاء ZIP بنجاح', 'success');
}

// =========================== أحداث واجهة المستخدم ===========================
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
});

fileInput.addEventListener('change', (e) => {
    addFiles(Array.from(e.target.files));
    fileInput.value = '';
});

// التبويبات
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderFileList();
    });
});

// إعدادات متقدمة
advancedSettingsBtn.addEventListener('click', () => {
    advancedPanel.classList.toggle('hidden');
});

// جودة مسبقة
presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        let q = 0.8;
        if (btn.dataset.quality === 'low') q = 0.4;
        else if (btn.dataset.quality === 'medium') q = 0.7;
        else if (btn.dataset.quality === 'high') q = 0.9;
        settings.quality = q;
        qualityRange.value = q;
        qualityValue.textContent = Math.round(q * 100) + '%';
    });
});

qualityRange.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settings.quality = val;
    qualityValue.textContent = Math.round(val * 100) + '%';
    presetBtns.forEach(b => b.classList.remove('active')); // إلغاء التحديد المسبق
});

resizeCheckbox.addEventListener('change', (e) => {
    settings.resizeEnabled = e.target.checked;
});

compressAllBtn.addEventListener('click', processAllFiles);
downloadAllBtn.addEventListener('click', downloadAllAsZip);

// =========================== التحقق من وجود المكتبات ===========================
if (typeof JSZip === 'undefined') {
    showToast('JSZip غير موجود. يرجى وضع jszip.min.js في libs/', 'error');
}
if (typeof PDFLib === 'undefined') {
    showToast('PDF-Lib غير موجود. ضع pdf-lib.min.js في libs/', 'info');
}
// FFmpeg سيتم التحقق منه عند الاستخدام

// التهيئة
renderFileList();