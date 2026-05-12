/**
 * HospiSync – Doctor Management Logic
 * Handles API integration, dynamic rendering, and local filtering
 * DEBUG VERSION: Fixed registration and enhanced logging
 */

let allDoctors = [];

const formatTimeTo12h = (timeStr) => {
    if (!timeStr) return "No fixed shift";
    let [hours, minutes] = timeStr.split(':');
    hours = parseInt(hours);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // '0' should be '12'
    return `${hours}:${minutes} ${ampm}`;
};


document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    initDashboardInfo();
    loadDoctors();
    
    // Auto-refresh every 30 seconds for real-time availability updates
    setInterval(loadDoctors, 30000);
    
    // Load hospital categories for speciality dropdown
    loadSpecialityOptions();

    // Listen for speciality change for "Other" option
    const specSelect = document.getElementById('doctorSpeciality');
    const customContainer = document.getElementById('customSpecialityContainer');
    if (specSelect && customContainer) {
        specSelect.addEventListener('change', (e) => {
            if (e.target.value === 'OTHER') {
                customContainer.classList.remove('hidden');
                document.getElementById('docCustomSpeciality').focus();
            } else {
                customContainer.classList.add('hidden');
            }
        });
    }

    // Form Toggle Logic
    const toggleBtn = document.getElementById('toggleAddFormBtn');
    const formContent = document.getElementById('addFormContent');
    const chevron = document.getElementById('addFormChevron');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
             openAddModal();
        });
    }

    // Form Submit
    const addDoctorForm = document.getElementById('addDoctorForm');
    if (addDoctorForm) {
        addDoctorForm.addEventListener('submit', handleAddDoctor);
    }

    const editDoctorForm = document.getElementById('editDoctorForm');
    if (editDoctorForm) {
        editDoctorForm.addEventListener('submit', handleEditDoctor);
    }

    // Filters
    ['filterSearch', 'filterSpeciality', 'filterStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', applyFilters);
        if (el && el.tagName === 'SELECT') el.addEventListener('change', applyFilters);
    });

    // Global Click Listener for status menus dismissal
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.status-dropdown-container')) {
             document.querySelectorAll('[id^="statusMenu-"]').forEach(menu => {
                 menu.classList.add('hidden');
             });
        }
    });
});

window.toggleStatusMenu = function(event, doctorId) {
    event.stopPropagation();
    const menu = document.getElementById('statusMenu-' + doctorId);
    if (!menu) return;
    
    // Close other menus
    document.querySelectorAll('[id^="statusMenu-"]').forEach(m => {
        if (m.id !== 'statusMenu-' + doctorId) m.classList.add('hidden');
    });
    
    menu.classList.toggle('hidden');
};

function initDashboardInfo() {
    const hospitalName = getHospitalName() || "Hospital Admin";
    const nameEl = document.getElementById('headerHospitalName');
    const avatarEl = document.getElementById('headerAvatar');
    if (nameEl) nameEl.textContent = hospitalName;
    if (avatarEl) avatarEl.textContent = hospitalName.charAt(0);
}

async function loadDoctors() {
    showLoading(true);
    try {
        const doctors = await apiGet('/doctors/all');
        allDoctors = doctors || [];
        renderStats(allDoctors);
        renderDoctors(allDoctors);
    } catch (err) {
        console.error("Failed to load doctors:", err);
        showToast("Error loading clinical roster", "error");
    } finally {
        showLoading(false);
    }
}

const DEFAULT_SPECIALITIES = [
    'ICU', 'Cardiology', 'Neurology', 'General', 
    'Emergency', 'Child Care', 'Daycare', 'Essential Care'
];

async function loadSpecialityOptions() {
    const hospitalId = getHospitalId();
    if (!hospitalId) return;

    try {
        const dashboardData = await apiGet(`/hospital/${hospitalId}/dashboard`);
        const categories = dashboardData.categories || [];
        const selectedNames = categories.map(c => c.name);

        const select = document.getElementById('doctorSpeciality');
        const filterSelect = document.getElementById('filterSpeciality');
        
        let htmlInput = `<option value="" disabled selected>Select a speciality...</option>`;
        let htmlFilter = `<option value="">All Specialities</option>`;
        
        // Group 1: Hospital's Selected Departments
        if (selectedNames.length > 0) {
            let groupHtml = `<optgroup label="Your Selected Departments">`;
            selectedNames.forEach(name => {
                groupHtml += `<option value="${name.toUpperCase()}">${name}</option>`;
            });
            groupHtml += `</optgroup>`;
            htmlInput += groupHtml;
            htmlFilter += groupHtml;
        }
        
        // Group 2: Other Available Specialities
        const otherSpecs = DEFAULT_SPECIALITIES.filter(s => 
            !selectedNames.some(n => n.toUpperCase().includes(s.toUpperCase()) || s.toUpperCase().includes(n.toUpperCase()))
        );
        
        if (otherSpecs.length > 0) {
            let groupHtml = `<optgroup label="Other Available Specialities">`;
            otherSpecs.forEach(s => {
                groupHtml += `<option value="${s.toUpperCase()}">${s}</option>`;
            });
            groupHtml += `</optgroup>`;
            htmlInput += groupHtml;
            htmlFilter += groupHtml;
        }

        // "Other" option for input only
        htmlInput += `<optgroup label="Still can't find?">`;
        htmlInput += `<option value="OTHER">Other / Custom Speciality...</option>`;
        htmlInput += `</optgroup>`;
        
        if (select) select.innerHTML = htmlInput;
        if (filterSelect) filterSelect.innerHTML = htmlFilter;

        const editSelect = document.getElementById('editDoctorSpeciality');
        if (editSelect) editSelect.innerHTML = htmlInput;
    } catch (e) {
        console.error("Failed to load speciality categories", e);
    }
}

function renderStats(doctors) {
    const total = doctors.length;
    const available = doctors.filter(d => d.isAvailable).length;
    const atLimit = doctors.filter(d => d.availabilityStatus === 'AT_LIMIT').length;
    const specialities = new Set(doctors.map(d => d.speciality)).size;

    const els = {
        'statTotalDoctors': total,
        'statAvailable': available,
        'statAtLimit': atLimit,
        'statSpecialities': specialities
    };

    for (const [id, val] of Object.entries(els)) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
}

function renderDoctors(doctors) {
    const grid = document.getElementById('doctorGrid');
    const emptyState = document.getElementById('emptyState');
    const countText = document.getElementById('resultsCount');

    if (!grid || !emptyState) return;

    grid.innerHTML = '';
    if (countText) countText.textContent = `Showing ${doctors.length} doctors`;

    if (doctors.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');

    doctors.forEach(doctor => {
        const card = createDoctorCard(doctor);
        grid.appendChild(card);
    });
}

function createDoctorCard(doc) {
    const div = document.createElement('div');
    
    const isAtLimit = doc.availabilityStatus === 'AT_LIMIT' || doc.currentPatientCount >= doc.safeLimit;
    
    const loadPercent = Math.min(100, (doc.currentPatientCount / doc.safeLimit) * 100);
    let loadColor = 'bg-success';
    if (loadPercent >= 100) loadColor = 'bg-error';
    else if (loadPercent >= 80) loadColor = 'bg-warning';

    const remaining = Math.max(0, doc.safeLimit - doc.currentPatientCount);
    let limitText = `Can take ${remaining} more patients`;
    let limitColor = 'text-success';
    if (remaining === 0) {
        limitText = 'At safe limit';
        limitColor = 'text-error';
    } else if (remaining <= 3) {
        limitText = 'Almost full';
        limitColor = 'text-warning';
    }

    let cardBgClass = 'bg-white border-slate-100';
    if (doc.availabilityType === 'ON_CALL') {
        cardBgClass = 'bg-amber-50/30 border-amber-100 shadow-amber-900/5';
    } else if (doc.availabilityType === 'OFF_DUTY') {
        cardBgClass = 'bg-slate-50/50 opacity-80 border-slate-100';
    }

    div.className = `doctor-card ${cardBgClass} p-6 rounded-3xl shadow-ambient border ${isAtLimit && doc.availabilityType !== 'OFF_DUTY' ? '!border-error !border-2' : ''} relative group bg-white`;
    
    const specialityColors = {
        'ICU': 'bg-red-50 text-red-600 border-red-100',
        'Cardiology': 'bg-sky-50 text-sky-600 border-sky-100',
        'Neurology': 'bg-purple-50 text-purple-600 border-purple-100',
        'General': 'bg-slate-50 text-slate-600 border-slate-100',
        'Emergency': 'bg-orange-50 text-orange-600 border-orange-100',
        'Child Care': 'bg-rose-50 text-rose-600 border-rose-100',
        'Daycare': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'Essential Care': 'bg-indigo-50 text-indigo-600 border-indigo-100'
    };
    const specClass = specialityColors[doc.speciality] || 'bg-slate-50 text-slate-600 border-slate-100';
    const initial = doc.name ? doc.name.charAt(0) : 'D';

    const getStatusConfig = (type) => {
        const configs = {
            'PRESENT': { label: 'ACTIVE', color: 'bg-green-500', shadow: 'shadow-green-500/20', icon: '<circle cx="12" cy="12" r="8"/>', pulse: true },
            'ON_CALL': { label: 'ON-CALL', color: 'bg-amber-500', shadow: 'shadow-amber-500/20', icon: '<circle cx="12" cy="12" r="8"/>', pulse: false },
            'OFF_DUTY': { label: 'OFF DUTY', color: 'bg-slate-400', shadow: 'shadow-slate-400/20', icon: '<circle cx="12" cy="12" r="8"/><path d="M15 9l-6 6M9 9l6 6"/>', pulse: false }
        };
        return configs[type] || configs['OFF_DUTY'];
    };

    const cfg = getStatusConfig(doc.availabilityType);
    const availabilityBadge = `
        <div class="relative inline-block status-dropdown-container">
            <button onclick="toggleStatusMenu(event, ${doc.id})" class="${cfg.color} hover:brightness-110 text-white px-3 py-1 rounded-full flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest shadow-lg ${cfg.shadow} ${cfg.pulse ? 'animate-pulse' : ''} transition-all active:scale-95 group/status-btn">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="${doc.availabilityType==='PRESENT'?'currentColor':'none'}" stroke="currentColor" stroke-width="4">${cfg.icon}</svg> 
                ${cfg.label}
                <span class="material-symbols-outlined text-[10px] ml-1 group-hover/status-btn:translate-y-0.5 transition-transform">expand_more</span>
            </button>
            <div id="statusMenu-${doc.id}" class="hidden absolute left-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-bold border border-slate-100 z-[1001] py-2 overflow-hidden backdrop-blur-3xl">
                <button onclick="updateDocAvailabilityType(${doc.id}, 'PRESENT')" class="w-full px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest hover:bg-green-50 text-slate-600 hover:text-green-600 flex items-center gap-3 transition-colors ${doc.availabilityType === 'PRESENT' ? 'bg-green-50 text-green-600' : ''}">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span> ACTIVE (PRESENT)
                </button>
                <button onclick="updateDocAvailabilityType(${doc.id}, 'ON_CALL')" class="w-full px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 text-slate-600 hover:text-amber-600 flex items-center gap-3 transition-colors ${doc.availabilityType === 'ON_CALL' ? 'bg-amber-50 text-amber-600' : ''}">
                    <span class="w-2 h-2 rounded-full bg-amber-500"></span> ON-CALL (EMERGENCY)
                </button>
                <button onclick="updateDocAvailabilityType(${doc.id}, 'OFF_DUTY')" class="w-full px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center gap-3 transition-colors ${doc.availabilityType === 'OFF_DUTY' ? 'bg-slate-100 text-slate-900' : ''}">
                    <span class="w-2 h-2 rounded-full bg-slate-400"></span> OFF DUTY
                </button>
            </div>
        </div>
    `;

    let safetyWarning = '';
    if (doc.availabilityType === 'ON_CALL' && (doc.availabilityStatus === 'NEAR_LIMIT' || doc.availabilityStatus === 'AT_LIMIT')) {
        safetyWarning = `
            <div class="mb-6" style="background: #FEF3C7; border-left: 3px solid #F59E0B; border-radius: 6px; padding: 8px 12px; color: #B45309; font-size: 11px; font-weight: 600;">
                ⚠ On-Call & near limit — consider reassigning
            </div>
        `;
    }

    const shiftDisplay = (doc.shiftStart && doc.shiftEnd)
        ? `${formatTimeTo12h(doc.shiftStart.substring(0, 5))} → ${formatTimeTo12h(doc.shiftEnd.substring(0, 5))}`
        : "No fixed shift";

    const expHtml = (doc.experienceYears && doc.experienceYears > 0)
        ? `<span class="text-[10px] text-slate-400 font-bold tracking-widest uppercase flex items-center gap-1.5 ml-1">
             <span class="w-1 h-1 rounded-full bg-slate-300"></span> ${doc.experienceYears} yr exp
           </span>`
        : '';

    div.innerHTML = `
        <div class="flex items-start justify-between mb-8 group/card-head">
            <div class="flex items-center gap-5">
                <div class="w-16 h-16 rounded-[2rem] shadow-2xl shadow-slate-200/50 flex items-center justify-center text-2xl font-black ${specClass.split(' ')[0]} ${specClass.split(' ')[1]} border-2 ${specClass.split(' ')[2]} relative">
                     <span class="relative z-10">${initial}</span>
                     <div class="absolute inset-0 rounded-[2rem] bg-current opacity-10 blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                </div>
                <div>
                    <div class="flex items-center gap-3 mb-2">
                        <h4 class="text-lg font-black text-slate-900 tracking-tight leading-none capitalize">${doc.name?.toLowerCase().replace(/^dr\.?\s+/i, '')}</h4>
                        ${availabilityBadge}
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${specClass} shadow-sm backdrop-blur-sm">
                            ${doc.speciality}
                        </span>
                        ${expHtml}
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                <button onclick="openEditModal(${doc.id})" class="w-10 h-10 rounded-2xl bg-white text-slate-400 hover:text-primary hover:bg-primary/5 border border-slate-100 shadow-sm transition-all flex items-center justify-center hover:scale-110 active:scale-95 group/edit">
                    <span class="material-symbols-outlined text-lg group-hover/edit:rotate-12 transition-transform">edit_note</span>
                </button>
                <button onclick="confirmDelete(${doc.id})" class="w-10 h-10 rounded-2xl bg-white text-slate-400 hover:text-error hover:bg-error/5 border border-slate-100 shadow-sm transition-all flex items-center justify-center hover:scale-110 active:scale-95 group/del">
                    <span class="material-symbols-outlined text-lg group-hover/del:scale-125 transition-transform">delete_sweep</span>
                </button>
            </div>
        </div>

        ${safetyWarning}

        <div class="grid grid-cols-2 gap-4 mb-8">
            <div class="bg-slate-50/70 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-sm group/info relative overflow-hidden">
                <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-2 relative z-10 flex items-center gap-1">
                    <span class="material-symbols-outlined text-[10px]">schedule</span> Standard Shift
                </p>
                <p class="text-xs text-slate-800 font-black tracking-tight relative z-10">
                    ${shiftDisplay}
                </p>
                <div class="absolute -right-4 -bottom-4 text-slate-300 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <span class="material-symbols-outlined text-5xl">pace</span>
                </div>
            </div>
            <div class="bg-slate-50/70 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-sm group/info-2 relative overflow-hidden">
                <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-2 relative z-10 flex items-center gap-1">
                    <span class="material-symbols-outlined text-[10px]">verified</span> Credentials
                </p>
                <p class="text-xs text-slate-800 font-black tracking-tight relative z-10">
                    ${doc.qualification || 'Senior Consultant'}
                </p>
                <div class="absolute -right-4 -bottom-4 text-slate-300 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <span class="material-symbols-outlined text-5xl">school</span>
                </div>
            </div>
        </div>

        <div class="space-y-5 mb-8">
            <div class="flex justify-between items-end">
                <div>
                    <h5 class="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                        ${doc.currentPatientCount}
                        <span class="text-slate-200 text-base font-bold">/</span>
                        <span class="text-slate-400 text-lg font-bold">${doc.safeLimit}</span>
                    </h5>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest">PATIENT LOAD</p>
                </div>
                <div class="text-right">
                    <p class="text-[10px] font-black uppercase tracking-widest ${limitColor} mb-2 flex items-center justify-end gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-current ${loadPercent >= 100 ? 'animate-ping' : ''}"></span>
                        ${limitText}
                    </p>
                    <div class="flex gap-1.5 justify-end">
                         ${Array(5).fill(0).map((_, i) => `<div class="w-2.5 h-2.5 rounded-lg rotate-45 border-2 ${i < Math.round(loadPercent/20) ? (loadColor.replace('bg-', 'bg-') + ' border-transparent') : 'border-slate-100 bg-transparent'} transition-all duration-1000 delay-[${i*100}ms]"></div>`).join('')}
                    </div>
                </div>
            </div>
            <div class="h-3 w-full bg-slate-100 rounded-2xl overflow-hidden p-0.5 border border-white shadow-inner">
                <div class="${loadColor} h-full transition-all duration-1000 ease-in-out rounded-2xl shadow-lg relative overflow-hidden" style="width: ${loadPercent}%">
                    <div class="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                </div>
            </div>
        </div>
        
        <div class="bg-white p-5 rounded-[2.5rem] border-2 border-slate-50 shadow-ambient mb-8 flex items-center justify-between group/sync hover:border-primary/20 transition-colors">
            <div class="flex-1">
                <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[12px]">medical_services</span> UPDATE PATIENT COUNT
                </p>
                <div class="flex items-center gap-5">
                    <button onclick="decrementLoad(${doc.id})" class="w-10 h-10 rounded-2xl bg-slate-50 text-slate-600 text-xl font-bold flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all transform active:scale-90 shadow-sm">−</button>
                    <input type="number" id="loadInput-${doc.id}" value="${doc.currentPatientCount}" min="0" max="${doc.safeLimit}" class="w-14 bg-transparent border-none text-center font-black text-slate-900 text-xl focus:ring-0 p-0 tracking-tighter">
                    <button onclick="incrementLoad(${doc.id})" class="w-10 h-10 rounded-2xl bg-slate-50 text-slate-600 text-xl font-bold flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all transform active:scale-90 shadow-sm">+</button>
                </div>
            </div>
            <button onclick="saveLoad(${doc.id})" class="px-8 py-4 bg-slate-900 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-slate-900/30 hover:bg-primary hover:shadow-primary/30 active:scale-95 transition-all flex items-center gap-2 group/btn">
                 SAVE
            </button>
        </div>

        <div class="pt-6 border-t border-slate-50 flex items-center justify-between">
            <div class="flex items-center gap-3">
                 <div class="w-2 h-2 rounded-full ${doc.isAvailable ? 'bg-success' : 'bg-slate-300'}"></div>
                 <span class="text-[9px] text-slate-500 font-black uppercase tracking-widest">${doc.isAvailable ? '● Shift Active' : '○ Shift Inactive'}</span>
            </div>
            <div class="px-3 py-1 bg-white border border-slate-100 rounded-xl shadow-sm">
                <span class="text-[9px] text-slate-400 font-bold tracking-widest uppercase">Clinical ID: D${doc.id}</span>
            </div>
        </div>
    `;

    return div;
}

/**
 * Handle Add Doctor with enhanced logging as requested by user
 */
async function handleAddDoctor(e) {
    if (e) e.preventDefault();
    
    // Exact localStorage key from api.js is 'token'
    const token = localStorage.getItem('token');
    
    const doctorName = document.getElementById('doctorName').value;
    const doctorEmail = document.getElementById('doctorEmail').value;
    const doctorPhone = document.getElementById('doctorPhone').value;
    
    let doctorSpeciality = document.getElementById('doctorSpeciality').value;
    if (doctorSpeciality === 'OTHER') {
        const customVal = document.getElementById('docCustomSpeciality').value.trim();
        if (!customVal) {
            showToast("Please enter the custom speciality name", "error");
            return;
        }
        doctorSpeciality = customVal.toUpperCase();
    }

    const doctorQualification = document.getElementById('doctorQualification').value;
    const doctorExperience = document.getElementById('doctorExperience').value;
    const doctorSafeLimit = document.getElementById('doctorSafeLimit').value;
    const doctorAvailabilityType = document.getElementById('doctorAvailabilityType')?.value || 'PRESENT';
    const doctorShiftStart = document.getElementById('doctorShiftStart').value || '08:00';
    const doctorShiftEnd = document.getElementById('doctorShiftEnd').value || '16:00';
    const doctorWorkDays = document.getElementById('doctorWorkDays').value || 'MON,TUE,WED,THU,FRI';

    const payload = {
        name: doctorName,
        email: doctorEmail,
        phone: doctorPhone,
        speciality: doctorSpeciality,
        qualification: doctorQualification,
        experienceYears: parseInt(doctorExperience) || 0,
        safeLimit: parseInt(doctorSafeLimit) || 12,
        shiftStart: doctorShiftStart + (doctorShiftStart.split(':').length === 2 ? ':00' : ''),
        shiftEnd: doctorShiftEnd + (doctorShiftEnd.split(':').length === 2 ? ':00' : ''),
        workDays: doctorWorkDays.toUpperCase(),
        availabilityType: doctorAvailabilityType
    };

    // console.log("Attempting to add doctor with payload:", payload);

    // Loading state
    const addDoctorBtn = document.querySelector('#addDoctorForm button[type="submit"]');
    if (addDoctorBtn) {
        addDoctorBtn.disabled = true;
        addDoctorBtn.textContent = 'Adding...';
    }

    showLoading(true);
    let response;
    try {
        // Direct fetch call as requested for better debugging
        response = await fetch('/api/doctors/add', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // console.log("Response status:", response.status);

        if (response.ok) {
            const data = await response.json();
            showToast("Doctor added successfully", "success");
            document.getElementById('addDoctorForm').reset();
            document.getElementById('customSpecialityContainer').classList.add('hidden');
            closeAddModal();
            await loadDoctors();
        } else {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            
            // Try to parse JSON error if available
            try {
                const errorJson = JSON.parse(errorText);
                showToast("Failed: " + (errorJson.message || errorJson.error || "Validation error"), "error");
            } catch (pErr) {
                showToast("Registration failed. Status: " + response.status, "error");
            }
        }
    } catch (error) {
        console.error('Add doctor fetch error:', error);
        console.error('Response status context:', response?.status);
        showToast('Connection error: ' + error.message, "error");
    } finally {
        showLoading(false);
        // Restore button state
        if (addDoctorBtn) {
            addDoctorBtn.disabled = false;
            addDoctorBtn.textContent = 'Add';
        }
    }
}

async function updateDocAvailabilityType(id, type) {
    const menu = document.getElementById('statusMenu-' + id);
    if (menu) menu.classList.add('hidden');
    
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/doctors/' + id + '/availability-type', {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ availabilityType: type })
        });
        if (response.ok) {
            const res = await response.json();
            const idx = allDoctors.findIndex(d => d.id === id);
            if (idx !== -1) {
                allDoctors[idx] = res;
                renderStats(allDoctors);
                renderDoctors(allDoctors);
            }
            showToast("Doctor availability overriden", "success");
        } else {
            showToast("Failed to override availability", "error");
        }
    } catch (err) {
        console.error("Update error:", err);
        showToast("Connection issue. Try again.", "error");
    }
}

function confirmDelete(id) {
    if (confirm("Are you sure you want to remove this doctor from the registry? This action cannot be undone.")) {
        handleDelete(id);
    }
}

async function handleDelete(id) {
    showLoading(true);
    try {
        await apiDelete(`/doctors/${id}`);
        showToast("Doctor record removed", "success");
        allDoctors = allDoctors.filter(d => d.id !== id);
        renderStats(allDoctors);
        renderDoctors(allDoctors);
    } catch (err) {
        console.error("Delete error:", err);
        showToast("Delete operation failed", "error");
    } finally {
        showLoading(false);
    }
}

function applyFilters() {
    const search = document.getElementById('filterSearch').value.toLowerCase();
    const speciality = document.getElementById('filterSpeciality').value;
    const status = document.getElementById('filterStatus').value;

    const filtered = allDoctors.filter(doc => {
        const matchesSearch = doc.name.toLowerCase().includes(search);
        const matchesSpec = !speciality || doc.speciality === speciality;
        
        let matchesStatus = true;
        if (status === 'AVAILABLE') matchesStatus = doc.isAvailable && doc.availabilityStatus === 'AVAILABLE';
        else if (status === 'NEAR_LIMIT') matchesStatus = doc.availabilityStatus === 'NEAR_LIMIT';
        else if (status === 'AT_LIMIT') matchesStatus = doc.availabilityStatus === 'AT_LIMIT';
        
        return matchesSearch && matchesSpec && matchesStatus;
    });

    renderDoctors(filtered);
}

function incrementLoad(doctorId) {
    const input = document.getElementById('loadInput-' + doctorId);
    if (!input) return;
    const max = parseInt(input.getAttribute('max'));
    let val = parseInt(input.value) || 0;
    if (val < max) {
        input.value = val + 1;
    }
}

function decrementLoad(doctorId) {
    const input = document.getElementById('loadInput-' + doctorId);
    if (!input) return;
    let val = parseInt(input.value) || 0;
    if (val > 0) {
        input.value = val - 1;
    }
}

async function saveLoad(doctorId) {
    const input = document.getElementById('loadInput-' + doctorId);
    if (!input) return;
    
    const count = parseInt(input.value) || 0;
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch('/api/doctors/' + doctorId + '/update-load', {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ currentPatientCount: count })
        });
        
        if (response.ok) {
            showToast('Doctor load updated successfully', 'success');
            if (typeof loadDoctors === 'function') {
                loadDoctors();
            }
            if (typeof loadDoctorsForBedsTab === 'function') {
                loadDoctorsForBedsTab(); // Will update Dashboard view if running from there
            }
        } else {
            const err = await response.json();
            showToast(err.message || err.error || 'Update failed', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error updating load', 'error');
    }
}

function openEditModal(id) {
    const doc = allDoctors.find(d => d.id === id);
    if (!doc) return;

    document.getElementById('editDoctorId').value = doc.id;
    document.getElementById('editDoctorName').value = doc.name;
    document.getElementById('editDoctorEmail').value = doc.email || '';
    document.getElementById('editDoctorPhone').value = doc.phone || '';
    document.getElementById('editDoctorSpeciality').value = (doc.speciality || '').toUpperCase();
    document.getElementById('editDoctorQualification').value = doc.qualification || '';
    document.getElementById('editDoctorExperience').value = doc.experienceYears || 0;
    document.getElementById('editDoctorSafeLimit').value = doc.safeLimit || 12;
    document.getElementById('editDoctorAvailabilityType').value = doc.availabilityType || 'PRESENT';
    
    // Process raw shift times (remove seconds if present)
    const formatTime = (t) => t ? t.substring(0, 5) : '08:00';
    document.getElementById('editDoctorShiftStart').value = formatTime(doc.shiftStart);
    document.getElementById('editDoctorShiftEnd').value = formatTime(doc.shiftEnd);
    document.getElementById('editDoctorWorkDays').value = doc.workDays || 'MON,TUE,WED,THU,FRI';

    const modal = document.getElementById('editDoctorModal');
    if (modal) modal.classList.add('active');
}

function closeEditModal() {
    const modal = document.getElementById('editDoctorModal');
    if (modal) modal.classList.remove('active');
}

async function handleEditDoctor(e) {
    if (e) e.preventDefault();
    
    const id = document.getElementById('editDoctorId').value;
    const token = localStorage.getItem('token');
    
    const payload = {
        name: document.getElementById('editDoctorName').value,
        email: document.getElementById('editDoctorEmail').value,
        phone: document.getElementById('editDoctorPhone').value,
        speciality: document.getElementById('editDoctorSpeciality').value,
        qualification: document.getElementById('editDoctorQualification').value,
        experienceYears: parseInt(document.getElementById('editDoctorExperience').value) || 0,
        safeLimit: parseInt(document.getElementById('editDoctorSafeLimit').value) || 12,
        shiftStart: document.getElementById('editDoctorShiftStart').value + ':00',
        shiftEnd: document.getElementById('editDoctorShiftEnd').value + ':00',
        workDays: document.getElementById('editDoctorWorkDays').value.toUpperCase(),
        availabilityType: document.getElementById('editDoctorAvailabilityType').value
    };

    showLoading(true);
    try {
        const response = await fetch('/api/doctors/' + id, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast("Records synchronized", "success");
            closeEditModal();
            loadDoctors();
        } else {
            const err = await response.json();
            showToast(err.message || "Failed to update", "error");
        }
    } catch (err) {
        console.error("Edit error:", err);
        showToast("Access Denied", "error");
    } finally {
        showLoading(false);
    }
}

function openAddModal() {
    const modal = document.getElementById('addDoctorModal');
    if (modal) modal.classList.add('active');
}

function closeAddModal() {
    const modal = document.getElementById('addDoctorModal');
    if (modal) modal.classList.remove('active');
}
