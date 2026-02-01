
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
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

function formatMonthYear(date) {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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
    return `<span class="px-2 py-0.5 rounded text-xs font-medium text-white ${classes[shift] || 'bg-gray-500'}">Turno ${shift}</span>`;
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
    let filtered = Object.entries(productions).map(([id, data]) => ({ id, ...data }));

    if (!canViewAllShifts()) {
        const userShift = getUserShift();
        const allowedOperators = Object.keys(operators).filter(id => operators[id].shift === userShift);
        filtered = filtered.filter(p => allowedOperators.includes(p.operatorId));
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

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const userEntry = Object.entries(users).find(([id, u]) =>
        u.username === username && u.password === password
    );

    if (userEntry) {
        const [userId, userData] = userEntry;
        currentUser = { ...userData, id: userId };
        localStorage.setItem('currentUser', JSON.stringify({ id: userId }));
        showMainApp();
        showToast('Login realizado com sucesso!');
    } else {
        const errorDiv = document.getElementById('login-error');
        errorDiv.querySelector('p').textContent = 'Usuário ou senha inválidos';
        errorDiv.classList.remove('hidden');
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').classList.add('hidden');
}

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
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    updateDashboard();
    updateProductionView();
}

// Dashboard
function updateDashboard() {
    const monthKey = getMonthKey(currentMonth);
    document.getElementById('current-month-dash').textContent = formatMonthYear(currentMonth);
    document.getElementById('current-month-prod').textContent = formatMonthYear(currentMonth);

    const filtered = getFilteredProductions().filter(p => p.date.startsWith(monthKey));

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
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const currentMachine = Object.entries(machines).find(([id, m]) => m.name.includes(selectedMachine));

    if (!currentMachine) {
        document.getElementById('calendar-days').innerHTML = '<p class="col-span-7 text-center text-gray-500 py-4">Configure as máquinas primeiro</p>';
        document.getElementById('monthly-table-body').innerHTML = '';
        return;
    }

    const [machineId, machineData] = currentMachine;
    const filtered = getFilteredProductions().filter(p =>
        p.date.startsWith(monthKey) && p.machineId === machineId
    );

    // Calendar
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let calendarHtml = '';

    for (let i = 0; i < firstDay.getDay(); i++) {
        calendarHtml += '<div class="aspect-square"></div>';
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDate = new Date(year, month, day);
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
    ${day}
  </div>
`;

    }

    document.getElementById('calendar-days').innerHTML = calendarHtml;

    // Table
    const isClosed = isMonthClosed(monthKey);
    let tableHtml = '';

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDate = new Date(year, month, day);
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
            'admin': '<span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">Admin</span>',
            'leader': '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Líder</span>',
            'operator': '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Operador</span>'
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
function populateFilterSelects() {
    const machineOptions = Object.entries(machines).map(([id, m]) =>
        `<option value="${id}">${m.name}</option>`
    ).join('');
    document.getElementById('filter-machine').innerHTML = `<option value="">Todas</option>${machineOptions}`;

    let filteredOps = Object.entries(operators);
    if (!canViewAllShifts()) {
        filteredOps = filteredOps.filter(([id, o]) => o.shift === getUserShift());
    }

    const opOptions = filteredOps.map(([id, o]) =>
        `<option value="${id}">${o.name}</option>`
    ).join('');
    document.getElementById('filter-operator').innerHTML = `<option value="">Todos</option>${opOptions}`;
}

function updateFilterVisibility() {
    const reportType = document.getElementById('report-type').value;
    document.getElementById('filter-machine-container').style.display = reportType === 'machine' ? 'block' : 'none';
    document.getElementById('filter-operator-container').style.display = reportType === 'operator' ? 'block' : 'none';
    document.getElementById('filter-shift-container').style.display = reportType === 'shift' ? 'block' : 'none';
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

   // 🔹 Filtrar por mês atual
const monthKey = getMonthKey(currentMonth);
filtered = filtered.filter(p => p.date && p.date.startsWith(monthKey));

// ================================
// 🔥 FILTRAR SOMENTE MÁQUINAS 8, 9 e 10 (PRIMEIRO)
// ================================
const allowedMachines = ['8', '9', '10'];

filtered = filtered.filter(p => {
    const machine = machines[p.machineId];
    if (!machine || !machine.name) return false;

    const machineNumber = machine.name.replace(/\D/g, '');
    return allowedMachines.includes(machineNumber);
});

// 🔹 Filtros por tipo (DEPOIS DO FILTRO DE MÁQUINAS)
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

// ================================
// 🔢 ORDENAR: MÁQUINA → DATA
// ================================
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


    // ================================
    // 📄 PAGINAÇÃO
    // ================================
    const totalPages = Math.ceil(filtered.length / REPORT_PAGE_SIZE) || 1;
    if (reportPage > totalPages) reportPage = totalPages;

    const start = (reportPage - 1) * REPORT_PAGE_SIZE;
    const paginated = filtered.slice(start, start + REPORT_PAGE_SIZE);

    // ================================
    // 🧾 TABELA
    // ================================
    const tableHtml = paginated.map(p => {
        const machine = machines[p.machineId];
        const operator = operators[p.operatorId];

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

    // ================================
    // 🔘 CONTROLES DE PAGINAÇÃO
    // ================================
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

    // ================================
    // 📊 RESUMO
    // ================================
    const totalQuantity = filtered.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalDowntime = filtered.reduce((sum, p) => sum + (p.downtime || 0), 0);
    const uniqueDays = [...new Set(filtered.map(p => p.date))].length;

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
    const filtered = getFilteredProductions()
        .filter(p => p.date.startsWith(monthKey))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

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

    const statsByShift = { A: { quantity: 0, downtime: 0, count: 0 }, B: { quantity: 0, downtime: 0, count: 0 }, C: { quantity: 0, downtime: 0, count: 0 } };
    const operatorStats = {};
    
    filtered.forEach(p => {
        const operator = operators[p.operatorId];
        const shift = operator?.shift || 'A';
        statsByShift[shift].quantity += p.quantity || 0;
        statsByShift[shift].downtime += p.downtime || 0;
        statsByShift[shift].count++;
        
        if (!operatorStats[p.operatorId]) {
            operatorStats[p.operatorId] = { name: operator?.name || 'N/A', shift, quantity: 0, downtime: 0, count: 0 };
        }
        operatorStats[p.operatorId].quantity += p.quantity || 0;
        operatorStats[p.operatorId].downtime += p.downtime || 0;
        operatorStats[p.operatorId].count++;
    });

    const topOperators = Object.values(operatorStats).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    const summaryContainer = document.createElement('div');
    summaryContainer.style.cssText = `position: absolute; left: -9999px; top: 0; width: 793px; background: white; font-family: 'Inter', sans-serif;`;

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
                    ${config.app_title || 'Controle de Produção'}
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
                    ${['A', 'B', 'C'].map(shift => `
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
        const canvas = await html2canvas(summaryContainer, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = 210;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
    } catch (error) {
        console.error('Erro ao gerar resumo:', error);
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
        const prods = data.productions.sort((a, b) => new Date(a.date) - new Date(b.date));
        const total = prods.reduce((sum, p) => sum + (p.quantity || 0), 0);
        const downtime = prods.reduce((sum, p) => sum + (p.downtime || 0), 0);
        const uniqueOpDays = [...new Set(prods.map(p => p.date))].length;
        const avgPerDay = uniqueOpDays > 0 ? Math.round(total / uniqueOpDays) : 0;

        const detailContainer = document.createElement('div');
        detailContainer.style.cssText = `position: absolute; left: -9999px; top: 0; width: 793px; background: white; font-family: 'Inter', sans-serif;`;

        detailContainer.innerHTML = `
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                .pdf-page { width: 793px; min-height: 1122px; background: white; padding: 0; }
                
                /* 🔧 HEADER - Diminuir: reduzir padding (ex: 14px -> 10px) | Aumentar: aumentar padding */
                .pdf-header { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; padding: 14px 30px; display: flex; justify-content: space-between; align-items: center; }
                .header-left { flex: 1; }
                
                /* 🔧 TÍTULO - Diminuir: reduzir font-size (ex: 18px -> 14px) | Aumentar: aumentar font-size */
                .pdf-title { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
                
                /* 🔧 SUBTÍTULO - Diminuir: reduzir font-size (ex: 9px -> 7px) | Aumentar: aumentar font-size */
                .pdf-subtitle { font-size: 9px; opacity: 0.95; }
                
                .operator-info-header { background: rgba(255,255,255,0.15); padding: 6px 10px; border-radius: 6px; }
                
                /* 🔧 NOME OPERADOR - Diminuir: reduzir font-size (ex: 13px -> 11px) | Aumentar: aumentar font-size */
                .operator-name-big { font-size: 13px; font-weight: 800; margin-bottom: 2px; display: flex; align-items: center; gap: 5px; }
                
                /* 🔧 INFO OPERADOR - Diminuir: reduzir font-size (ex: 8px -> 6px) | Aumentar: aumentar font-size */
                .operator-stats-header { display: flex; gap: 10px; font-size: 8px; margin-top: 2px; }
                
                /* 🔧 PADDING CONTEÚDO - Diminuir: reduzir padding (ex: 14px -> 10px) | Aumentar: aumentar padding */
                .content { padding: 14px 30px; }
                
                /* 🔧 ESPAÇAMENTO CARDS - Diminuir: reduzir gap (ex: 6px -> 4px) | Aumentar: aumentar gap */
                .stats-mini-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
                
                /* 🔧 PADDING CARDS - Diminuir: reduzir padding (ex: 6px -> 4px) | Aumentar: aumentar padding */
                .stat-mini-card { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 5px; padding: 6px; text-align: center; }
                
                /* 🔧 ÍCONE CARD - Diminuir: reduzir width/height (ex: 24px -> 20px) e font-size | Aumentar: aumentar */
                .stat-mini-icon { width: 24px; height: 24px; background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; border-radius: 5px; display: flex; align-items: center; justify-content: center; margin: 0 auto 4px; font-size: 11px; }
                
                /* 🔧 LABEL CARD - Diminuir: reduzir font-size (ex: 6.5px -> 5.5px) | Aumentar: aumentar font-size */
                .stat-mini-label { color: #64748b; font-size: 6.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px; }
                
                /* 🔧 VALOR CARD - Diminuir: reduzir font-size (ex: 13px -> 11px) | Aumentar: aumentar font-size */
                .stat-mini-value { color: #0f172a; font-size: 13px; font-weight: 800; }
                
                /* 🔧 TÍTULO SEÇÃO - Diminuir: reduzir font-size e margin | Aumentar: aumentar */
                .section-title-small { font-size: 11px; font-weight: 800; color: #0f172a; margin: 10px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #0891b2; display: flex; align-items: center; gap: 5px; }
                .section-title-small i { color: #0891b2; font-size: 11px; }
                
                /* 🔧 TABELA */
                .prod-table { width: 100%; border-collapse: collapse; background: white; border: 1.5px solid #cbd5e1; border-radius: 7px; overflow: hidden; }
                .prod-table thead { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; }
                
                /* 🔧 HEADER TABELA - Diminuir: reduzir padding e font-size | Aumentar: aumentar */
                .prod-table th { padding: 7px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
                
                .prod-table tbody tr { border-bottom: 1px solid #e2e8f0; }
                .prod-table tbody tr:last-child { border-bottom: none; }
                .prod-table tbody tr:nth-child(even) { background: #f8fafc; }
                .prod-table tbody tr:hover { background: #f0f9ff; }
                
                /* 🔧 CÉLULAS TABELA - Diminuir: reduzir padding (ex: 6px -> 4px) e font-size | Aumentar: aumentar */
                .prod-table td { padding: 6px 8px; font-size: 9px; color: #1e293b; line-height: 1.4; }
                
                .prod-table td.date-col { font-weight: 700; color: #0891b2; }
                .prod-table td.machine-col { font-weight: 600; }
                .prod-table td.quantity-col { font-weight: 800; color: #0891b2; text-align: center; }
                .prod-table td.downtime-col { font-weight: 600; color: #64748b; text-align: center; }
                
                /* 🔧 OBSERVAÇÕES - Agora responsivo com quebra de linha automática */
                .prod-table td.obs-col { color: #64748b; font-style: italic; max-width: 220px; word-wrap: break-word; white-space: normal; }
            </style>
            
            <div class="pdf-page">
                <div class="pdf-header">
                    <div class="header-left">
                        <div class="pdf-title"><i class="fas fa-industry"></i> ${config.app_title || 'Controle de Produção'}</div>
                        <div class="pdf-subtitle">${formatMonthYear(currentMonth)}</div>
                    </div>
                    <div class="operator-info-header">
                        <div class="operator-name-big">
                            <i class="fas fa-user-circle"></i>
                            ${operator?.name || 'N/A'}
                        </div>
                        <div class="operator-stats-header">
                            <span><i class="fas fa-clock"></i> ${getShiftName(operator?.shift || 'A')}</span>
                        </div>
                    </div>
                </div>
                
                <div class="content">
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
                    
                    <div class="section-title-small">
                        <i class="fas fa-table"></i>
                        Registro Detalhado de Produção
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
                            ${prods.map(p => `
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
            const canvas = await html2canvas(detailContainer, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = 210;
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
        } catch (error) {
            console.error('Erro ao gerar página do operador:', error);
        } finally {
            document.body.removeChild(detailContainer);
        }
    }

    pdf.save(`relatorio_producao_${monthKey}.pdf`);
    showToast('PDF completo exportado com sucesso!');
}



function exportToExcel() {
    const filtered = getFilteredProductions()
        .filter(p => p.date.startsWith(getMonthKey(currentMonth)))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const data = filtered.map(p => {
        const machine = machines[p.machineId];
        const operator = operators[p.operatorId];

        return {
            'Data': formatDate(p.date),
            'Maquina': machine?.name || '-',
            'Turno': operator?.shift || '-',
            'Operador': operator?.name || '-',
            'Quantidade': p.quantity || 0,
            'Tempo Parado (h)': p.downtime || 0,
            'Observacoes': p.observations || ''
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producao');
    XLSX.writeFile(wb, `relatorio_${getMonthKey(currentMonth)}.xlsx`);

    showToast('Excel exportado!');
}

// Closing
async function updateClosingView() {
    if (!['admin', 'leader'].includes(currentUser?.role)) return;

    const monthKey = getMonthKey(new Date());
    document.getElementById('closing-month').value = monthKey;

    const statusDiv = document.getElementById('closing-status');
    const snapshot = await database.ref(`closings/${monthKey}`).once('value');
    const data = snapshot.val();

    if (!data) {
        statusDiv.innerHTML = `
            <div class="flex items-center gap-2 text-yellow-600">
                <i class="fas fa-exclamation-circle"></i>
                Este mês ainda não foi fechado
            </div>`;
    } else if (data.reopened) {
        statusDiv.innerHTML = `
            <div class="flex items-center gap-2 text-red-600">
                <i class="fas fa-unlock"></i>
                Mês reaberto por <strong>${data.reopenedBy}</strong>
            </div>`;
    } else if (data.closed) {
        statusDiv.innerHTML = `
            <div class="flex items-center gap-2 text-green-600">
                <i class="fas fa-lock"></i>
                Mês fechado por <strong>${data.closedBy}</strong>
            </div>`;
    }

    const historyHtml = Object.entries(closings || {})
        .sort(([, a], [, b]) => new Date(b.closedAt) - new Date(a.closedAt))
        .map(([month, c]) => `
            <tr>
                <td>${month}</td>
                <td>${new Date(c.closedAt).toLocaleString('pt-BR')}</td>
                <td>${c.closedBy}</td>
                <td class="flex items-center gap-2">
                    <button onclick="downloadClosingReport('${month}')"
                        class="text-cyan-600 hover:text-cyan-800">
                        <i class="fas fa-download mr-1"></i>PDF
                    </button>
                    ${c.reopened
                ? '<span class="text-xs text-red-600"><i class="fas fa-unlock"></i> Reaberto</span>'
                : '<span class="text-xs text-green-600"><i class="fas fa-lock"></i> Fechado</span>'
            }
                </td>
            </tr>
        `).join('');

    document.getElementById('closing-history-body').innerHTML =
        historyHtml ||
        '<tr><td colspan="4" class="text-center py-8 text-gray-500">Nenhum fechamento</td></tr>';
}


async function closeMonth() {
    const monthKey = document.getElementById('closing-month').value;
    if (!monthKey) return;

    const ref = database.ref(`closings/${monthKey}`);

    const snapshot = await ref.once('value');
    const data = snapshot.val();

    if (data?.closed && !data?.reopened) {
        showToast('Este mês já está fechado', 'warning');
        return;
    }

    await ref.set({
        month: monthKey,
        closed: true,
        reopened: false,
        closedAt: new Date().toISOString(),
        closedBy: currentUser.name
    });

    showToast('Mês fechado com sucesso!', 'success');
    updateClosingView();
    updateMonthButtons(monthKey);
}

async function openMonth() {
    const monthKey = document.getElementById('closing-month').value;
    if (!monthKey) return;

    await database.ref(`closings/${monthKey}`).update({
        reopened: true,
        reopenedAt: new Date().toISOString(),
        reopenedBy: currentUser.name
    });

    showToast('Mês reaberto!', 'success');
    updateClosingView();
    updateMonthButtons(monthKey);
}


async function isMonthClosed(monthKey) {
    const snapshot = await database.ref(`closings/${monthKey}`).once('value');
    const data = snapshot.val();

    if (!data) return false;
    if (data.reopened) return false;

    return data.closed === true;
}

async function updateMonthButtons(monthKey) {
    if (!monthKey) return;

    const closeBtn = document.getElementById('close-month-btn');
    const openBtn = document.getElementById('open-month-btn');

    const closed = await isMonthClosed(monthKey);

    if (closed) {
        closeBtn.classList.add('hidden');
        openBtn.classList.remove('hidden');
    } else {
        closeBtn.classList.remove('hidden');
        openBtn.classList.add('hidden');
    }
}
document.getElementById('closing-month').addEventListener('change', e => {
    updateMonthButtons(e.target.value);
});

document.getElementById('close-month-btn').addEventListener('click', closeMonth);
document.getElementById('open-month-btn').addEventListener('click', openMonth);

async function downloadClosingReport(monthKey) {
    const { jsPDF } = window.jspdf;

    const filtered = getFilteredProductions()
        .filter(p => p.date.startsWith(monthKey))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = 'position:absolute;left:-9999px;top:0;background:white;font-family:Inter,sans-serif;';

    const totalQuantity = filtered.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalDowntime = filtered.reduce((sum, p) => sum + (p.downtime || 0), 0);
    const uniqueDays = [...new Set(filtered.map(p => p.date))].length;
    const avgPerDay = uniqueDays > 0 ? Math.round(totalQuantity / uniqueDays) : 0;

    // Função auxiliar para formatar o monthKey
    function formatMonthKeyToText(monthKey) {
        const [year, month] = monthKey.split('-');
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${monthNames[parseInt(month) - 1]} de ${year}`;
    }

    // Estatísticas por turno
    const statsByShift = { A: { quantity: 0, downtime: 0, count: 0 }, B: { quantity: 0, downtime: 0, count: 0 }, C: { quantity: 0, downtime: 0, count: 0 } };
    filtered.forEach(p => {
        const operator = operators[p.operatorId];
        const shift = operator?.shift || 'A';
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
                shift: operator?.shift || 'A',
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
    const bestShiftName = bestShift[0] === 'A' ? '1º Turno' : bestShift[0] === 'B' ? '2º Turno' : '3º Turno';

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
            <div class="pdf-month">${formatMonthKeyToText(monthKey)}</div>
            <div class="pdf-subtitle">${config.app_title || 'Controle de Produção Industrial'}</div>
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
              ${['A', 'B', 'C'].map(shift => {
                const shiftData = statsByShift[shift];
                const shiftAvg = shiftData.count > 0 ? Math.round(shiftData.quantity / shiftData.count) : 0;
                return `
                <div class="shift-card">
                  <div class="shift-header">
                    ${shift === 'A' ? '1º Turno (Manhã)' : shift === 'B' ? '2º Turno (Tarde)' : '3º Turno (Noite)'}
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
            <div class="pdf-month">${formatMonthKeyToText(monthKey)} - Continuação</div>
          </div>
          
          <div class="content">
            <!-- PRODUÇÃO POR MÁQUINA -->
            <div class="section-title">
              <i class="fas fa-cogs"></i>
              Desempenho Detalhado por Máquina
            </div>
            
            <div class="machine-list">
              ${Object.values(statsByMachine).sort((a, b) => b.quantity - a.quantity).map(machine => {
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
                    <td class="shift-col">${op.shift === 'A' ? '1º' : op.shift === 'B' ? '2º' : '3º'}</td>
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
