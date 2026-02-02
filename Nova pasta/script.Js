
// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRJQcqfJ3nas1q7CnS0yk9OMjdSWHEIT8",
  authDomain: "ponto-91f0b.firebaseapp.com",
  databaseURL: "https://ponto-91f0b-default-rtdb.firebaseio.com",
  projectId: "ponto-91f0b",
  storageBucket: "ponto-91f0b.firebasestorage.app",
  messagingSenderId: "122709669842",
  appId: "1:122709669842:web:79112a035b67731a8f7a0b",
  measurementId: "G-5RRGZVRQQG"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Application State
let currentUser = null;
let users = {};
let operators = {};
let machines = {};
let productions = {};
let closings = {};
let settings = { lowLimit: 500, highLimit: 1000 };
let currentMonth = new Date();
let selectedMachine = '8';

const defaultConfig = {
    app_title: 'Controle de Produção'
};

let config = { ...defaultConfig };

// Helper Functions
function getUserShift() {
    return currentUser?.shift || null;
}

function canViewAllShifts() {
    return currentUser?.role === 'admin';
}

function formatDate(dateStr) {
    // ✅ Validação de entrada
    if (!dateStr || typeof dateStr !== 'string') {
        return 'Data inválida';
    }

    // ✅ Cria a data de forma segura
    const date = new Date(dateStr + 'T00:00:00');
    
    // ✅ Valida se a data é válida
    if (isNaN(date.getTime())) {
        return 'Data inválida';
    }

    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    
    // ✅ Garante que os índices são válidos
    const dayIndex = date.getDay();
    const monthIndex = date.getMonth();
    const dayNumber = date.getDate();
    
    // ✅ Validação extra dos índices
    if (dayIndex < 0 || dayIndex > 6 || monthIndex < 0 || monthIndex > 11) {
        return 'Data inválida';
    }
    
    return `${days[dayIndex]}, ${dayNumber} ${months[monthIndex]}`;
}


function formatMonthYear(date) {
    const monthKey = getMonthKey(date);
    const [year, month] = monthKey.split('-').map(Number);

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const monthNamesShort = [
        'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    // Get the date range for this custom month
    const { startDate, endDate } = getCustomMonthRange(new Date(year, month - 1, 1));

    const startDay = startDate.getDate();
    const startMonthName = monthNamesShort[startDate.getMonth()];
    const endDay = endDate.getDate();
    const endMonthName = monthNamesShort[endDate.getMonth()];

    return `${monthNames[month - 1]} de ${year} (${startDay}/${startMonthName} - ${endDay}/${endMonthName})`;
}


function getMonthKey(date) {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    // If day is >= 26, we're in the NEXT custom month
    if (day >= 26) {
        const nextMonth = new Date(year, month + 1, 1);
        return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    }

    // If day is < 26, we're in the CURRENT custom month
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function getCustomMonthRange(refDate) {
    const monthKey = getMonthKey(refDate);
    const [year, month] = monthKey.split('-').map(Number);

    // Start date: 26th of PREVIOUS month
    const startDate = new Date(year, month - 2, 26);

    // End date: 25th of CURRENT month
    const endDate = new Date(year, month - 1, 25);

    return { startDate, endDate };
}


function isDateInCustomMonth(dateStr, refDate) {
    // ✅ Validação de entrada dateStr
    if (!dateStr || typeof dateStr !== 'string') {
        return false;
    }

    // ✅ Validação de entrada refDate
    if (!refDate || !(refDate instanceof Date) || isNaN(refDate.getTime())) {
        return false;
    }

    // ✅ Cria a data de forma segura
    const date = new Date(dateStr + 'T00:00:00');
    
    // ✅ Valida se a data é válida
    if (isNaN(date.getTime())) {
        return false;
    }

    // ✅ Obtém as chaves dos meses
    const targetMonthKey = getMonthKey(refDate);
    const dateMonthKey = getMonthKey(date);

    // ✅ Validação das chaves (caso getMonthKey retorne null/undefined)
    if (!targetMonthKey || !dateMonthKey) {
        return false;
    }

    return dateMonthKey === targetMonthKey;
}



function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast bg-white rounded-lg card-shadow-lg p-4 flex items-center gap-3 min-w-72`;

    const iconClass = type === 'success' ? 'fa-check-circle text-green-500' :
        type === 'error' ? 'fa-exclamation-circle text-red-500' :
            'fa-info-circle text-cyan-500';

    toast.innerHTML = `
        <i class="fas ${iconClass} text-xl"></i>
        <span class="text-gray-800">${message}</span>
      `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('closing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showModal(content, options = {}) {
    const container = document.getElementById('modal-container');
    const modal = document.createElement('div');
    modal.className = 'modal-overlay fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50';
    modal.innerHTML = `
        <div class="modal-content bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[90%] overflow-hidden mobile-modal">
          <div class="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 class="font-semibold text-gray-800">${options.title || 'Modal'}</h3>
            <button class="close-modal text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="p-4 overflow-y-auto scrollbar-thin max-h-[calc(90vh-60px)]">
            ${content}
          </div>
        </div>
      `;

    container.appendChild(modal);

    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.onclick = () => closeModal(modal);

    modal.onclick = (e) => {
        if (e.target === modal) closeModal(modal);
    };

    return modal;
}

function closeModal(modal) {
    modal.classList.add('closing');
    modal.querySelector('.modal-content').classList.add('closing');
    setTimeout(() => modal.remove(), 300);
}

function getShiftBadge(shift) {
    if (!shift) return '';
    const classes = {
        'A': 'shift-badge-a',
        'B': 'shift-badge-b',
        'C': 'shift-badge-c'
    };
    return `<span class="px-2 py-0.5 rounded text-xs font-medium text-white ${classes[shift] || 'bg-gray-500'}"> ${shift}º</span>`;
}

function getProductionClass(quantity) {
    if (quantity < settings.lowLimit) return 'production-low';
    if (quantity > settings.highLimit) return 'production-high';
    return 'production-medium';
}

function isMonthClosed(monthKey) {
    return Object.values(closings).some(c => c.month === monthKey);
}

function getFilteredProductions() {
    // Verifica se productions existe e é um objeto válido
    if (!productions || typeof productions !== 'object') {
        return [];
    }

    let filtered = Object.entries(productions)
        .filter(([id, data]) => data && typeof data === 'object') // ✅ Filtra entradas inválidas
        .map(([id, data]) => ({ id, ...data }));

    if (!canViewAllShifts()) {
        const userShift = getUserShift();
        
        // ✅ Verifica se operators existe antes de filtrar
        if (!operators || typeof operators !== 'object') {
            return [];
        }
        
        const allowedOperators = Object.keys(operators)
            .filter(id => operators[id] && operators[id].shift === userShift);
        
        // ✅ Filtra apenas se houver operadores válidos
        if (allowedOperators.length > 0) {
            filtered = filtered.filter(p => p.operatorId && allowedOperators.includes(p.operatorId));
        } else {
            // Se não há operadores do turno do usuário, retorna vazio
            return [];
        }
    }

    return filtered;
}

// Firebase Listeners
function setupFirebaseListeners() {
    database.ref('users').on('value', (snapshot) => {
        users = snapshot.val() || {};
        updateSettingsView();
    });

    database.ref('operators').on('value', (snapshot) => {
        operators = snapshot.val() || {};
        updateSettingsView();
        populateFilterSelects();
        // ADICIONE ESTA LINHA:
        if (currentUser && OperatorsManager.operatorsGrid) {
            OperatorsManager.updateView();
        }
    });



    database.ref('machines').on('value', (snapshot) => {
        machines = snapshot.val() || {};
        updateSettingsView();
        populateFilterSelects();
    });

    database.ref('productions').on('value', (snapshot) => {
        productions = snapshot.val() || {};
        if (currentUser) {
            updateDashboard();
            updateProductionView();
        }
    });

    database.ref('closings').on('value', (snapshot) => {
        closings = snapshot.val() || {};
        if (currentUser) {
            updateClosingView();
        }
    });

    database.ref('settings').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            settings.lowLimit = data.lowLimit || 500;
            settings.highLimit = data.highLimit || 1000;
            document.getElementById('low-limit').value = settings.lowLimit;
            document.getElementById('high-limit').value = settings.highLimit;
        }
    });
}

// Initialize
async function initializeApp() {
    setupFirebaseListeners();

    database.ref('users').once('value', (snapshot) => {
        const usersData = snapshot.val();
        if (!usersData || Object.keys(usersData).length === 0) {
            initializeDefaultData();
        }
    });

    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        database.ref(`users/${userData.id}`).once('value', (snapshot) => {
            if (snapshot.exists()) {
                currentUser = snapshot.val();
                currentUser.id = userData.id;
                showMainApp();
            } else {
                localStorage.removeItem('currentUser');
            }
        });
    }

    if (window.elementSdk) {
        window.elementSdk.init({
            defaultConfig,
            onConfigChange: async (cfg) => {
                config = { ...defaultConfig, ...cfg };
                document.getElementById('app-title').textContent = config.app_title;
                document.getElementById('header-title').textContent = config.app_title;
            },
            mapToCapabilities: () => ({
                recolorables: [],
                borderables: [],
                fontEditable: undefined,
                fontSizeable: undefined
            }),
            mapToEditPanelValues: (cfg) => new Map([
                ['app_title', cfg.app_title || defaultConfig.app_title]
            ])
        });
    }

    setupEventListeners();
}

async function initializeDefaultData() {
    const adminRef = database.ref('users').push();
    await adminRef.set({
        username: 'admin',
        password: 'admin123',
        name: 'Administrador',
        role: 'admin',
        shift: null
    });

    for (const num of ['8', '9', '10']) {
        const machineRef = database.ref('machines').push();
        await machineRef.set({
            name: `Máquina ${num}`,
            target: 1000
        });
    }

    await database.ref('settings').set({
        lowLimit: 500,
        highLimit: 1000
    });

    showToast('Sistema inicializado! Use admin/admin123 para entrar', 'info');
}

function setupEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Tab navigation
    document.querySelectorAll('.tab-btn, .mobile-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Mobile more menu
    const mobileMoreBtn = document.getElementById('mobile-more-btn');
    const mobileMoreMenu = document.getElementById('mobile-more-menu');

    mobileMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileMoreMenu.classList.toggle('active');
    });

    document.querySelectorAll('.mobile-more-item').forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.dataset.tab);
            mobileMoreMenu.classList.remove('active');
        });
    });

    document.addEventListener('click', () => {
        mobileMoreMenu.classList.remove('active');
    });

    // Machine tabs
    document.querySelectorAll('.machine-tab').forEach(btn => {
        btn.addEventListener('click', () => switchMachine(btn.dataset.machine));
    });

    // View toggle buttons
    document.getElementById('calendar-view-btn').addEventListener('click', () => toggleProductionView('calendar'));
    document.getElementById('table-view-btn').addEventListener('click', () => toggleProductionView('table'));

    // Month navigation
    document.getElementById('prev-month-dash').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('next-month-dash').addEventListener('click', () => navigateMonth(1));
    document.getElementById('prev-month-prod').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('next-month-prod').addEventListener('click', () => navigateMonth(1));

    // Settings
    document.getElementById('add-user-btn').addEventListener('click', () => showUserModal());
    document.getElementById('add-operator-btn').addEventListener('click', () => showOperatorModal());
    document.getElementById('add-my-operator-btn').addEventListener('click', () => showMyOperatorModal());
    document.getElementById('add-machine-btn').addEventListener('click', () => showMachineModal());
    document.getElementById('save-limits-btn').addEventListener('click', saveLimits);

    // Reports
    document.getElementById('generate-report').addEventListener('click', generateReport);
    document.getElementById('export-pdf').addEventListener('click', exportToPDF);
    document.getElementById('export-excel').addEventListener('click', exportToExcel);
    document.getElementById('report-type').addEventListener('change', updateFilterVisibility);

    // Closing
    document.getElementById('close-month-btn').addEventListener('click', closeMonth);
}
function updateLastAccessCard() {
    const currentUser = getCurrentUser();
    
    if (currentUser) {
        const levelNames = {
            'admin': 'Administrador',
            'supervisor': 'Supervisor',
            'operador': 'Operador'
        };
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const dateString = now.toLocaleDateString('pt-BR');
        
        document.getElementById('last-access-name').textContent = currentUser.name || 'Usuário';
        document.getElementById('last-access-username').textContent = currentUser.username || '-';
        document.getElementById('last-access-level').textContent = levelNames[currentUser.level] || currentUser.level;
        document.getElementById('last-access-time').textContent = `${timeString} - ${dateString}`;
    }
}

// Chamar quando mostrar a tab de settings
document.getElementById('settings-tab').addEventListener('click', () => {
    updateLastAccessCard();
});


// Firebase já inicializado, usar a referência do database
const usersRef = database.ref('users');
const accessLogsRef = database.ref('accessLogs');

// Renderizar um item de log
function renderAccessLogItem(username, fullName, level, timestamp, isOnline) {
    const container = document.getElementById('access-log-container');
    if (!container) return null;
    
    username = username || 'N/A';
    fullName = fullName || 'Usuário';
    level = level || 'Usuário';
    isOnline = isOnline || false;
    
    if (!timestamp) return null;
    
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateString = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const initial = fullName.charAt(0).toUpperCase();
    
    const logItem = document.createElement('div');
    logItem.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: white;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        border-left: 3px solid ${isOnline ? '#10b981' : '#06b6d4'};
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        transition: transform 0.2s, box-shadow 0.2s;
        min-width: 0;
    `;
    
    logItem.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0;">
            <div style="width: 40px; height: 40px; min-width: 40px; background: linear-gradient(135deg, ${isOnline ? '#10b981' : '#06b6d4'} 0%, ${isOnline ? '#059669' : '#0891b2'} 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1rem; flex-shrink: 0; position: relative;">
                ${initial}
                ${isOnline ? '<span style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: #22c55e; border: 2px solid white; border-radius: 50%;"></span>' : ''}
            </div>
            <div style="flex: 1; min-width: 0; overflow: hidden;">
                <h4 style="font-weight: 600; font-size: 0.875rem; color: #1f2937; margin: 0 0 0.25rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${fullName} ${isOnline ? '<span style="color: #10b981; font-size: 0.75rem;">● Online</span>' : ''}
                </h4>
                <p style="font-size: 0.75rem; color: #6b7280; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    @${username} • ${level}
                </p>
            </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; flex-shrink: 0; margin-left: 0.5rem;">
            <span style="font-weight: 700; font-size: 0.875rem; color: ${isOnline ? '#10b981' : '#06b6d4'}; white-space: nowrap;">
                ${timeString}
            </span>
            <span style="font-size: 0.75rem; color: #9ca3af; white-space: nowrap;">
                ${dateString}
            </span>
        </div>
    `;
    
    logItem.addEventListener('mouseenter', function() {
        this.style.transform = 'translateX(4px)';
        this.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
    });
    
    logItem.addEventListener('mouseleave', function() {
        this.style.transform = 'translateX(0)';
        this.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
    });
    
    return logItem;
}

// Atualizar exibição dos logs em tempo real do Firebase
function setupAccessLogsListener() {
    const container = document.getElementById('access-log-container');
    if (!container) return;
    
    // Escutar mudanças nos logs de acesso
    accessLogsRef.orderByChild('timestamp').limitToLast(3).on('value', (snapshot) => {
        container.innerHTML = '';
        
        const logs = [];
        snapshot.forEach((childSnapshot) => {
            const log = childSnapshot.val();
            logs.push(log);
        });
        
        // Inverter para mostrar mais recente primeiro
        logs.reverse();
        
        if (logs.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.875rem;">Nenhum acesso registrado</p>';
        } else {
            logs.forEach(log => {
                const logItem = renderAccessLogItem(
                    log.username, 
                    log.fullName, 
                    log.level, 
                    log.timestamp, 
                    log.isOnline
                );
                if (logItem) {
                    container.appendChild(logItem);
                }
            });
        }
    });
}

// Adicionar log de acesso no Firebase
function addAccessLogToFirebase(userId, username, fullName, level) {
    const timestamp = new Date().toISOString();
    
    // Criar novo log
    const newLogRef = accessLogsRef.push();
    newLogRef.set({
        userId: userId,
        username: username,
        fullName: fullName,
        level: level,
        timestamp: timestamp,
        isOnline: true
    });
    
    // Limpar logs antigos (manter apenas 3)
    accessLogsRef.once('value', (snapshot) => {
        const logs = [];
        snapshot.forEach((childSnapshot) => {
            logs.push({
                key: childSnapshot.key,
                timestamp: childSnapshot.val().timestamp
            });
        });
        
        // Ordenar por timestamp e remover os mais antigos
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (logs.length > 3) {
            logs.slice(3).forEach(log => {
                accessLogsRef.child(log.key).remove();
            });
        }
    });
}

// Marcar usuário como online no Firebase
function setUserOnlineFirebase(userId, username, fullName, level) {
    usersRef.child(userId).update({
        online: true,
        lastAccess: new Date().toISOString()
    });
    
    // Adicionar log de acesso
    addAccessLogToFirebase(userId, username, fullName, level);
}

// Marcar usuário como offline no Firebase
function setUserOfflineFirebase(userId) {
    usersRef.child(userId).update({
        online: false
    });
    
    // Atualizar status nos logs
    accessLogsRef.orderByChild('userId').equalTo(userId).once('value', (snapshot) => {
        snapshot.forEach((childSnapshot) => {
            accessLogsRef.child(childSnapshot.key).update({
                isOnline: false
            });
        });
    });
}

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    // Buscar usuário no Firebase
    usersRef.once('value', (snapshot) => {
        let userFound = null;
        let userId = null;
        
        snapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();
            if (user.username === username && user.password === password) {
                userFound = user;
                userId = childSnapshot.key;
            }
        });
        
        if (userFound && userId) {
            currentUser = { ...userFound, id: userId };
            localStorage.setItem('currentUser', JSON.stringify({ id: userId }));
            
            // Marcar como online no Firebase
            setUserOnlineFirebase(
                userId,
                userFound.username || 'N/A',
                userFound.name || 'Usuário',
                userFound.level || 'Usuário'
            );
            
            showMainApp();
            showToast('Login realizado com sucesso!');
        } else {
            const errorDiv = document.getElementById('login-error');
            if (errorDiv) {
                errorDiv.querySelector('p').textContent = 'Usuário ou senha inválidos';
                errorDiv.classList.remove('hidden');
            }
        }
    });
}

function handleLogout() {
    if (currentUser && currentUser.id) {
        setUserOfflineFirebase(currentUser.id);
    }
    
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
    }
}

// Inicializar listener quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    setupAccessLogsListener();
});



function showMainApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    const roleNames = { admin: 'Administrador', leader: 'Líder de Turno', operator: 'Operador' };
    let userInfo = `${currentUser.name} - ${roleNames[currentUser.role]}`;
    if (currentUser.shift) userInfo += ` (Turno ${currentUser.shift})`;
    document.getElementById('user-info').textContent = userInfo;

    const isAdminOrLeader = ['admin', 'leader'].includes(currentUser.role);
    const isAdmin = currentUser.role === 'admin';

    document.getElementById('operators-tab').classList.toggle('hidden', !isAdminOrLeader);
    document.getElementById('closing-tab').classList.toggle('hidden', !isAdminOrLeader);
    document.getElementById('settings-tab').classList.toggle('hidden', !isAdmin);

    document.getElementById('mobile-more-operators').classList.toggle('hidden', !isAdminOrLeader);
    document.getElementById('mobile-more-closing').classList.toggle('hidden', !isAdminOrLeader);
    document.getElementById('mobile-more-settings').classList.toggle('hidden', !isAdmin);

    updateDashboard();
    updateProductionView();
    updateOperatorsView();
    OperatorsManager.init();
    updateSettingsView();
    updateClosingView();
    populateFilterSelects();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('tab-active');
        btn.classList.add('text-gray-600', 'hover:bg-gray-100');
    });
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.classList.add('tab-active');
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.classList.remove('text-gray-600', 'hover:bg-gray-100');

    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
        btn.classList.remove('text-cyan-600');
        btn.classList.add('text-gray-500');
    });
    document.querySelector(`.mobile-tab-btn[data-tab="${tabId}"]`)?.classList.add('text-cyan-600');
    document.querySelector(`.mobile-tab-btn[data-tab="${tabId}"]`)?.classList.remove('text-gray-500');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(`${tabId}-content`)?.classList.remove('hidden');
}

function switchMachine(machineNum) {
    selectedMachine = machineNum;

    document.querySelectorAll('.machine-tab').forEach(btn => {
        btn.classList.remove('tab-active');
        btn.classList.add('text-gray-600', 'bg-white', 'card-shadow', 'hover:bg-gray-50');
    });

    const activeTab = document.querySelector(`.machine-tab[data-machine="${machineNum}"]`);
    activeTab.classList.add('tab-active');
    activeTab.classList.remove('text-gray-600', 'bg-white', 'card-shadow', 'hover:bg-gray-50');

    updateProductionView();
}

function toggleProductionView(view) {
    const calendarView = document.getElementById('calendar-view');
    const tableView = document.getElementById('table-view');
    const calendarBtn = document.getElementById('calendar-view-btn');
    const tableBtn = document.getElementById('table-view-btn');

    if (view === 'calendar') {
        calendarView.classList.remove('hidden');
        tableView.classList.add('hidden');
        calendarBtn.classList.add('primary-gradient', 'text-white');
        calendarBtn.classList.remove('text-gray-600', 'hover:bg-gray-100');
        tableBtn.classList.remove('primary-gradient', 'text-white');
        tableBtn.classList.add('text-gray-600', 'hover:bg-gray-100');
    } else {
        calendarView.classList.add('hidden');
        tableView.classList.remove('hidden');
        tableBtn.classList.add('primary-gradient', 'text-white');
        tableBtn.classList.remove('text-gray-600', 'hover:bg-gray-100');
        calendarBtn.classList.remove('primary-gradient', 'text-white');
        calendarBtn.classList.add('text-gray-600', 'hover:bg-gray-100');
    }
}

function navigateMonth(delta) {
    // Get current custom month range
    const { startDate } = getCustomMonthRange(currentMonth);

    // Move by delta months from the start of the current custom month
    const newDate = new Date(startDate);
    newDate.setMonth(newDate.getMonth() + delta);

    currentMonth = newDate;

    updateDashboard();
    updateProductionView();
}




// Dashboard
function updateDashboard() {
    const monthKey = getMonthKey(currentMonth);
    document.getElementById('current-month-dash').textContent = formatMonthYear(currentMonth);
    document.getElementById('current-month-prod').textContent = formatMonthYear(currentMonth);

    // Filter by CUSTOM month
    const filtered = getFilteredProductions().filter(p =>
        isDateInCustomMonth(p.date, currentMonth)
    );

    const totalQuantity = filtered.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalDowntime = filtered.reduce((sum, p) => sum + (p.downtime || 0), 0);
    const uniqueDays = [...new Set(filtered.map(p => p.date))].length;
    const average = uniqueDays > 0 ? Math.round(totalQuantity / uniqueDays) : 0;

    document.getElementById('stat-total').textContent = totalQuantity.toLocaleString();
    document.getElementById('stat-average').textContent = average.toLocaleString();
    document.getElementById('stat-downtime').textContent = `${totalDowntime}h`;
    document.getElementById('stat-days').textContent = uniqueDays;

    // Machine stats
    const machineStatsHtml = Object.entries(machines).map(([id, machine]) => {
        const machineProds = filtered.filter(p => p.machineId === id);
        const machineTotal = machineProds.reduce((sum, p) => sum + (p.quantity || 0), 0);
        const percentage = machine.target > 0 ? Math.min(100, (machineTotal / (machine.target * 30)) * 100) : 0;

        return `
          <div class="flex items-center gap-3">
            <div class="w-24 text-sm font-medium text-gray-700">${machine.name}</div>
            <div class="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full primary-gradient rounded-full transition-all" style="width: ${percentage}%"></div>
            </div>
            <div class="w-20 text-right text-sm text-gray-600">${machineTotal.toLocaleString()}</div>
          </div>
        `;
    }).join('');

    document.getElementById('machine-stats').innerHTML = machineStatsHtml || '<p class="text-gray-500 text-center">Nenhuma máquina</p>';

    // Recent records
    const recent = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    const recentHtml = recent.map(p => {
        const machine = machines[p.machineId];
        const operator = operators[p.operatorId];

        return `
          <div class="p-3 rounded-lg ${getProductionClass(p.quantity)}">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-800">${formatDate(p.date)}</span>
                ${operator ? getShiftBadge(operator.shift) : ''}
              </div>
              <span class="font-bold text-gray-800">${(p.quantity || 0).toLocaleString()}</span>
            </div>
            <div class="text-sm text-gray-600 mt-1">
              ${machine?.name || 'N/A'} - ${operator?.name || 'N/A'}
            </div>
          </div>
        `;
    }).join('');

    document.getElementById('recent-records').innerHTML = recentHtml || '<p class="text-gray-500 text-center py-4">Nenhum registro</p>';
}



// Production View
function updateProductionView() {
    const monthKey = getMonthKey(currentMonth);
    const { startDate, endDate } = getCustomMonthRange(currentMonth);

    const currentMachine = Object.entries(machines).find(([id, m]) => m.name.includes(selectedMachine));

    if (!currentMachine) {
        document.getElementById('calendar-days').innerHTML = '<p class="col-span-7 text-center text-gray-500 py-4">Configure as máquinas primeiro</p>';
        document.getElementById('monthly-table-body').innerHTML = '';
        return;
    }

    const [machineId, machineData] = currentMachine;
    const filtered = getFilteredProductions().filter(p =>
        isDateInCustomMonth(p.date, currentMonth) && p.machineId === machineId
    );

    // Calendar - iterate from 26th to 25th
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let calendarHtml = '';
    const currentDate = new Date(startDate);

    // Add empty cells for days before the start day of week
    const firstDayOfWeek = startDate.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
        calendarHtml += '<div class="aspect-square"></div>';
    }

    // Iterate through all days in the custom month (26th to 25th)
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayDate = new Date(currentDate);
        const hasData = filtered.some(p => p.date === dateStr);
        const isFuture = dayDate > today;
        const isToday = dayDate.getTime() === today.getTime();

        let dayClass = 'calendar-day cursor-pointer rounded-lg flex items-center justify-center aspect-square font-medium text-sm';

        if (isFuture) {
            dayClass += ' future disabled';
        } else if (hasData) {
            dayClass += ' has-data';
        } else {
            dayClass += ' no-data';
        }

        if (isToday) dayClass += ' ring-2 ring-cyan-500';

        const dayProduction = filtered.find(p => p.date === dateStr);

        calendarHtml += `
          <div class="${dayClass}" data-date="${dateStr}"
            ${isFuture ? '' : `
              onclick="${dayProduction
                    ? `showProductionModal('${dateStr}', '${dayProduction.id}')`
                    : `showProductionModal('${dateStr}')`
                }"
            `}>
            ${currentDate.getDate()}
          </div>
        `;

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    document.getElementById('calendar-days').innerHTML = calendarHtml;

    // Table - iterate from 26th to 25th
    const isClosed = isMonthClosed(monthKey);
    let tableHtml = '';

    const tableDate = new Date(startDate);
    while (tableDate <= endDate) {
        const dateStr = tableDate.toISOString().split('T')[0];
        const dayDate = new Date(tableDate);
        const isFuture = dayDate > today;
        const dayProds = filtered.filter(p => p.date === dateStr);

        if (dayProds.length > 0) {
            dayProds.forEach(p => {
                const operator = operators[p.operatorId];
                tableHtml += `
              <tr class="${getProductionClass(p.quantity)}">
                <td>${formatDate(dateStr)}</td>
                <td>${operator ? getShiftBadge(operator.shift) : '-'}</td>
                <td>${operator?.name || '-'}</td>
                <td class="font-semibold">${(p.quantity || 0).toLocaleString()}</td>
                <td>${p.downtime || 0}h</td>
                <td>
                  ${!isClosed && !isFuture ? `
                    <button onclick="showProductionModal('${dateStr}', '${p.id}')" class="action-btn bg-cyan-100 text-cyan-700 hover:bg-cyan-200 mr-2">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteProduction('${p.id}')" class="action-btn bg-red-100 text-red-700 hover:bg-red-200">
                      <i class="fas fa-trash"></i>
                    </button>
                  ` : '<span class="text-gray-400">-</span>'}
                </td>
              </tr>
            `;
            });
        } else if (!isFuture) {
            tableHtml += `
            <tr class="empty-row">
              <td class="text-gray-400">${formatDate(dateStr)}</td>
              <td class="text-gray-400">-</td>
              <td class="text-gray-400">-</td>
              <td class="text-gray-400">-</td>
              <td class="text-gray-400">-</td>
              <td>
                ${!isClosed ? `
                  <button onclick="showProductionModal('${dateStr}')" class="text-cyan-600 hover:text-cyan-800 text-sm font-medium">
                    <i class="fas fa-plus mr-1"></i>Adicionar
                  </button>
                ` : '-'}
              </td>
            </tr>
          `;
        }

        // Move to next day
        tableDate.setDate(tableDate.getDate() + 1);
    }

    document.getElementById('monthly-table-body').innerHTML = tableHtml || '<tr><td colspan="6" class="text-center py-8 text-gray-500">Nenhum registro</td></tr>';
}

async function showProductionModal(date, productionId = null) {
    const monthKey = getMonthKey(new Date(date + 'T00:00:00'));

    // 🔒 Verifica se o mês está fechado
    const closed = await isMonthClosed(monthKey);

    // ❌ Se estiver fechado, NÃO abre modal
    if (closed) {
        showToast('Este mês está fechado. Não é possível criar ou editar registros.', 'error');
        return;
    }

    // =========================
    // ABAIXO CONTINUA NORMAL
    // =========================

    const currentMachine = Object.entries(machines)
        .find(([id, m]) => m.name.includes(selectedMachine));

    const machineId = currentMachine?.[0];

    let filteredOps = Object.entries(operators);
    if (!canViewAllShifts()) {
        filteredOps = filteredOps.filter(
            ([id, o]) => o.shift === getUserShift()
        );
    }

    let production = null;
    if (productionId) {
        production = productions[productionId];
    }

    const lastOperatorKey = `lastOperator_${machineId}`;
    const lastOperatorId = localStorage.getItem(lastOperatorKey);

    const defaultOperatorId =
        production?.operatorId ||
        lastOperatorId ||
        currentMachine?.[1]?.defaultOperatorId ||
        '';

    const operatorOptions = filteredOps.map(([id, op]) =>
        `<option value="${id}" ${defaultOperatorId === id ? 'selected' : ''}>
            ${op.name} (Turno ${op.shift})
        </option>`
    ).join('');

    const content = `
        <form id="production-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input type="date" id="prod-date" value="${date}" readonly
                    class="w-full px-3 py-2 border rounded-lg bg-gray-100">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Máquina</label>
                <input type="text" value="${currentMachine?.[1]?.name || ''}" readonly
                    class="w-full px-3 py-2 border rounded-lg bg-gray-100">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Operador</label>
                <select id="prod-operator" required
                    class="w-full px-3 py-2 border rounded-lg">
                    <option value="">Selecione...</option>
                    ${operatorOptions}
                </select>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input type="number" id="prod-quantity" required min="0"
                    class="w-full px-3 py-2 border rounded-lg">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tempo Parado (h)</label>
                <input type="number" id="prod-downtime" min="0"
                    class="w-full px-3 py-2 border rounded-lg">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea id="prod-observations" rows="3"
                    class="w-full px-3 py-2 border rounded-lg"></textarea>
            </div>

            <button type="submit"
                class="w-full primary-gradient text-white font-semibold py-3 rounded-lg">
                <i class="fas fa-save mr-2"></i> Salvar
            </button>
        </form>
    `;

    const modal = showModal(content, {
        title: production ? 'Editar Registro' : 'Novo Registro'
    });

    document.getElementById('production-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            date: document.getElementById('prod-date').value,
            machineId,
            operatorId: document.getElementById('prod-operator').value,
            quantity: parseInt(document.getElementById('prod-quantity').value) || 0,
            downtime: parseInt(document.getElementById('prod-downtime').value) || 0,
            observations: document.getElementById('prod-observations').value
        };

        await database.ref('productions').push(data);
        showToast('Registro salvo!');
        closeModal(modal);
    });
}


async function deleteProduction(id) {
    const content = `
        <div class="text-center">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
          </div>
          <p class="text-gray-600 mb-6">Tem certeza que deseja excluir?</p>
          <div class="flex gap-3">
            <button id="cancel-delete" class="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button id="confirm-delete" class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"><i class="fas fa-trash mr-2"></i>Excluir</button>
          </div>
        </div>
      `;

    const modal = showModal(content, { title: 'Confirmar Exclusão' });

    document.getElementById('cancel-delete').onclick = () => closeModal(modal);
    document.getElementById('confirm-delete').onclick = async () => {
        await database.ref(`productions/${id}`).remove();
        closeModal(modal);
        showToast('Registro excluído!');
    };
}


// Operators View - Optimized
const OperatorsManager = {
    // Cache DOM elements
    operatorsGrid: null,

    init() {
        this.operatorsGrid = document.getElementById('operators-grid');
    },

    updateView() {
        if (!['admin', 'leader'].includes(currentUser?.role)) return;

        const myOperators = this.getFilteredOperators();
        const html = this.renderOperatorCards(myOperators);

        if (this.operatorsGrid) {
            this.operatorsGrid.innerHTML = html;
        }
    },

    getFilteredOperators() {
        const entries = Object.entries(operators);

        if (currentUser.role === 'leader') {
            return entries.filter(([, op]) => op.shift === currentUser.shift);
        }

        return entries;
    },

    renderOperatorCards(operatorsList) {
        if (!operatorsList.length) {
            return '<div class="col-span-full text-center py-12"><p class="text-gray-500">Nenhum operador cadastrado</p></div>';
        }

        return operatorsList.map(([id, op]) => `
      <div class="operator-card">
        <div class="flex items-start justify-between mb-4">
          <div class="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-xl flex items-center justify-center">
            <i class="fas fa-user text-cyan-600 text-xl"></i>
          </div>
          ${getShiftBadge(op.shift)}
        </div>
        <h4 class="font-bold text-gray-800 mb-2 text-lg">${this.escapeHtml(op.name)}</h4>
        <div class="flex gap-2 mt-4">
          <button onclick="OperatorsManager.showModal('${id}')" class="flex-1 px-3 py-2 bg-cyan-50 text-cyan-700 rounded-lg text-sm font-medium hover:bg-cyan-100 transition-all border border-cyan-200">
            <i class="fas fa-edit mr-1"></i>Editar
          </button>
          <button onclick="OperatorsManager.delete('${id}')" class="flex-1 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-all border border-red-200">
            <i class="fas fa-trash mr-1"></i>Excluir
          </button>
        </div>
      </div>
    `).join('');
    },

    showModal(operatorId = null) {
        const operator = operatorId ? operators[operatorId] : null;
        const userShift = currentUser.shift;
        const isAdmin = currentUser.role === 'admin';

        const shiftField = isAdmin
            ? this.renderShiftSelect(operator?.shift)
            : this.renderShiftReadonly(userShift);

        const content = `
      <form id="my-operator-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nome <span class="text-red-500">*</span></label>
          <input type="text" id="my-operator-name" value="${this.escapeHtml(operator?.name || '')}" required 
                 class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
                 maxlength="50">
        </div>
        ${shiftField}
        <button type="submit" class="w-full primary-gradient text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-all">
          <i class="fas fa-save mr-2"></i>${operator ? 'Atualizar' : 'Salvar'}
        </button>
      </form>
    `;

        const modal = showModal(content, { title: operator ? 'Editar Operador' : 'Novo Operador' });

        this.attachFormHandler(modal, operatorId, operator, userShift);
    },

    renderShiftSelect(selectedShift = '') {
        const shifts = ['1', '2', '3'];
        const options = shifts.map(shift =>
            `<option value="${shift}" ${selectedShift === shift ? 'selected' : ''}>Turno ${shift}</option>`
        ).join('');

        return `
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Turno <span class="text-red-500">*</span></label>
        <select id="my-operator-shift" required class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
          ${options}
        </select>
      </div>
    `;
    },

    renderShiftReadonly(shift) {
        return `
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Turno</label>
        <input type="text" value="Turno ${shift}" readonly 
               class="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
      </div>
    `;
    },

    attachFormHandler(modal, operatorId, operator, userShift) {
        const form = document.getElementById('my-operator-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nameInput = document.getElementById('my-operator-name');
            const shiftSelect = document.getElementById('my-operator-shift');

            if (!nameInput || !nameInput.value.trim()) {
                showToast('Nome é obrigatório!', 'error');
                return;
            }

            const shift = currentUser.role === 'admin' && shiftSelect
                ? shiftSelect.value
                : userShift;

            const data = {
                name: nameInput.value.trim(),
                shift: shift
            };

            try {
                if (operator && operatorId) {
                    await database.ref(`operators/${operatorId}`).update(data);
                    showToast('Operador atualizado com sucesso!');
                } else {
                    await database.ref('operators').push(data);
                    showToast('Operador criado com sucesso!');
                }
                closeModal(modal);
            } catch (error) {
                console.error('Erro ao salvar operador:', error);
                showToast('Erro ao salvar operador. Tente novamente.', 'error');
            }
        });
    },

    async delete(id) {
        if (!id || !operators[id]) {
            showToast('Operador não encontrado!', 'error');
            return;
        }

        const content = `
      <div class="text-center">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
        </div>
        <p class="text-gray-600 mb-2 font-medium">Tem certeza que deseja excluir?</p>
        <p class="text-gray-500 text-sm mb-6">${this.escapeHtml(operators[id].name)}</p>
        <div class="flex gap-3">
          <button id="cancel-delete-op" class="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button id="confirm-delete-op" class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            <i class="fas fa-trash mr-2"></i>Excluir
          </button>
        </div>
      </div>
    `;

        const modal = showModal(content, { title: 'Confirmar Exclusão' });

        const cancelBtn = document.getElementById('cancel-delete-op');
        const confirmBtn = document.getElementById('confirm-delete-op');

        if (cancelBtn) {
            cancelBtn.onclick = () => closeModal(modal);
        }

        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                try {
                    await database.ref(`operators/${id}`).remove();
                    closeModal(modal);
                    showToast('Operador excluído com sucesso!');
                } catch (error) {
                    console.error('Erro ao excluir operador:', error);
                    showToast('Erro ao excluir operador. Tente novamente.', 'error');
                }
            };
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Settings Manager - Optimized
const SettingsManager = {
    // Cache DOM elements
    usersTableBody: null,
    operatorsTableBody: null,
    machinesTableBody: null,
    lowLimitInput: null,
    highLimitInput: null,

    init() {
        this.usersTableBody = document.getElementById('users-table-body');
        this.operatorsTableBody = document.getElementById('operators-table-body');
        this.machinesTableBody = document.getElementById('machines-table-body');
        this.lowLimitInput = document.getElementById('low-limit');
        this.highLimitInput = document.getElementById('high-limit');
    },

    updateView() {
        if (currentUser?.role !== 'admin') return;

        this.renderUsers();
        this.renderOperators();
        this.renderMachines();
        this.renderLimits();
    },

    renderUsers() {
        if (!this.usersTableBody) return;

        const entries = Object.entries(users);

        if (!entries.length) {
            this.usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500">Nenhum usuário cadastrado</td></tr>';
            return;
        }

        const html = entries.map(([id, user]) => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3">${this.escapeHtml(user.username)}</td>
        <td class="px-4 py-3">${this.escapeHtml(user.name)}</td>
        <td class="px-4 py-3">${this.getRoleLabel(user.role)}</td>
        <td class="px-4 py-3">${user.shift ? getShiftBadge(user.shift) : '<span class="text-gray-400">-</span>'}</td>
        <td class="px-4 py-3">
          ${user.role !== 'admin' ? `
            <button onclick="SettingsManager.showUserModal('${id}')" 
                    class="text-cyan-600 hover:text-cyan-800 mr-3 transition-colors" 
                    title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="SettingsManager.deleteItem('users', '${id}')" 
                    class="text-red-600 hover:text-red-800 transition-colors" 
                    title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          ` : '<span class="text-gray-400">-</span>'}
        </td>
      </tr>
    `).join('');

        this.usersTableBody.innerHTML = html;
    },

    renderOperators() {
        if (!this.operatorsTableBody) return;

        const entries = Object.entries(operators);

        if (!entries.length) {
            this.operatorsTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-gray-500">Nenhum operador cadastrado</td></tr>';
            return;
        }

        const html = entries.map(([id, op]) => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3">${this.escapeHtml(op.name)}</td>
        <td class="px-4 py-3">${getShiftBadge(op.shift)}</td>
        <td class="px-4 py-3">
          <button onclick="SettingsManager.showOperatorModal('${id}')" 
                  class="text-cyan-600 hover:text-cyan-800 mr-3 transition-colors" 
                  title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="SettingsManager.deleteItem('operators', '${id}')" 
                  class="text-red-600 hover:text-red-800 transition-colors" 
                  title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

        this.operatorsTableBody.innerHTML = html;
    },

    renderMachines() {
        if (!this.machinesTableBody) return;

        const entries = Object.entries(machines);

        if (!entries.length) {
            this.machinesTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-gray-500">Nenhuma máquina cadastrada</td></tr>';
            return;
        }

        const html = entries.map(([id, machine]) => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3">${this.escapeHtml(machine.name)}</td>
        <td class="px-4 py-3">${(machine.target || 0).toLocaleString('pt-BR')}</td>
        <td class="px-4 py-3">
          <button onclick="SettingsManager.showMachineModal('${id}')" 
                  class="text-cyan-600 hover:text-cyan-800 mr-3 transition-colors" 
                  title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="SettingsManager.deleteItem('machines', '${id}')" 
                  class="text-red-600 hover:text-red-800 transition-colors" 
                  title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

        this.machinesTableBody.innerHTML = html;
    },

    renderLimits() {
        if (this.lowLimitInput) {
            this.lowLimitInput.value = settings.lowLimit || 500;
        }
        if (this.highLimitInput) {
            this.highLimitInput.value = settings.highLimit || 1000;
        }
    },

    getRoleLabel(role) {
        const roles = {
            'admin': '<span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">ADM</span>',
            'leader': '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Líder</span>',
            'operator': '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Func</span>'
        };
        return roles[role] || role;
    },

    showUserModal(userId = null) {
        const user = userId ? users[userId] : null;

        const content = `
      <form id="user-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Usuário <span class="text-red-500">*</span>
          </label>
          <input type="text" id="user-username" 
                 value="${this.escapeHtml(user?.username || '')}" 
                 required 
                 maxlength="30"
                 class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Nome <span class="text-red-500">*</span>
          </label>
          <input type="text" id="user-name" 
                 value="${this.escapeHtml(user?.name || '')}" 
                 required 
                 maxlength="50"
                 class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Senha <span class="text-red-500">*</span>
          </label>
          <input type="password" id="user-password" 
                 value="${this.escapeHtml(user?.password || '')}" 
                 required 
                 minlength="4"
                 maxlength="50"
                 class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Nível <span class="text-red-500">*</span>
          </label>
          <select id="user-role" required 
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
            <option value="leader" ${user?.role === 'leader' ? 'selected' : ''}>Líder de Turno</option>
            <option value="operator" ${user?.role === 'operator' ? 'selected' : ''}>Operador</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Turno</label>
          <select id="user-shift" 
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
            <option value="">Nenhum</option>
            <option value="1" ${user?.shift === '1' ? 'selected' : ''}>1ºTurno</option>
            <option value="2" ${user?.shift === '2' ? 'selected' : ''}>2ºTurno</option>
            <option value="3" ${user?.shift === '3' ? 'selected' : ''}>3ºTurno</option>
          </select>
        </div>
        <button type="submit" 
                class="w-full primary-gradient text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-all">
          <i class="fas fa-save mr-2"></i>${user ? 'Atualizar' : 'Salvar'}
        </button>
      </form>
    `;

        const modal = showModal(content, { title: user ? 'Editar Usuário' : 'Novo Usuário' });

        this.attachUserFormHandler(modal, userId, user);
    },

    attachUserFormHandler(modal, userId, user) {
        const form = document.getElementById('user-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('user-username');
            const nameInput = document.getElementById('user-name');
            const passwordInput = document.getElementById('user-password');
            const roleSelect = document.getElementById('user-role');
            const shiftSelect = document.getElementById('user-shift');

            if (!usernameInput?.value.trim() || !nameInput?.value.trim() || !passwordInput?.value.trim()) {
                showToast('Preencha todos os campos obrigatórios!', 'error');
                return;
            }

            const data = {
                username: usernameInput.value.trim(),
                name: nameInput.value.trim(),
                password: passwordInput.value.trim(),
                role: roleSelect.value,
                shift: shiftSelect.value || null
            };

            try {
                if (user && userId) {
                    await database.ref(`users/${userId}`).update(data);
                    showToast('Usuário atualizado com sucesso!');
                } else {
                    await database.ref('users').push(data);
                    showToast('Usuário criado com sucesso!');
                }
                closeModal(modal);
            } catch (error) {
                console.error('Erro ao salvar usuário:', error);
                showToast('Erro ao salvar usuário. Tente novamente.', 'error');
            }
        });
    },

    showOperatorModal(operatorId = null) {
        const operator = operatorId ? operators[operatorId] : null;

        const content = `
      <form id="operator-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Nome <span class="text-red-500">*</span>
          </label>
          <input type="text" id="operator-name" 
                 value="${this.escapeHtml(operator?.name || '')}" 
                 required 
                 maxlength="50"
                 class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Turno <span class="text-red-500">*</span>
          </label>
          <select id="operator-shift" required 
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
            <option value="1" ${operator?.shift === '1' ? 'selected' : ''}>1ºTurno</option>
            <option value="2" ${operator?.shift === '2' ? 'selected' : ''}>2ºTurno</option>
            <option value="3" ${operator?.shift === '3' ? 'selected' : ''}>3ºTurno</option>
          </select>
        </div>
        <button type="submit" 
                class="w-full primary-gradient text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-all">
          <i class="fas fa-save mr-2"></i>${operator ? 'Atualizar' : 'Salvar'}
        </button>
      </form>
    `;

        const modal = showModal(content, { title: operator ? 'Editar Operador' : 'Novo Operador' });

        this.attachOperatorFormHandler(modal, operatorId, operator);
    },

    attachOperatorFormHandler(modal, operatorId, operator) {
        const form = document.getElementById('operator-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nameInput = document.getElementById('operator-name');
            const shiftSelect = document.getElementById('operator-shift');

            if (!nameInput?.value.trim()) {
                showToast('Nome é obrigatório!', 'error');
                return;
            }

            const data = {
                name: nameInput.value.trim(),
                shift: shiftSelect.value
            };

            try {
                if (operator && operatorId) {
                    await database.ref(`operators/${operatorId}`).update(data);
                    showToast('Operador atualizado com sucesso!');
                } else {
                    await database.ref('operators').push(data);
                    showToast('Operador criado com sucesso!');
                }
                closeModal(modal);
            } catch (error) {
                console.error('Erro ao salvar operador:', error);
                showToast('Erro ao salvar operador. Tente novamente.', 'error');
            }
        });
    },

    showMachineModal(machineId = null) {
        const machine = machineId ? machines[machineId] : null;

        const content = `
      <form id="machine-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Nome <span class="text-red-500">*</span>
          </label>
          <input type="text" id="machine-name" 
                 value="${this.escapeHtml(machine?.name || '')}" 
                 required 
                 maxlength="50"
                 class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Meta Diária <span class="text-red-500">*</span>
          </label>
          <input type="number" id="machine-target" 
                 value="${machine?.target || 1000}" 
                 required 
                 min="0" 
                 max="999999"
                 step="1"
                 class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
        </div>
        <button type="submit" 
                class="w-full primary-gradient text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-all">
          <i class="fas fa-save mr-2"></i>${machine ? 'Atualizar' : 'Salvar'}
        </button>
      </form>
    `;

        const modal = showModal(content, { title: machine ? 'Editar Máquina' : 'Nova Máquina' });

        this.attachMachineFormHandler(modal, machineId, machine);
    },

    attachMachineFormHandler(modal, machineId, machine) {
        const form = document.getElementById('machine-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nameInput = document.getElementById('machine-name');
            const targetInput = document.getElementById('machine-target');

            if (!nameInput?.value.trim()) {
                showToast('Nome é obrigatório!', 'error');
                return;
            }

            const target = parseInt(targetInput.value) || 0;

            if (target < 0) {
                showToast('Meta deve ser um número positivo!', 'error');
                return;
            }

            const data = {
                name: nameInput.value.trim(),
                target: target
            };

            try {
                if (machine && machineId) {
                    await database.ref(`machines/${machineId}`).update(data);
                    showToast('Máquina atualizada com sucesso!');
                } else {
                    await database.ref('machines').push(data);
                    showToast('Máquina criada com sucesso!');
                }
                closeModal(modal);
            } catch (error) {
                console.error('Erro ao salvar máquina:', error);
                showToast('Erro ao salvar máquina. Tente novamente.', 'error');
            }
        });
    },

    async deleteItem(collection, id) {
        if (!collection || !id) {
            showToast('Erro ao excluir item!', 'error');
            return;
        }

        const collections = {
            'users': users,
            'operators': operators,
            'machines': machines
        };

        const item = collections[collection]?.[id];
        if (!item) {
            showToast('Item não encontrado!', 'error');
            return;
        }

        const labels = {
            'users': 'usuário',
            'operators': 'operador',
            'machines': 'máquina'
        };

        const itemName = item.name || item.username || 'este item';

        const content = `
      <div class="text-center">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
        </div>
        <p class="text-gray-600 mb-2 font-medium">Tem certeza que deseja excluir?</p>
        <p class="text-gray-500 text-sm mb-6">${this.escapeHtml(itemName)}</p>
        <div class="flex gap-3">
          <button id="cancel-delete" 
                  class="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button id="confirm-delete" 
                  class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            <i class="fas fa-trash mr-2"></i>Excluir
          </button>
        </div>
      </div>
    `;

        const modal = showModal(content, { title: 'Confirmar Exclusão' });

        const cancelBtn = document.getElementById('cancel-delete');
        const confirmBtn = document.getElementById('confirm-delete');

        if (cancelBtn) {
            cancelBtn.onclick = () => closeModal(modal);
        }

        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                try {
                    await database.ref(`${collection}/${id}`).remove();
                    closeModal(modal);
                    showToast(`${labels[collection].charAt(0).toUpperCase() + labels[collection].slice(1)} excluído com sucesso!`);
                } catch (error) {
                    console.error(`Erro ao excluir ${labels[collection]}:`, error);
                    showToast(`Erro ao excluir ${labels[collection]}. Tente novamente.`, 'error');
                }
            };
        }
    },

    async saveLimits() {
        const lowLimit = parseInt(this.lowLimitInput?.value) || 500;
        const highLimit = parseInt(this.highLimitInput?.value) || 1000;

        if (lowLimit < 0 || highLimit < 0) {
            showToast('Os limites devem ser números positivos!', 'error');
            return;
        }

        if (lowLimit >= highLimit) {
            showToast('O limite baixo deve ser menor que o limite alto!', 'error');
            return;
        }

        try {
            await database.ref('settings').set({ lowLimit, highLimit });
            settings.lowLimit = lowLimit;
            settings.highLimit = highLimit;
            showToast('Limites salvos com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar limites:', error);
            showToast('Erro ao salvar limites. Tente novamente.', 'error');
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    OperatorsManager.init();
    SettingsManager.init();
});

// Legacy function aliases for backwards compatibility
function updateOperatorsView() {
    OperatorsManager.updateView();
}

function showMyOperatorModal(operatorId = null) {
    OperatorsManager.showModal(operatorId);
}

function deleteMyOperator(id) {
    OperatorsManager.delete(id);
}

function updateSettingsView() {
    SettingsManager.updateView();
}

function showUserModal(userId = null) {
    SettingsManager.showUserModal(userId);
}

function showOperatorModal(operatorId = null) {
    SettingsManager.showOperatorModal(operatorId);
}

function showMachineModal(machineId = null) {
    SettingsManager.showMachineModal(machineId);
}

function deleteItem(collection, id) {
    SettingsManager.deleteItem(collection, id);
}

async function saveLimits() {
    return SettingsManager.saveLimits();
}


// Reports
// Função para popular os filtros com dados do Firebase
async function populateFilterSelects() {
    try {
        // Buscar máquinas do Firebase
        const machinesRef = window.firebase.database().ref('machines');
        const machinesSnapshot = await machinesRef.once('value');
        
        if (machinesSnapshot.exists()) {
            const machinesData = machinesSnapshot.val();
            const machineOptions = Object.entries(machinesData).map(([id, m]) =>
                `<option value="${id}">${m.name}</option>`
            ).join('');
            document.getElementById('filter-machine').innerHTML = `<option value="">Todas</option>${machineOptions}`;
        } else {
            document.getElementById('filter-machine').innerHTML = `<option value="">Todas</option>`;
        }

        // Buscar operadores do Firebase
        const operatorsRef = window.firebase.database().ref('operators');
        const operatorsSnapshot = await operatorsRef.once('value');
        
        if (operatorsSnapshot.exists()) {
            const operatorsData = operatorsSnapshot.val();
            let filteredOps = Object.entries(operatorsData);
            
            // Filtrar por turno se necessário
            if (!canViewAllShifts()) {
                const userShift = getUserShift();
                filteredOps = filteredOps.filter(([id, o]) => o.shift === userShift);
            }

            const opOptions = filteredOps.map(([id, o]) =>
                `<option value="${id}">${o.name}</option>`
            ).join('');
            document.getElementById('filter-operator').innerHTML = `<option value="">Todos</option>${opOptions}`;
        } else {
            document.getElementById('filter-operator').innerHTML = `<option value="">Todos</option>`;
        }
    } catch (error) {
        console.error('Erro ao carregar filtros:', error);
        document.getElementById('filter-machine').innerHTML = `<option value="">Todas</option>`;
        document.getElementById('filter-operator').innerHTML = `<option value="">Todos</option>`;
    }
}

function updateFilterVisibility() {
    const reportType = document.getElementById('report-type').value;
    
    const machineContainer = document.getElementById('filter-machine-container');
    const operatorContainer = document.getElementById('filter-operator-container');
    const shiftContainer = document.getElementById('filter-shift-container');
    
    // Esconder todos primeiro
    if (machineContainer) machineContainer.style.display = 'none';
    if (operatorContainer) operatorContainer.style.display = 'none';
    if (shiftContainer) shiftContainer.style.display = 'none';
    
    // Mostrar baseado no tipo de relatório
    switch(reportType) {
        case 'complete':
            if (machineContainer) machineContainer.style.display = 'block';
            if (operatorContainer) operatorContainer.style.display = 'block';
            if (shiftContainer) shiftContainer.style.display = 'block';
            break;
        case 'machine':
            if (machineContainer) machineContainer.style.display = 'block';
            break;
        case 'operator':
            if (operatorContainer) operatorContainer.style.display = 'block';
            break;
        case 'shift':
            if (shiftContainer) shiftContainer.style.display = 'block';
            break;
    }
}

// ================================
// PAGINAÇÃO
// ================================
let reportPage = 1;
const REPORT_PAGE_SIZE = 10;

// ================================
// GERAR RELATÓRIO
// ================================
function generateReport() {
    reportPage = reportPage || 1;

    const reportType = document.getElementById('report-type').value;
    let filtered = getFilteredProductions();

    // Filter by CUSTOM month
    filtered = filtered.filter(p => isDateInCustomMonth(p.date, currentMonth));

    // ✅ REMOVIDO: Filtro hardcoded de máquinas (8, 9, 10)
    // Agora usa TODAS as máquinas disponíveis

    // Apply report type filters
    if (reportType === 'machine') {
        const machineId = document.getElementById('filter-machine')?.value;
        if (machineId && machineId !== '') {
            filtered = filtered.filter(p => p.machineId === machineId);
        }
    }
    else if (reportType === 'operator') {
        const operatorId = document.getElementById('filter-operator')?.value;
        if (operatorId && operatorId !== '') {
            filtered = filtered.filter(p => p.operatorId === operatorId);
        }
    }
    else if (reportType === 'shift') {
        const shift = document.getElementById('filter-shift')?.value;
        if (shift && shift !== '') {
            const opIds = Object.keys(operators)
                .filter(id => operators[id] && operators[id].shift === shift);
            filtered = filtered.filter(p => opIds.includes(p.operatorId));
        }
    }

    // Sort: MACHINE → DATE
    filtered.sort((a, b) => {
        const machineA = machines[a.machineId];
        const machineB = machines[b.machineId];

        if (!machineA || !machineB || !machineA.name || !machineB.name) return 0;

        const ma = parseInt(machineA.name.replace(/\D/g, '')) || 0;
        const mb = parseInt(machineB.name.replace(/\D/g, '')) || 0;

        if (ma !== mb) return ma - mb;

        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
    });

    // ✅ OTIMIZADO: Cálculo de estatísticas ANTES da paginação (uma única iteração)
    const totalQuantity = filtered.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalDowntime = filtered.reduce((sum, p) => sum + (p.downtime || 0), 0);
    const uniqueDays = [...new Set(filtered.map(p => p.date))].length;

    // Pagination
    const totalPages = Math.ceil(filtered.length / REPORT_PAGE_SIZE) || 1;
    if (reportPage > totalPages) reportPage = totalPages;

    const start = (reportPage - 1) * REPORT_PAGE_SIZE;
    const paginated = filtered.slice(start, start + REPORT_PAGE_SIZE);

    // ✅ CORRIGIDO: Usa nomes corretos dos turnos
    const shiftNames = { '1': 'Turno 1', '2': 'Turno 2', '3': 'Turno 3' };

    // Table
    const tableHtml = paginated.map(p => {
        const machine = machines[p.machineId];
        const operator = operators[p.operatorId];
        const shiftName = operator?.shift ? shiftNames[operator.shift] || 'Turno 1' : '-';

        return `
            <tr class="${getProductionClass(p.quantity)}">
                <td>${formatDate(p.date)}</td>
                <td>${machine?.name || '-'}</td>
                <td>${operator ? getShiftBadge(operator.shift) : '-'}</td>
                <td>${operator?.name || '-'}</td>
                <td class="font-semibold">${(p.quantity || 0).toLocaleString()}</td>
                <td>${p.downtime || 0}h</td>
                <td>
                    ${p.observations
                ? `<span class="text-xs bg-yellow-50 px-2 py-1 rounded border border-yellow-200 inline-block max-w-xs truncate" title="${p.observations}">
                                ${p.observations}
                               </span>`
                : '<span class="text-gray-400">-</span>'
            }
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('report-table-body').innerHTML =
        tableHtml ||
        `<tr>
            <td colspan="7" class="text-center py-8 text-gray-500">
                Nenhum registro
            </td>
         </tr>`;

    // Pagination controls
    document.getElementById('report-pagination').innerHTML = `
        <div class="flex justify-center items-center gap-3 mt-4">
            <button
                onclick="changeReportPage(-1)"
                ${reportPage === 1 ? 'disabled' : ''}
                class="px-3 py-1 border rounded ${reportPage === 1 ? 'opacity-40' : ''}">
                ◀
            </button>

            <span class="text-sm">
                Página ${reportPage} de ${totalPages}
            </span>

            <button
                onclick="changeReportPage(1)"
                ${reportPage === totalPages ? 'disabled' : ''}
                class="px-3 py-1 border rounded ${reportPage === totalPages ? 'opacity-40' : ''}">
                ▶
            </button>
        </div>
    `;

    // ✅ Summary já calculado acima (otimizado)
    document.getElementById('report-summary').innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
                <p class="text-xs text-gray-500">Total Produzido</p>
                <p class="text-xl font-bold text-gray-800">${totalQuantity.toLocaleString()}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500">Registros</p>
                <p class="text-xl font-bold text-gray-800">${filtered.length}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500">Tempo Parado</p>
                <p class="text-xl font-bold text-gray-800">${totalDowntime}h</p>
            </div>
            <div>
                <p class="text-xs text-gray-500">Dias com Produção</p>
                <p class="text-xl font-bold text-gray-800">${uniqueDays}</p>
            </div>
        </div>
    `;

    showToast('Relatório gerado!');
}

// ================================
// TROCAR PÁGINA
// ================================
function changeReportPage(step) {
    reportPage += step;
    if (reportPage < 1) reportPage = 1;
    generateReport();
}



// Carregar bibliotecas
const script1 = document.createElement('script');
script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
document.head.appendChild(script1);

const script2 = document.createElement('script');
script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
document.head.appendChild(script2);

// Função auxiliar para converter shift para turno
function getShiftName(shift) {
    const shiftMap = { 'A': '1º Turno', 'B': '2º Turno', 'C': '3º Turno' };
    return shiftMap[shift] || shift;
}


// Função principal de exportação
async function exportToPDF() {
    await new Promise(resolve => {
        const checkLibs = setInterval(() => {
            if (window.jspdf && window.html2canvas) {
                clearInterval(checkLibs);
                resolve();
            }
        }, 100);
    });

    const { jsPDF } = window.jspdf;
    const monthKey = getMonthKey(currentMonth);

    // ✅ FILTRO ADAPTADO PARA MÊS CUSTOMIZADO (26 a 25)
    let filtered = getFilteredProductions()
        .filter(p => isDateInCustomMonth(p.date, currentMonth));
    
    // ✅ ORDENAR: MÁQUINA → DATA
    filtered.sort((a, b) => {
        const machineA = machines[a.machineId];
        const machineB = machines[b.machineId];
        
        if (!machineA || !machineB || !machineA.name || !machineB.name) return 0;
        
        const ma = parseInt(machineA.name.replace(/\D/g, '')) || 0;
        const mb = parseInt(machineB.name.replace(/\D/g, '')) || 0;
        
        if (ma !== mb) return ma - mb;
        
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
    });
    
    if (filtered.length === 0) {
        showToast('Nenhum dado para exportar', 'error');
        return;
    }

    const pdf = new jsPDF('p', 'mm', 'a4');

    // ===== PÁGINA 1: RESUMO GERAL =====
    const totalQuantity = filtered.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalDowntime = filtered.reduce((sum, p) => sum + (p.downtime || 0), 0);
    const uniqueDays = [...new Set(filtered.map(p => p.date))].length;
    const average = uniqueDays > 0 ? Math.round(totalQuantity / uniqueDays) : 0;

    const statsByShift = { '1': { quantity: 0, downtime: 0, count: 0 }, '2': { quantity: 0, downtime: 0, count: 0 }, '3': { quantity: 0, downtime: 0, count: 0 } };
    const operatorStats = {};

    filtered.forEach(p => {
        if (!p) return;

        const operator = operators[p.operatorId];

        // normaliza e valida o turno
        const shift = ['1', '2', '3'].includes(operator?.shift)
            ? operator.shift
            : '1';

        // garante que o turno exista no objeto
        if (!statsByShift[shift]) {
            statsByShift[shift] = { quantity: 0, downtime: 0, count: 0 };
        }

        statsByShift[shift].quantity += p.quantity ?? 0;
        statsByShift[shift].downtime += p.downtime ?? 0;
        statsByShift[shift].count++;

        // estatísticas por operador
        if (!operatorStats[p.operatorId]) {
            operatorStats[p.operatorId] = {
                name: operator?.name || 'N/A',
                shift,
                quantity: 0,
                downtime: 0,
                count: 0
            };
        }

        operatorStats[p.operatorId].quantity += p.quantity ?? 0;
        operatorStats[p.operatorId].downtime += p.downtime ?? 0;
        operatorStats[p.operatorId].count++;
    });

    const topOperators = Object.values(operatorStats).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    const summaryContainer = document.createElement('div');
    summaryContainer.style.cssText = `position: absolute; left: -9999px; top: 0; width: 793px; background: white; font-family: 'Inter', sans-serif;`;

    const appTitle = window.elementSdk?.config?.app_title || 'Controle de Produção';

    summaryContainer.innerHTML = `
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            .pdf-page { width: 793px; min-height: 1122px; background: white; padding: 0; }
            .pdf-header { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; padding: 35px 40px; }
            .pdf-title { font-size: 32px; font-weight: 800; margin-bottom: 8px; display: flex; align-items: center; gap: 15px; }
            .pdf-subtitle { font-size: 16px; opacity: 0.95; font-weight: 500; }
            .pdf-date { font-size: 12px; opacity: 0.85; margin-top: 5px; }
            .content { padding: 40px; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 35px; }
            .stat-card { background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; }
            .stat-icon { width: 50px; height: 50px; background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px; }
            .stat-label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
            .stat-value { color: #0f172a; font-size: 28px; font-weight: 800; }
            .section-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 35px 0 20px; padding-bottom: 10px; border-bottom: 3px solid #0891b2; display: flex; align-items: center; gap: 12px; }
            .section-title i { color: #0891b2; font-size: 20px; }
            .shift-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 35px; }
            .shift-card { background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 12px; overflow: hidden; }
            .shift-header { padding: 15px; color: white; font-weight: 700; text-align: center; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); }
            .shift-body { padding: 15px; }
            .shift-stat { display: flex; justify-content: space-between; padding: 8px 0; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
            .shift-stat:last-child { border-bottom: none; }
            .shift-stat-label { color: #64748b; font-weight: 600; }
            .shift-stat-value { color: #0f172a; font-weight: 800; }
            .top-operators { background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 12px; padding: 20px; }
            .operator-row { display: flex; align-items: center; padding: 12px; background: white; border-radius: 8px; margin-bottom: 10px; border: 1px solid #e2e8f0; }
            .operator-row:last-child { margin-bottom: 0; }
            .operator-rank { width: 40px; height: 40px; background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; margin-right: 15px; }
            .operator-info { flex: 1; display: flex; align-items: center; gap: 20px; }
            .operator-name { font-weight: 700; color: #0f172a; font-size: 13px; min-width: 180px; }
            .operator-shift { padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; color: white; background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); }
            .operator-production { font-weight: 800; color: #0891b2; font-size: 14px; margin-left: auto; margin-right: 20px; }
            .operator-downtime { color: #64748b; font-size: 12px; font-weight: 600; }
        </style>
        
        <div class="pdf-page">
            <div class="pdf-header">
                <div class="pdf-title">
                    <i class="fas fa-chart-bar"></i>
                    ${appTitle}
                </div>
                <div class="pdf-subtitle">Resumo Mensal - ${formatMonthYear(currentMonth)}</div>
                <div class="pdf-date"><i class="far fa-calendar-alt"></i> Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
            </div>
            
            <div class="content">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-cubes"></i></div>
                        <div class="stat-label">Total Produzido</div>
                        <div class="stat-value">${totalQuantity.toLocaleString()}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                        <div class="stat-label">Média Diária</div>
                        <div class="stat-value">${average.toLocaleString()}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-pause-circle"></i></div>
                        <div class="stat-label">Tempo Parado</div>
                        <div class="stat-value">${totalDowntime}h</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
                        <div class="stat-label">Dias Produtivos</div>
                        <div class="stat-value">${uniqueDays}</div>
                    </div>
                </div>
                
                <div class="section-title">
                    <i class="fas fa-clock"></i>
                    Desempenho por Turno
                </div>
                
                <div class="shift-grid">
                    ${['1', '2', '3'].map(shift => `
                        <div class="shift-card">
                            <div class="shift-header">
                                <i class="fas fa-user-clock"></i>
                                ${getShiftName(shift)}
                            </div>
                            <div class="shift-body">
                                <div class="shift-stat">
                                    <span class="shift-stat-label">Produção:</span>
                                    <span class="shift-stat-value">${statsByShift[shift].quantity.toLocaleString()} un</span>
                                </div>
                                <div class="shift-stat">
                                    <span class="shift-stat-label">Paradas:</span>
                                    <span class="shift-stat-value">${statsByShift[shift].downtime}h</span>
                                </div>
                                <div class="shift-stat">
                                    <span class="shift-stat-label">Registros:</span>
                                    <span class="shift-stat-value">${statsByShift[shift].count}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="section-title">
                    <i class="fas fa-trophy"></i>
                    Top 5 Operadores do Mês
                </div>
                
                <div class="top-operators">
                    ${topOperators.map((op, i) => `
                        <div class="operator-row">
                            <div class="operator-rank">${i + 1}</div>
                            <div class="operator-info">
                                <div class="operator-name"><i class="fas fa-user"></i> ${op.name}</div>
                                <div class="operator-shift">${getShiftName(op.shift)}</div>
                                <div class="operator-production">${op.quantity.toLocaleString()} un</div>
                                <div class="operator-downtime">${op.downtime}h parado</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(summaryContainer);

    try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const canvas = await html2canvas(summaryContainer, { 
            scale: 2, 
            useCORS: true, 
            logging: false, 
            backgroundColor: '#ffffff',
            width: 793,
            windowWidth: 793
        });
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = 210;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
    } catch (error) {
        console.error('Erro ao gerar resumo do PDF:', error);
        showToast('Erro ao gerar página de resumo do PDF', 'error');
    } finally {
        document.body.removeChild(summaryContainer);
    }

    // ===== PÁGINAS SEGUINTES: TABELA POR OPERADOR =====
    const byOperator = {};
    filtered.forEach(p => {
        if (!byOperator[p.operatorId]) {
            byOperator[p.operatorId] = { operator: operators[p.operatorId], productions: [] };
        }
        byOperator[p.operatorId].productions.push(p);
    });

    for (const [opId, data] of Object.entries(byOperator)) {
        pdf.addPage();

        const operator = data.operator;
        
        // ✅ ORDENAR: MÁQUINA → DATA (para cada operador)
        const prods = data.productions.sort((a, b) => {
            const machineA = machines[a.machineId];
            const machineB = machines[b.machineId];
            
            if (!machineA || !machineB || !machineA.name || !machineB.name) return 0;
            
            const ma = parseInt(machineA.name.replace(/\D/g, '')) || 0;
            const mb = parseInt(machineB.name.replace(/\D/g, '')) || 0;
            
            if (ma !== mb) return ma - mb;
            
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA.getTime() - dateB.getTime();
        });
        
        const total = prods.reduce((sum, p) => sum + (p.quantity || 0), 0);
        const downtime = prods.reduce((sum, p) => sum + (p.downtime || 0), 0);
        const uniqueOpDays = [...new Set(prods.map(p => p.date))].length;
        const avgPerDay = uniqueOpDays > 0 ? Math.round(total / uniqueOpDays) : 0;

        // ✅ PAGINAÇÃO INTELIGENTE: Dividir registros em grupos que cabem em uma página A4
        const RECORDS_PER_PAGE = 25; // Quantidade segura de registros por página
        const totalPages = Math.ceil(prods.length / RECORDS_PER_PAGE);

        for (let pageNum = 0; pageNum < totalPages; pageNum++) {
            if (pageNum > 0) {
                pdf.addPage();
            }

            const startIdx = pageNum * RECORDS_PER_PAGE;
            const endIdx = Math.min(startIdx + RECORDS_PER_PAGE, prods.length);
            const pageProds = prods.slice(startIdx, endIdx);

            const detailContainer = document.createElement('div');
            detailContainer.style.cssText = `position: absolute; left: -9999px; top: 0; width: 793px; background: white; font-family: 'Inter', sans-serif;`;

            detailContainer.innerHTML = `
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    .pdf-page { width: 793px; min-height: 1122px; background: white; padding: 0; }
                    
                    .pdf-header { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; padding: 14px 30px; display: flex; justify-content: space-between; align-items: center; }
                    .header-left { flex: 1; }
                    .pdf-title { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
                    .pdf-subtitle { font-size: 9px; opacity: 0.95; }
                    
                    .operator-info-header { background: rgba(255,255,255,0.15); padding: 6px 10px; border-radius: 6px; }
                    .operator-name-big { font-size: 13px; font-weight: 800; margin-bottom: 2px; display: flex; align-items: center; gap: 5px; }
                    .operator-stats-header { display: flex; gap: 10px; font-size: 8px; margin-top: 2px; }
                    
                    .content { padding: 14px 30px; }
                    
                    .stats-mini-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
                    .stat-mini-card { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 5px; padding: 6px; text-align: center; }
                    .stat-mini-icon { width: 24px; height: 24px; background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; border-radius: 5px; display: flex; align-items: center; justify-content: center; margin: 0 auto 4px; font-size: 11px; }
                    .stat-mini-label { color: #64748b; font-size: 6.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px; }
                    .stat-mini-value { color: #0f172a; font-size: 13px; font-weight: 800; }
                    
                    .section-title-small { font-size: 11px; font-weight: 800; color: #0f172a; margin: 10px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #0891b2; display: flex; align-items: center; justify-content: space-between; }
                    .section-title-left { display: flex; align-items: center; gap: 5px; }
                    .section-title-left i { color: #0891b2; font-size: 11px; }
                    .page-indicator { font-size: 8px; color: #64748b; font-weight: 600; }
                    
                    .prod-table { width: 100%; border-collapse: collapse; background: white; border: 1.5px solid #cbd5e1; border-radius: 7px; overflow: hidden; }
                    .prod-table thead { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; }
                    .prod-table th { padding: 7px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
                    
                    .prod-table tbody tr { border-bottom: 1px solid #e2e8f0; }
                    .prod-table tbody tr:last-child { border-bottom: none; }
                    .prod-table tbody tr:nth-child(even) { background: #f8fafc; }
                    .prod-table tbody tr:hover { background: #f0f9ff; }
                    
                    .prod-table td { padding: 6px 8px; font-size: 9px; color: #1e293b; line-height: 1.4; }
                    
                    .prod-table td.date-col { font-weight: 700; color: #0891b2; }
                    .prod-table td.machine-col { font-weight: 600; }
                    .prod-table td.quantity-col { font-weight: 800; color: #0891b2; text-align: center; }
                    .prod-table td.downtime-col { font-weight: 600; color: #64748b; text-align: center; }
                    .prod-table td.obs-col { color: #64748b; font-style: italic; max-width: 220px; word-wrap: break-word; white-space: normal; }
                </style>
                
                <div class="pdf-page">
                    <div class="pdf-header">
                        <div class="header-left">
                            <div class="pdf-title"><i class="fas fa-industry"></i> ${appTitle}</div>
                            <div class="pdf-subtitle">${formatMonthYear(currentMonth)}</div>
                        </div>
                        <div class="operator-info-header">
                            <div class="operator-name-big">
                                <i class="fas fa-user-circle"></i>
                                ${operator?.name || 'N/A'}
                            </div>
                            <div class="operator-stats-header">
                                <span><i class="fas fa-clock"></i> ${getShiftName(operator?.shift || '1')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="content">
                        ${pageNum === 0 ? `
                        <div class="stats-mini-grid">
                            <div class="stat-mini-card">
                                <div class="stat-mini-icon"><i class="fas fa-cubes"></i></div>
                                <div class="stat-mini-label">Total Produzido</div>
                                <div class="stat-mini-value">${total.toLocaleString()}</div>
                            </div>
                            <div class="stat-mini-card">
                                <div class="stat-mini-icon"><i class="fas fa-chart-line"></i></div>
                                <div class="stat-mini-label">Média por Dia</div>
                                <div class="stat-mini-value">${avgPerDay.toLocaleString()}</div>
                            </div>
                            <div class="stat-mini-card">
                                <div class="stat-mini-icon"><i class="fas fa-pause-circle"></i></div>
                                <div class="stat-mini-label">Tempo Parado</div>
                                <div class="stat-mini-value">${downtime}h</div>
                            </div>
                            <div class="stat-mini-card">
                                <div class="stat-mini-icon"><i class="fas fa-calendar-check"></i></div>
                                <div class="stat-mini-label">Dias Trabalhados</div>
                                <div class="stat-mini-value">${uniqueOpDays}</div>
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="section-title-small">
                            <div class="section-title-left">
                                <i class="fas fa-table"></i>
                                Registro Detalhado de Produção
                            </div>
                            ${totalPages > 1 ? `<span class="page-indicator">Página ${pageNum + 1} de ${totalPages}</span>` : ''}
                        </div>
                        
                        <table class="prod-table">
                            <thead>
                                <tr>
                                    <th><i class="fas fa-calendar-day"></i> Data</th>
                                    <th><i class="fas fa-cog"></i> Máquina</th>
                                    <th style="text-align: center;"><i class="fas fa-cubes"></i> Produção</th>
                                    <th style="text-align: center;"><i class="fas fa-pause-circle"></i> Paradas</th>
                                    <th><i class="fas fa-comment-dots"></i> Observação</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pageProds.map(p => `
                                    <tr>
                                        <td class="date-col">${formatDate(p.date)}</td>
                                        <td class="machine-col">${machines[p.machineId]?.name || 'N/A'}</td>
                                        <td class="quantity-col">${(p.quantity || 0).toLocaleString()} un</td>
                                        <td class="downtime-col">${p.downtime || 0}h</td>
                                        <td class="obs-col">${p.observations || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            document.body.appendChild(detailContainer);

            try {
                await new Promise(resolve => setTimeout(resolve, 300));
                const canvas = await html2canvas(detailContainer, { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false, 
                    backgroundColor: '#ffffff',
                    width: 793,
                    windowWidth: 793
                });
                const imgData = canvas.toDataURL('image/png');
                const pdfWidth = 210;
                const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                
                // ✅ Verifica se a altura da imagem cabe em uma página A4 (297mm)
                const maxPdfHeight = 297;
                if (imgHeight > maxPdfHeight) {
                    // Se não cabe, ajusta para caber na página
                    const adjustedHeight = maxPdfHeight;
                    const adjustedWidth = (canvas.width * adjustedHeight) / canvas.height;
                    pdf.addImage(imgData, 'PNG', 0, 0, adjustedWidth, adjustedHeight);
                } else {
                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
                }
            } catch (error) {
                console.error('Erro ao gerar página do operador:', error);
                showToast('Erro ao gerar página detalhada do PDF', 'error');
            } finally {
                document.body.removeChild(detailContainer);
            }
        }
    }

    pdf.save(`relatorio_producao_${monthKey}.pdf`);
    showToast('PDF completo exportado com sucesso!');
}







function exportToExcel() {
    // ✅ FILTRO ADAPTADO PARA MÊS CUSTOMIZADO (26 a 25)
    const filtered = getFilteredProductions()
        .filter(p => isDateInCustomMonth(p.date, currentMonth))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filtered.length === 0) {
        showToast('Nenhum dado para exportar', 'error');
        return;
    }

    // Calcular estatísticas gerais
    const totalQuantity = filtered.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalDowntime = filtered.reduce((sum, p) => sum + (p.downtime || 0), 0);
    const uniqueDays = [...new Set(filtered.map(p => p.date))].length;
    const average = uniqueDays > 0 ? Math.round(totalQuantity / uniqueDays) : 0;

    // Criar workbook
    const wb = XLSX.utils.book_new();

    // ===== ESTILOS =====
    const styles = {
        header: {
            fill: { fgColor: { rgb: "1F2937" } },
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "medium", color: { rgb: "000000" } },
                bottom: { style: "medium", color: { rgb: "000000" } },
                left: { style: "medium", color: { rgb: "000000" } },
                right: { style: "medium", color: { rgb: "000000" } }
            }
        },
        subHeader: {
            fill: { fgColor: { rgb: "3B82F6" } },
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        },
        sectionTitle: {
            fill: { fgColor: { rgb: "10B981" } },
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
            alignment: { horizontal: "left", vertical: "center" },
            border: {
                top: { style: "medium", color: { rgb: "000000" } },
                bottom: { style: "medium", color: { rgb: "000000" } },
                left: { style: "medium", color: { rgb: "000000" } },
                right: { style: "medium", color: { rgb: "000000" } }
            }
        },
        labelCell: {
            fill: { fgColor: { rgb: "E5E7EB" } },
            font: { bold: true, sz: 10 },
            alignment: { horizontal: "left", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "9CA3AF" } },
                bottom: { style: "thin", color: { rgb: "9CA3AF" } },
                left: { style: "thin", color: { rgb: "9CA3AF" } },
                right: { style: "thin", color: { rgb: "9CA3AF" } }
            }
        },
        valueCell: {
            fill: { fgColor: { rgb: "FFFFFF" } },
            font: { sz: 10 },
            alignment: { horizontal: "right", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "D1D5DB" } },
                bottom: { style: "thin", color: { rgb: "D1D5DB" } },
                left: { style: "thin", color: { rgb: "D1D5DB" } },
                right: { style: "thin", color: { rgb: "D1D5DB" } }
            }
        },
        dataCell: {
            fill: { fgColor: { rgb: "F9FAFB" } },
            font: { sz: 10 },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "D1D5DB" } },
                bottom: { style: "thin", color: { rgb: "D1D5DB" } },
                left: { style: "thin", color: { rgb: "D1D5DB" } },
                right: { style: "thin", color: { rgb: "D1D5DB" } }
            }
        },
        highlightRow: {
            fill: { fgColor: { rgb: "FEF3C7" } },
            font: { bold: true, sz: 10 },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "F59E0B" } },
                bottom: { style: "thin", color: { rgb: "F59E0B" } },
                left: { style: "thin", color: { rgb: "F59E0B" } },
                right: { style: "thin", color: { rgb: "F59E0B" } }
            }
        }
    };

    // ===== ABA 1: RESUMO =====
    const summaryData = [
        ['📊 RELATÓRIO DE PRODUÇÃO'],
        [`Período: ${formatMonthYear(currentMonth)}`],
        [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
        [],
        ['📈 ESTATÍSTICAS GERAIS'],
        ['Métrica', 'Valor'],
        ['📦 Total Produzido', `${totalQuantity.toLocaleString()} unidades`],
        ['📊 Média Diária', `${average.toLocaleString()} unidades`],
        ['⏸️ Tempo Total Parado', `${totalDowntime} horas`],
        ['📅 Dias Produtivos', `${uniqueDays} dias`],
        [],
        ['🔧 PRODUÇÃO POR TURNO'],
        ['Turno', 'Produção', 'Tempo Parado', 'Registros']
    ];

    // Calcular por turno
    const statsByShift = { '1': { quantity: 0, downtime: 0, count: 0 }, '2': { quantity: 0, downtime: 0, count: 0 }, '3': { quantity: 0, downtime: 0, count: 0 } };
    filtered.forEach(p => {
        const operator = operators[p.operatorId];
        const shift = ['1', '2', '3'].includes(operator?.shift) ? operator.shift : '1';
        statsByShift[shift].quantity += p.quantity || 0;
        statsByShift[shift].downtime += p.downtime || 0;
        statsByShift[shift].count++;
    });

    ['1', '2', '3'].forEach(shift => {
        const shiftNames = { '1': 'Turno 1', '2': 'Turno 2', '3': 'Turno 3' };
        summaryData.push([
            shiftNames[shift],
            `${statsByShift[shift].quantity.toLocaleString()} un`,
            `${statsByShift[shift].downtime}h`,
            statsByShift[shift].count
        ]);
    });

    // Top 5 Operadores
    const operatorStats = {};
    filtered.forEach(p => {
        const operator = operators[p.operatorId];
        if (!operatorStats[p.operatorId]) {
            operatorStats[p.operatorId] = {
                name: operator?.name || 'N/A',
                quantity: 0,
                downtime: 0
            };
        }
        operatorStats[p.operatorId].quantity += p.quantity || 0;
        operatorStats[p.operatorId].downtime += p.downtime || 0;
    });

    const topOperators = Object.values(operatorStats).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    summaryData.push([]);
    summaryData.push(['🏆 TOP 5 OPERADORES']);
    summaryData.push(['Posição', 'Operador', 'Produção', 'Tempo Parado']);

    topOperators.forEach((op, i) => {
        summaryData.push([
            `${i + 1}º`,
            op.name,
            `${op.quantity.toLocaleString()} un`,
            `${op.downtime}h`
        ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

    // Aplicar estilos no resumo
    wsSummary['A1'].s = styles.header;
    wsSummary['A5'].s = styles.sectionTitle;
    wsSummary['A12'].s = styles.sectionTitle;
    wsSummary['A' + (summaryData.length - topOperators.length - 1)].s = styles.sectionTitle;

    // Header das tabelas
    ['A6', 'B6'].forEach(cell => { if (wsSummary[cell]) wsSummary[cell].s = styles.subHeader; });
    ['A13', 'B13', 'C13', 'D13'].forEach(cell => { if (wsSummary[cell]) wsSummary[cell].s = styles.subHeader; });
    
    const topHeaderRow = summaryData.length - topOperators.length;
    ['A' + topHeaderRow, 'B' + topHeaderRow, 'C' + topHeaderRow, 'D' + topHeaderRow].forEach(cell => { 
        if (wsSummary[cell]) wsSummary[cell].s = styles.subHeader; 
    });

    // Células de dados
    for (let i = 7; i <= 10; i++) {
        if (wsSummary['A' + i]) wsSummary['A' + i].s = styles.labelCell;
        if (wsSummary['B' + i]) wsSummary['B' + i].s = styles.valueCell;
    }

    for (let i = 14; i <= 16; i++) {
        ['A', 'B', 'C', 'D'].forEach(col => {
            if (wsSummary[col + i]) wsSummary[col + i].s = styles.dataCell;
        });
    }

    wsSummary['!cols'] = [
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 }
    ];

    wsSummary['!rows'] = [
        { hpx: 25 },
        { hpx: 20 },
        { hpx: 20 },
        { hpx: 10 },
        { hpx: 22 }
    ];

    XLSX.utils.book_append_sheet(wb, wsSummary, '📊 Resumo');

    // ===== ABA 2: DADOS DETALHADOS =====
    const detailedData = filtered.map(p => {
        const machine = machines[p.machineId];
        const operator = operators[p.operatorId];
        const shiftNames = { '1': 'Turno 1', '2': 'Turno 2', '3': 'Turno 3' };

        return {
            '📅 Data': formatDate(p.date),
            '🏭 Máquina': machine?.name || '-',
            '⏰ Turno': shiftNames[operator?.shift] || 'Turno 1',
            '👤 Operador': operator?.name || '-',
            '📦 Quantidade': p.quantity || 0,
            '⏸️ Paradas (h)': p.downtime || 0,
            '📝 Observações': p.observations || ''
        };
    });

    const wsDetails = XLSX.utils.json_to_sheet(detailedData);

    // Estilizar cabeçalho
    const detailsHeader = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'];
    detailsHeader.forEach(cell => {
        if (wsDetails[cell]) wsDetails[cell].s = styles.subHeader;
    });

    // Estilizar células de dados (linhas alternadas)
    const detailsRange = XLSX.utils.decode_range(wsDetails['!ref']);
    for (let row = 2; row <= detailsRange.e.r + 1; row++) {
        const isEven = row % 2 === 0;
        ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
            const cell = col + row;
            if (wsDetails[cell]) {
                wsDetails[cell].s = isEven ? styles.dataCell : {
                    ...styles.dataCell,
                    fill: { fgColor: { rgb: "FFFFFF" } }
                };
            }
        });
    }

    wsDetails['!cols'] = [
        { wch: 12 },
        { wch: 18 },
        { wch: 12 },
        { wch: 25 },
        { wch: 12 },
        { wch: 12 },
        { wch: 40 }
    ];

    XLSX.utils.book_append_sheet(wb, wsDetails, '📋 Detalhado');

    // ===== ABA 3: PRODUÇÃO POR OPERADOR =====
    const byOperatorData = [];
    const operatorGroups = {};
    const shiftNames = { '1': 'Turno 1', '2': 'Turno 2', '3': 'Turno 3' };

    filtered.forEach(p => {
        if (!operatorGroups[p.operatorId]) {
            const operator = operators[p.operatorId];
            operatorGroups[p.operatorId] = {
                name: operator?.name || 'N/A',
                shift: shiftNames[operator?.shift] || 'Turno 1',
                productions: []
            };
        }
        operatorGroups[p.operatorId].productions.push(p);
    });

    Object.values(operatorGroups).forEach(group => {
        const total = group.productions.reduce((sum, p) => sum + (p.quantity || 0), 0);
        const downtime = group.productions.reduce((sum, p) => sum + (p.downtime || 0), 0);

        byOperatorData.push([
            `👤 ${group.name}`,
            `⏰ ${group.shift}`,
            `📦 ${total.toLocaleString()} un`,
            `⏸️ ${downtime}h`,
            `📅 ${group.productions.length} registros`
        ]);

        byOperatorData.push(['Data', 'Máquina', 'Produção', 'Paradas', 'Observações']);

        group.productions.forEach(p => {
            byOperatorData.push([
                formatDate(p.date),
                machines[p.machineId]?.name || '-',
                `${p.quantity || 0} un`,
                `${p.downtime || 0}h`,
                p.observations || '-'
            ]);
        });

        byOperatorData.push([]);
    });

    const wsOperators = XLSX.utils.aoa_to_sheet(byOperatorData);

    // Estilizar por operador
    let opRow = 1;
    Object.values(operatorGroups).forEach(group => {
        // Header do operador
        ['A', 'B', 'C', 'D', 'E'].forEach(col => {
            if (wsOperators[col + opRow]) wsOperators[col + opRow].s = styles.highlightRow;
        });
        opRow++;

        // Subheader da tabela
        ['A', 'B', 'C', 'D', 'E'].forEach(col => {
            if (wsOperators[col + opRow]) wsOperators[col + opRow].s = styles.subHeader;
        });
        opRow++;

        // Dados
        for (let i = 0; i < group.productions.length; i++) {
            ['A', 'B', 'C', 'D', 'E'].forEach(col => {
                if (wsOperators[col + opRow]) wsOperators[col + opRow].s = styles.dataCell;
            });
            opRow++;
        }
        opRow++; // Linha vazia
    });

    wsOperators['!cols'] = [
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 12 },
        { wch: 35 }
    ];

    XLSX.utils.book_append_sheet(wb, wsOperators, '👥 Por Operador');

    // ===== ABA 4: PRODUÇÃO POR MÁQUINA =====
    const byMachineData = [];
    const machineGroups = {};

    filtered.forEach(p => {
        if (!machineGroups[p.machineId]) {
            machineGroups[p.machineId] = {
                name: machines[p.machineId]?.name || 'N/A',
                productions: []
            };
        }
        machineGroups[p.machineId].productions.push(p);
    });

    Object.values(machineGroups).forEach(group => {
        const total = group.productions.reduce((sum, p) => sum + (p.quantity || 0), 0);
        const downtime = group.productions.reduce((sum, p) => sum + (p.downtime || 0), 0);

        byMachineData.push([
            `🏭 ${group.name}`,
            `📦 ${total.toLocaleString()} un`,
            `⏸️ ${downtime}h`,
            `📅 ${group.productions.length} registros`
        ]);

        byMachineData.push(['Data', 'Operador', 'Turno', 'Produção', 'Paradas']);

        group.productions.forEach(p => {
            const operator = operators[p.operatorId];
            byMachineData.push([
                formatDate(p.date),
                operator?.name || '-',
                shiftNames[operator?.shift] || 'Turno 1',
                `${p.quantity || 0} un`,
                `${p.downtime || 0}h`
            ]);
        });

        byMachineData.push([]);
    });

    const wsMachines = XLSX.utils.aoa_to_sheet(byMachineData);

    // Estilizar por máquina
    let machRow = 1;
    Object.values(machineGroups).forEach(group => {
        // Header da máquina
        ['A', 'B', 'C', 'D'].forEach(col => {
            if (wsMachines[col + machRow]) wsMachines[col + machRow].s = styles.highlightRow;
        });
        machRow++;

        // Subheader da tabela
        ['A', 'B', 'C', 'D', 'E'].forEach(col => {
            if (wsMachines[col + machRow]) wsMachines[col + machRow].s = styles.subHeader;
        });
        machRow++;

        // Dados
        for (let i = 0; i < group.productions.length; i++) {
            ['A', 'B', 'C', 'D', 'E'].forEach(col => {
                if (wsMachines[col + machRow]) wsMachines[col + machRow].s = styles.dataCell;
            });
            machRow++;
        }
        machRow++; // Linha vazia
    });

    wsMachines['!cols'] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, wsMachines, '🏭 Por Máquina');

    // Salvar arquivo
    const monthKey = getMonthKey(currentMonth);
    XLSX.writeFile(wb, `relatorio_producao_${monthKey}.xlsx`);

    showToast('Excel exportado com sucesso!');
}




async function updateClosingView() {
    // ✅ Validação de permissão
    if (!currentUser || !['admin', 'leader'].includes(currentUser.role)) return;

    // ✅ Validação de elementos DOM
    const closingMonthEl = document.getElementById('closing-month');
    const statusDiv = document.getElementById('closing-status');
    const historyBody = document.getElementById('closing-history-body');

    if (!closingMonthEl || !statusDiv || !historyBody) {
        console.error('Elementos DOM não encontrados');
        return;
    }

    // ✅ Validação da chave do mês
    const monthKey = getMonthKey(new Date());
    if (!monthKey) {
        statusDiv.innerHTML = `
            <div class="flex items-center gap-2 text-red-600">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Erro ao obter mês atual</span>
            </div>`;
        return;
    }

    closingMonthEl.value = monthKey;

    try {
        // ✅ Busca dados atualizados do Firebase
        const snapshot = await database.ref(`closings/${monthKey}`).once('value');
        const data = snapshot.val();

        if (!data) {
            statusDiv.innerHTML = `
                <div class="flex items-center gap-2 text-yellow-600">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Este mês ainda não foi fechado</span>
                </div>`;
        } else if (data.reopened) {
            statusDiv.innerHTML = `
                <div class="flex items-center gap-2 text-red-600">
                    <i class="fas fa-unlock"></i>
                    <span>Mês reaberto por <strong>${data.reopenedBy || 'Desconhecido'}</strong></span>
                </div>`;
        } else if (data.closed) {
            statusDiv.innerHTML = `
                <div class="flex items-center gap-2 text-green-600">
                    <i class="fas fa-lock"></i>
                    <span>Mês fechado por <strong>${data.closedBy || 'Desconhecido'}</strong></span>
                </div>`;
        }

        // ✅ Atualiza botões com base no status atual
        await updateMonthButtons(monthKey);

    } catch (error) {
        console.error('Erro ao buscar fechamento:', error);
        statusDiv.innerHTML = `
            <div class="flex items-center gap-2 text-red-600">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Erro ao carregar status</span>
            </div>`;
    }

    // ✅ Busca histórico atualizado do Firebase
    try {
        const historySnapshot = await database.ref('closings').once('value');
        const closingsData = historySnapshot.val() || {};

        const closingsArray = Object.entries(closingsData)
            .filter(([month, c]) => c && c.closedAt)
            .sort(([, a], [, b]) => {
                const dateA = new Date(a.closedAt);
                const dateB = new Date(b.closedAt);
                if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
                return dateB.getTime() - dateA.getTime();
            });

        if (closingsArray.length === 0) {
            historyBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8 text-gray-500">
                        Nenhum fechamento registrado
                    </td>
                </tr>`;
            return;
        }

        const historyHtml = closingsArray.map(([month, c]) => `
            <tr class="hover:bg-gray-50">
                <td class="px-2 py-3 whitespace-nowrap">${month}</td>
                <td class="px-2 py-3 whitespace-nowrap text-sm">${new Date(c.closedAt).toLocaleString('pt-BR')}</td>
                <td class="px-2 py-3 whitespace-nowrap">${c.closedBy || 'Desconhecido'}</td>
                <td class="px-2 py-3">
                    <div class="flex items-center gap-2 flex-nowrap">
                        <button onclick="downloadClosingReport('${month}')"
                            class="text-cyan-600 hover:text-cyan-800 whitespace-nowrap">
                            <i class="fas fa-download"></i><span class="ml-1 hidden sm:inline">PDF</span>
                        </button>
                        ${c.reopened
                            ? '<span class="text-xs text-red-600 whitespace-nowrap"><i class="fas fa-unlock"></i><span class="hidden sm:inline ml-1">Reaberto</span></span>'
                            : '<span class="text-xs text-green-600 whitespace-nowrap"><i class="fas fa-lock"></i><span class="hidden sm:inline ml-1">Fechado</span></span>'
                        }
                    </div>
                </td>
            </tr>
        `).join('');

        historyBody.innerHTML = historyHtml;
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        historyBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-8 text-red-500">
                    Erro ao carregar histórico
                </td>
            </tr>`;
    }
}




async function closeMonth() {
    const monthKeyEl = document.getElementById('closing-month');
    if (!monthKeyEl) return;
    
    const monthKey = monthKeyEl.value;
    if (!monthKey) {
        showToast('Selecione um mês', 'warning');
        return;
    }

    // ✅ Validação de usuário
    if (!currentUser || !currentUser.name) {
        showToast('Usuário não identificado', 'error');
        return;
    }

    try {
        const ref = database.ref(`closings/${monthKey}`);
        
        // ✅ Busca dados atualizados antes de fechar
        const snapshot = await ref.once('value');
        const data = snapshot.val();

        // ✅ Verifica se já está fechado
        if (data?.closed && !data?.reopened) {
            showToast('Este mês já está fechado', 'warning');
            await updateClosingView();
            return;
        }

        // ✅ Fecha o mês
        await ref.set({
            month: monthKey,
            closed: true,
            reopened: false,
            closedAt: new Date().toISOString(),
            closedBy: currentUser.name
        });

        showToast('Mês fechado com sucesso!', 'success');
        
        // ✅ Atualiza a view completamente
        await updateClosingView();
        
    } catch (error) {
        console.error('Erro ao fechar mês:', error);
        showToast('Erro ao fechar mês', 'error');
    }
}

async function openMonth() {
    const monthKeyEl = document.getElementById('closing-month');
    if (!monthKeyEl) return;
    
    const monthKey = monthKeyEl.value;
    if (!monthKey) {
        showToast('Selecione um mês', 'warning');
        return;
    }

    // ✅ Validação de usuário
    if (!currentUser || !currentUser.name) {
        showToast('Usuário não identificado', 'error');
        return;
    }

    try {
        const ref = database.ref(`closings/${monthKey}`);
        
        // ✅ Busca dados antes de abrir
        const snapshot = await ref.once('value');
        const data = snapshot.val();

        // ✅ Verifica se existe e está fechado
        if (!data || !data.closed) {
            showToast('Este mês não está fechado', 'warning');
            await updateClosingView();
            return;
        }

        // ✅ Verifica se já está reaberto
        if (data.reopened) {
            showToast('Este mês já está aberto', 'warning');
            await updateClosingView();
            return;
        }

        // ✅ Reabre o mês
        await ref.update({
            reopened: true,
            reopenedAt: new Date().toISOString(),
            reopenedBy: currentUser.name
        });

        showToast('Mês reaberto!', 'success');
        
        // ✅ Atualiza a view completamente
        await updateClosingView();
        
    } catch (error) {
        console.error('Erro ao reabrir mês:', error);
        showToast('Erro ao reabrir mês', 'error');
    }
}


async function isMonthClosed(monthKey) {
    if (!monthKey) return false;

    try {
        // ✅ Busca dados atualizados do Firebase
        const snapshot = await database.ref(`closings/${monthKey}`).once('value');
        const data = snapshot.val();

        if (!data) return false;
        if (data.reopened) return false;

        return data.closed === true;
    } catch (error) {
        console.error('Erro ao verificar fechamento:', error);
        return false;
    }
}

async function updateMonthButtons(monthKey) {
    if (!monthKey) return;

    const closeBtn = document.getElementById('close-month-btn');
    const openBtn = document.getElementById('open-month-btn');

    if (!closeBtn || !openBtn) return;

    try {
        // ✅ Busca status atualizado do Firebase
        const closed = await isMonthClosed(monthKey);

        if (closed) {
            closeBtn.classList.add('hidden');
            openBtn.classList.remove('hidden');
        } else {
            closeBtn.classList.remove('hidden');
            openBtn.classList.add('hidden');
        }
    } catch (error) {
        console.error('Erro ao atualizar botões:', error);
    }
}
document.getElementById('closing-month').addEventListener('change', e => {
    updateMonthButtons(e.target.value);
});

document.getElementById('close-month-btn').addEventListener('click', closeMonth);
document.getElementById('open-month-btn').addEventListener('click', openMonth);

async function downloadClosingReport(monthKey) {
    const { jsPDF } = window.jspdf;
  
    // ✅ ADAPTADO: Filtro usando isDateInCustomMonth com currentMonth
    let filtered = getFilteredProductions()
        .filter(p => isDateInCustomMonth(p.date, currentMonth));
    
    // ✅ ORDENAR: MÁQUINA → DATA (consistente com exportToPDF)
    filtered.sort((a, b) => {
        const machineA = machines[a.machineId];
        const machineB = machines[b.machineId];
        
        if (!machineA || !machineB || !machineA.name || !machineB.name) return 0;
        
        const ma = parseInt(machineA.name.replace(/\D/g, '')) || 0;
        const mb = parseInt(machineB.name.replace(/\D/g, '')) || 0;
        
        if (ma !== mb) return ma - mb;
        
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
    });

    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = 'position:absolute;left:-9999px;top:0;background:white;font-family:Inter,sans-serif;';

    const totalQuantity = filtered.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalDowntime = filtered.reduce((sum, p) => sum + (p.downtime || 0), 0);
    const uniqueDays = [...new Set(filtered.map(p => p.date))].length;
    const avgPerDay = uniqueDays > 0 ? Math.round(totalQuantity / uniqueDays) : 0;

    // ✅ ADAPTADO: Usar formatMonthYear que já considera 26-25
    const periodText = formatMonthYear(currentMonth);

    // Estatísticas por turno
    const statsByShift = { '1': { quantity: 0, downtime: 0, count: 0 }, '2': { quantity: 0, downtime: 0, count: 0 }, '3': { quantity: 0, downtime: 0, count: 0 } };
    filtered.forEach(p => {
        const operator = operators[p.operatorId];
        const shift = ['1', '2', '3'].includes(operator?.shift) ? operator.shift : '1';
        statsByShift[shift].quantity += p.quantity || 0;
        statsByShift[shift].downtime += p.downtime || 0;
        statsByShift[shift].count++;
    });

    // Estatísticas por máquina
    const statsByMachine = {};
    filtered.forEach(p => {
        if (!statsByMachine[p.machineId]) {
            statsByMachine[p.machineId] = { name: machines[p.machineId]?.name || 'N/A', quantity: 0, downtime: 0, count: 0 };
        }
        statsByMachine[p.machineId].quantity += p.quantity || 0;
        statsByMachine[p.machineId].downtime += p.downtime || 0;
        statsByMachine[p.machineId].count++;
    });

    // Estatísticas completas por operador
    const operatorStats = {};
    filtered.forEach(p => {
        const operator = operators[p.operatorId];
        if (!operatorStats[p.operatorId]) {
            operatorStats[p.operatorId] = {
                name: operator?.name || 'N/A',
                shift: operator?.shift || '1',
                quantity: 0,
                downtime: 0,
                count: 0,
                days: new Set()
            };
        }
        operatorStats[p.operatorId].quantity += p.quantity || 0;
        operatorStats[p.operatorId].downtime += p.downtime || 0;
        operatorStats[p.operatorId].count++;
        operatorStats[p.operatorId].days.add(p.date);
    });

    // Converter Set para tamanho
    Object.values(operatorStats).forEach(op => {
        op.daysWorked = op.days.size;
        op.avgPerDay = op.daysWorked > 0 ? Math.round(op.quantity / op.daysWorked) : 0;
        delete op.days;
    });

    const topOperators = Object.values(operatorStats).sort((a, b) => b.quantity - a.quantity);
    const allOperators = topOperators.slice(0, 10); // Top 10

    // Melhor e pior dia
    const dailyProduction = {};
    filtered.forEach(p => {
        if (!dailyProduction[p.date]) {
            dailyProduction[p.date] = 0;
        }
        dailyProduction[p.date] += p.quantity || 0;
    });

    const sortedDays = Object.entries(dailyProduction).sort((a, b) => b[1] - a[1]);
    const bestDay = sortedDays[0] || ['N/A', 0];
    const worstDay = sortedDays[sortedDays.length - 1] || ['N/A', 0];

    // Melhor turno
    const bestShift = Object.entries(statsByShift).sort((a, b) => b[1].quantity - a[1].quantity)[0];
    const bestShiftName = getShiftName(bestShift[0]);

    // Melhor máquina
    const bestMachine = Object.values(statsByMachine).sort((a, b) => b.quantity - a.quantity)[0];

    // Eficiência (considerando 8h por registro, tempo produtivo = tempo total - paradas)
    const totalHoursAvailable = filtered.length * 8;
    const productiveHours = totalHoursAvailable - totalDowntime;
    const efficiency = totalHoursAvailable > 0 ? ((productiveHours / totalHoursAvailable) * 100).toFixed(1) : 0;

    // Taxa de produção por hora
    const productionRate = productiveHours > 0 ? Math.round(totalQuantity / productiveHours) : 0;

    // Contagem de observações
    const recordsWithObs = filtered.filter(p => p.observations && p.observations.trim() !== '').length;
    const obsPercentage = filtered.length > 0 ? ((recordsWithObs / filtered.length) * 100).toFixed(1) : 0;

    pdfContainer.innerHTML = `
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          .pdf-page { 
            width: 793px; 
            background: white;
            margin-bottom: 20px;
          }
          
          .pdf-header {
            background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
            color: white;
            padding: 30px 40px;
            width: 100%;
          }
          .pdf-title {
            font-size: 36px;
            font-weight: 900;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .pdf-month {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 8px;
            opacity: 0.95;
          }
          .pdf-subtitle {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 3px;
          }
          .pdf-date {
            font-size: 11px;
            opacity: 0.8;
            margin-top: 8px;
          }
          
          .page-number {
            position: absolute;
            bottom: 20px;
            right: 40px;
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
          }
          
          .content {
            padding: 25px 40px;
            position: relative;
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          
          .stat-card {
            background: #f8fafc;
            border: 2px solid #cbd5e1;
            border-radius: 10px;
            padding: 14px;
            text-align: center;
          }
          
          .stat-icon {
            width: 45px;
            height: 45px;
            background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
            color: white;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 10px;
            font-size: 20px;
          }
          
          .stat-label {
            color: #64748b;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }
          
          .stat-value {
            color: #0f172a;
            font-size: 22px;
            font-weight: 800;
          }
          
          .stat-unit {
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
          }
          
          .section-title {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin: 20px 0 12px;
            padding-bottom: 6px;
            border-bottom: 2.5px solid #0891b2;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .section-title i {
            color: #0891b2;
            font-size: 16px;
          }
          
          .highlights-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          
          .highlight-card {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 2px solid #0891b2;
            border-radius: 10px;
            padding: 12px;
          }
          
          .highlight-label {
            color: #0891b2;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          
          .highlight-value {
            color: #0f172a;
            font-size: 18px;
            font-weight: 800;
          }
          
          .highlight-detail {
            color: #64748b;
            font-size: 10px;
            margin-top: 4px;
            font-weight: 600;
          }
          
          .shift-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          
          .shift-card {
            background: #f8fafc;
            border: 2px solid #cbd5e1;
            border-radius: 10px;
            overflow: hidden;
          }
          
          .shift-header {
            padding: 10px;
            color: white;
            font-weight: 700;
            text-align: center;
            font-size: 12px;
            background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
          }
          
          .shift-body {
            padding: 10px;
          }
          
          .shift-stat {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .shift-stat:last-child {
            border-bottom: none;
          }
          
          .shift-stat-label {
            color: #64748b;
            font-weight: 600;
          }
          
          .shift-stat-value {
            color: #0f172a;
            font-weight: 800;
          }
          
          .machine-list {
            background: #f8fafc;
            border: 2px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 20px;
          }
          
          .machine-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            background: white;
            border-radius: 8px;
            margin-bottom: 6px;
            border: 1px solid #e2e8f0;
          }
          
          .machine-item:last-child {
            margin-bottom: 0;
          }
          
          .machine-name {
            font-weight: 700;
            color: #0f172a;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          
          .machine-stats {
            display: flex;
            gap: 15px;
            font-size: 10px;
          }
          
          .machine-stat-item {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          
          .machine-stat-label {
            color: #64748b;
            font-weight: 600;
          }
          
          .machine-stat-value {
            color: #0891b2;
            font-weight: 800;
          }
          
          .operators-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border: 2px solid #cbd5e1;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 20px;
          }
          
          .operators-table thead {
            background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
            color: white;
          }
          
          .operators-table th {
            padding: 8px;
            text-align: left;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            color: white;
          }
          
          .operators-table tbody tr {
            border-bottom: 1px solid #e2e8f0;
          }
          
          .operators-table tbody tr:nth-child(even) {
            background: #f8fafc;
          }
          
          .operators-table tbody tr:nth-child(1) {
            background: #fef3c7;
          }
          
          .operators-table tbody tr:nth-child(2) {
            background: #e5e7eb;
          }
          
          .operators-table tbody tr:nth-child(3) {
            background: #fecaca;
          }
          
          .operators-table td {
            padding: 7px 8px;
            font-size: 10px;
            color: #1e293b;
          }
          
          .rank-col {
            font-weight: 800;
            color: #0891b2;
            text-align: center;
            width: 40px;
          }
          
          .name-col {
            font-weight: 700;
          }
          
          .shift-col {
            text-align: center;
            font-weight: 600;
            font-size: 9px;
          }
          
          .number-col {
            text-align: center;
            font-weight: 800;
            color: #0891b2;
          }
          
          .performance-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          
          .performance-card {
            background: #f8fafc;
            border: 2px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
            text-align: center;
          }
          
          .performance-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 8px;
            font-size: 18px;
          }
          
          .performance-label {
            color: #64748b;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          
          .performance-value {
            color: #0f172a;
            font-size: 20px;
            font-weight: 800;
          }
          
          .footer-info {
            background: #f8fafc;
            border: 2px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
            margin-top: 20px;
            font-size: 9px;
            color: #64748b;
            text-align: center;
          }
          
          .footer-info strong {
            color: #0891b2;
          }
        </style>
        
        <!-- PÁGINA 1 -->
        <div class="pdf-page">
          <div class="pdf-header">
            <div class="pdf-title">
              <i class="fas fa-file-invoice"></i>
              RELATÓRIO DE FECHAMENTO
            </div>
            <div class="pdf-month">${periodText}</div>
            <div class="pdf-subtitle">${window.elementSdk ? (window.elementSdk.config.app_title || defaultConfig.app_title) : defaultConfig.app_title}</div>
            <div class="pdf-date"><i class="far fa-calendar-alt"></i> Documento gerado em: ${new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })}</div>
          </div>
          
          <div class="content">
            <!-- ESTATÍSTICAS PRINCIPAIS -->
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-cubes"></i></div>
                <div class="stat-label">Total Produzido</div>
                <div class="stat-value">${totalQuantity.toLocaleString()}</div>
                <div class="stat-unit">unidades</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                <div class="stat-label">Média Diária</div>
                <div class="stat-value">${avgPerDay.toLocaleString()}</div>
                <div class="stat-unit">un/dia</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-clock"></i></div>
                <div class="stat-label">Tempo Produtivo</div>
                <div class="stat-value">${productiveHours}</div>
                <div class="stat-unit">horas</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
                <div class="stat-label">Dias Produtivos</div>
                <div class="stat-value">${uniqueDays}</div>
                <div class="stat-unit">dias</div>
              </div>
            </div>
            
            <!-- DESTAQUES DO MÊS -->
            <div class="section-title">
              <i class="fas fa-star"></i>
              Destaques do Período
            </div>
            
            <div class="highlights-grid">
              <div class="highlight-card">
                <div class="highlight-label"><i class="fas fa-trophy"></i> Melhor Dia</div>
                <div class="highlight-value">${formatDate(bestDay[0])}</div>
                <div class="highlight-detail">${bestDay[1].toLocaleString()} unidades produzidas</div>
              </div>
              
              <div class="highlight-card">
                <div class="highlight-label"><i class="fas fa-calendar-times"></i> Menor Produção</div>
                <div class="highlight-value">${formatDate(worstDay[0])}</div>
                <div class="highlight-detail">${worstDay[1].toLocaleString()} unidades produzidas</div>
              </div>
              
              <div class="highlight-card">
                <div class="highlight-label"><i class="fas fa-user-clock"></i> Melhor Turno</div>
                <div class="highlight-value">${bestShiftName}</div>
                <div class="highlight-detail">${bestShift[1].quantity.toLocaleString()} unidades no período</div>
              </div>
              
              <div class="highlight-card">
                <div class="highlight-label"><i class="fas fa-cog"></i> Melhor Máquina</div>
                <div class="highlight-value">${bestMachine?.name || 'N/A'}</div>
                <div class="highlight-detail">${(bestMachine?.quantity || 0).toLocaleString()} unidades produzidas</div>
              </div>
            </div>
            
            <!-- INDICADORES DE PERFORMANCE -->
            <div class="section-title">
              <i class="fas fa-tachometer-alt"></i>
              Indicadores de Performance (KPIs)
            </div>
            
            <div class="performance-grid">
              <div class="performance-card">
                <div class="performance-icon"><i class="fas fa-percentage"></i></div>
                <div class="performance-label">Eficiência</div>
                <div class="performance-value">${efficiency}%</div>
              </div>
              
              <div class="performance-card">
                <div class="performance-icon"><i class="fas fa-gauge-high"></i></div>
                <div class="performance-label">Taxa/Hora</div>
                <div class="performance-value">${productionRate}</div>
              </div>
              
              <div class="performance-card">
                <div class="performance-icon"><i class="fas fa-pause-circle"></i></div>
                <div class="performance-label">Total Parado</div>
                <div class="performance-value">${totalDowntime}h</div>
              </div>
            </div>
            
            <!-- PRODUÇÃO POR TURNO -->
            <div class="section-title">
              <i class="fas fa-clock"></i>
              Análise Detalhada por Turno
            </div>
            
            <div class="shift-grid">
              ${['1', '2', '3'].map(shift => {
        const shiftData = statsByShift[shift];
        const shiftAvg = shiftData.count > 0 ? Math.round(shiftData.quantity / shiftData.count) : 0;
        return `
                <div class="shift-card">
                  <div class="shift-header">
                    ${getShiftName(shift)}
                  </div>
                  <div class="shift-body">
                    <div class="shift-stat">
                      <span class="shift-stat-label">Produção Total:</span>
                      <span class="shift-stat-value">${shiftData.quantity.toLocaleString()} un</span>
                    </div>
                    <div class="shift-stat">
                      <span class="shift-stat-label">Média/Registro:</span>
                      <span class="shift-stat-value">${shiftAvg.toLocaleString()} un</span>
                    </div>
                    <div class="shift-stat">
                      <span class="shift-stat-label">Tempo Parado:</span>
                      <span class="shift-stat-value">${shiftData.downtime}h</span>
                    </div>
                    <div class="shift-stat">
                      <span class="shift-stat-label">Nº Registros:</span>
                      <span class="shift-stat-value">${shiftData.count}</span>
                    </div>
                  </div>
                </div>
              `}).join('')}
            </div>
            
            <div class="page-number">Página 1 de 2</div>
          </div>
        </div>
        
        <!-- PÁGINA 2 -->
        <div class="pdf-page">
          <div class="pdf-header">
            <div class="pdf-title">
              <i class="fas fa-file-invoice"></i>
              RELATÓRIO DE FECHAMENTO
            </div>
            <div class="pdf-month">${periodText} - Continuação</div>
          </div>
          
          <div class="content">
            <!-- PRODUÇÃO POR MÁQUINA -->
            <div class="section-title">
              <i class="fas fa-cogs"></i>
              Desempenho Detalhado por Máquina
            </div>
            
            <div class="machine-list">
              ${Object.values(statsByMachine).sort((a, b) => {
                // Ordenar máquinas numericamente
                const ma = parseInt(a.name.replace(/\D/g, '')) || 0;
                const mb = parseInt(b.name.replace(/\D/g, '')) || 0;
                return ma - mb;
              }).map(machine => {
            const machineAvg = machine.count > 0 ? Math.round(machine.quantity / machine.count) : 0;
            return `
                <div class="machine-item">
                  <div class="machine-name"><i class="fas fa-cog"></i> ${machine.name}</div>
                  <div class="machine-stats">
                    <div class="machine-stat-item">
                      <span class="machine-stat-label">Total:</span>
                      <span class="machine-stat-value">${machine.quantity.toLocaleString()} un</span>
                    </div>
                    <div class="machine-stat-item">
                      <span class="machine-stat-label">Média:</span>
                      <span class="machine-stat-value">${machineAvg.toLocaleString()} un</span>
                    </div>
                    <div class="machine-stat-item">
                      <span class="machine-stat-label">Paradas:</span>
                      <span class="machine-stat-value">${machine.downtime}h</span>
                    </div>
                    <div class="machine-stat-item">
                      <span class="machine-stat-label">Usos:</span>
                      <span class="machine-stat-value">${machine.count}x</span>
                    </div>
                  </div>
                </div>
              `}).join('')}
            </div>
            
            <!-- RANKING DE OPERADORES -->
            <div class="section-title">
              <i class="fas fa-ranking-star"></i>
              Ranking Completo de Operadores
            </div>
            
            <table class="operators-table">
              <thead>
                <tr>
                  <th class="rank-col">#</th>
                  <th>Operador</th>
                  <th class="shift-col">Turno</th>
                  <th class="number-col">Produção</th>
                  <th class="number-col">Média/Dia</th>
                  <th class="number-col">Dias</th>
                  <th class="number-col">Paradas</th>
                  <th class="number-col">Registros</th>
                </tr>
              </thead>
              <tbody>
                ${allOperators.map((op, i) => `
                  <tr>
                    <td class="rank-col">${i + 1}º</td>
                    <td class="name-col">${op.name}</td>
                    <td class="shift-col">${getShiftName(op.shift)}</td>
                    <td class="number-col">${op.quantity.toLocaleString()}</td>
                    <td class="number-col">${op.avgPerDay.toLocaleString()}</td>
                    <td class="number-col">${op.daysWorked}</td>
                    <td class="number-col">${op.downtime}h</td>
                    <td class="number-col">${op.count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <!-- ANÁLISE DE PARADAS -->
            <div class="section-title">
              <i class="fas fa-pause-circle"></i>
              Análise de Tempo de Parada
            </div>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-stopwatch"></i></div>
                <div class="stat-label">Paradas Totais</div>
                <div class="stat-value">${totalDowntime}</div>
                <div class="stat-unit">horas</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-percentage"></i></div>
                <div class="stat-label">% do Tempo</div>
                <div class="stat-value">${totalHoursAvailable > 0 ? ((totalDowntime / totalHoursAvailable) * 100).toFixed(1) : 0}%</div>
                <div class="stat-unit">parado</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-chart-pie"></i></div>
                <div class="stat-label">Média por Registro</div>
                <div class="stat-value">${filtered.length > 0 ? (totalDowntime / filtered.length).toFixed(1) : 0}</div>
                <div class="stat-unit">h/registro</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-tools"></i></div>
                <div class="stat-label">Registros c/ Paradas</div>
                <div class="stat-value">${filtered.filter(p => p.downtime > 0).length}</div>
                <div class="stat-unit">registros</div>
              </div>
            </div>
            
            <div class="page-number">Página 2 de 2</div>
          </div>
        </div>
      `;

    document.body.appendChild(pdfContainer);

    try {
        await new Promise(resolve => setTimeout(resolve, 800));

        // Capturar cada página separadamente
        const pages = pdfContainer.querySelectorAll('.pdf-page');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = 210;

        for (let i = 0; i < pages.length; i++) {
            const canvas = await html2canvas(pages[i], {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 793,
                windowWidth: 793
            });

            const imgData = canvas.toDataURL('image/png');
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            if (i > 0) {
                pdf.addPage();
            }

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
        }

        const monthKey = getMonthKey(currentMonth);
        pdf.save(`fechamento_${monthKey}.pdf`);
        showToast('Relatório completo exportado em 2 páginas!');
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        showToast('Erro ao gerar PDF', 'error');
    } finally {
        document.body.removeChild(pdfContainer);
    }
}




// Global functions
window.showProductionModal = showProductionModal;
window.deleteProduction = deleteProduction;
window.showMyOperatorModal = showMyOperatorModal;
window.deleteMyOperator = deleteMyOperator;
window.showUserModal = showUserModal;
window.showOperatorModal = showOperatorModal;
window.showMachineModal = showMachineModal;
window.deleteItem = deleteItem;
window.downloadClosingReport = downloadClosingReport;

// Initialize app
initializeApp();
