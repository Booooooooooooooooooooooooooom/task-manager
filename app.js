// ===== 飞书配置 =====
const FEISHU_CONFIG = {
    appId: 'cli_aa8c75fb89629bdd',
    appSecret: 'ZPiTGdPm9h8O6fJGaqwHMh2KjaMBhUVp',
    appToken: 'BnZIbE8xiauxKYsjef5cOw70nFc',
    tableId: 'tblPwyRZonL7YmLs'
};

// ===== 飞书 API 基础地址 =====
const BITABLE_API = 'https://open.feishu.cn/open-apis/bitable/v1/apps';

// ===== 全局数据 =====
let allTasks = [];
let teamChartInstance = null;
let statusChartInstance = null;
let calendarInstance = null;
let currentUser = null;
let isFeishuReady = false;
let isLoading = false;

// ===== 常量定义 =====
const TEAM_OPTIONS = ['AP', 'AR', 'GL', 'SCMC', 'Treasury'];
const CYCLE_OPTIONS = ['每年', '每半年', '每季度', '每月', '每两周', '每周', '一次性'];

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 页面加载完成，开始初始化...');
    console.log('📍 window.h5 是否存在:', typeof window.h5 !== 'undefined');
    initFeishu();
});

// ===== 飞书初始化 =====
function initFeishu() {
    updateStatus('正在连接飞书...', 'loading');

    // 立即检查 h5 对象
    if (typeof window.h5 !== 'undefined') {
        console.log('✅ 检测到飞书环境 h5 SDK');
        window.h5.ready(() => {
            console.log('✅ 飞书 SDK ready 回调触发');
            isFeishuReady = true;

            window.h5.getUserInfo({
                success: (res) => {
                    console.log('✅ 获取用户信息成功:', res);
                    currentUser = res;
                    updateStatus(`已登录: ${res.name}`, 'success');
                    updateUserInfo(res.name);
                    initApp();
                },
                fail: (err) => {
                    console.error('❌ 获取用户信息失败:', err);
                    updateStatus('获取用户信息失败，使用本地模式', 'warning');
                    initApp();
                }
            });
        });

        // 超时处理：如果 3 秒后还没 ready，尝试直接初始化
        setTimeout(() => {
            if (!isFeishuReady) {
                console.log('⚠️ h5.ready 超时，尝试直接获取用户信息...');
                try {
                    window.h5.getUserInfo({
                        success: (res) => {
                            currentUser = res;
                            isFeishuReady = true;
                            updateStatus(`已登录: ${res.name}`, 'success');
                            updateUserInfo(res.name);
                            initApp();
                        },
                        fail: () => {
                            console.log('⚠️ 无法获取用户信息，使用本地模式');
                            updateStatus('无法获取飞书用户信息', 'warning');
                            initApp();
                        }
                    });
                } catch (e) {
                    console.error('获取用户信息异常:', e);
                    updateStatus('飞书连接异常', 'error');
                    initApp();
                }
            }
        }, 3000);

    } else {
        console.log('⚠️ 未检测到飞书环境 h5 SDK');
        console.log('💡 请确认：1. 在飞书工作台打开应用 2. 应用已正确配置网页能力 3. 应用已发布');
        updateStatus('演示模式（请在飞书工作台中打开）', 'warning');
        initApp();
    }
}

function updateStatus(message, type) {
    const statusEl = document.getElementById('loginStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'login-status ' + type;
    }
    console.log('📊 状态更新:', message, '(' + type + ')');
}

function updateUserInfo(name) {
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) userInfoEl.textContent = `当前用户: ${name}`;
}

// ===== 飞书 API 调用封装 =====
async function callFeishuAPI(method, path, body) {
    return new Promise((resolve, reject) => {
        if (!isFeishuReady || typeof window.h5 === 'undefined') {
            reject(new Error('不在飞书环境'));
            return;
        }

        const url = `${BITABLE_API}/${FEISHU_CONFIG.appToken}${path}`;
        console.log('📡 飞书 API 调用:', method, url);

        const options = {
            url: url,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            success: (res) => {
                console.log('✅ API 成功:', res);
                if (res.code === 0) {
                    resolve(res.data);
                } else {
                    reject(new Error(res.msg || `API 错误 code: ${res.code}`));
                }
            },
            fail: (err) => {
                console.error('❌ API 失败:', err);
                reject(new Error(err.message || '网络请求失败'));
            }
        };

        if (body) {
            options.data = body;
        }

        window.h5.request(options);
    });
}

// ===== 初始化应用 =====
async function initApp() {
    console.log('🔧 开始初始化应用...');
    showLoading('正在加载数据...');

    try {
        if (isFeishuReady) {
            console.log('📥 开始从飞书加载数据...');
            await loadFromFeishu();
        } else {
            console.log('📥 使用演示数据...');
            initDemoData();
        }

        initOverview();
        initCalendar();
        updateAllViews();

        // 每 30 秒自动刷新
        setInterval(() => {
            if (isFeishuReady && !isLoading) {
                silentRefresh();
            }
        }, 30000);

    } catch (error) {
        console.error('❌ 初始化失败:', error);
        initDemoData();
        updateAllViews();
    } finally {
        hideLoading();
    }

    // 点击外部关闭下拉
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.multi-select-dropdown')) {
            document.querySelectorAll('.multi-select-options').forEach(d => d.classList.remove('show'));
        }
    });
}

// ===== 显示/隐藏加载状态 =====
function showLoading(message) {
    isLoading = true;
    let el = document.getElementById('globalLoading');
    if (!el) {
        el = document.createElement('div');
        el.id = 'globalLoading';
        el.className = 'global-loading';
        el.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">' + message + '</div>';
        document.body.appendChild(el);
    } else {
        el.querySelector('.loading-text').textContent = message;
        el.style.display = 'flex';
    }
}

function hideLoading() {
    isLoading = false;
    const el = document.getElementById('globalLoading');
    if (el) el.style.display = 'none';
}

// ===== 从飞书加载数据（真实 API）=====
async function loadFromFeishu() {
    if (!isFeishuReady) {
        showToast('请在飞书工作台中打开此应用', 'error');
        return;
    }

    try {
        showLoading('正在从飞书加载数据...');
        console.log('📥 从飞书多维表格加载数据...');

        const data = await callFeishuAPI('GET', `/tables/${FEISHU_CONFIG.tableId}/records?page_size=500`);

        if (data && data.items) {
            allTasks = data.items.map(recordToTask);
            console.log(`✅ 成功加载 ${allTasks.length} 条记录`);
            updateAllViews();
            showToast(`已加载 ${allTasks.length} 条任务`, 'success');
        } else {
            console.log('⚠️ 多维表格为空');
            allTasks = [];
            updateAllViews();
            showToast('多维表格暂无数据', 'info');
        }

    } catch (error) {
        console.error('❌ 加载失败:', error);
        showToast('加载失败: ' + error.message, 'error');
        initDemoData();
        updateAllViews();
    } finally {
        hideLoading();
    }
}

// ===== 静默刷新（不显示 loading）=====
async function silentRefresh() {
    try {
        const data = await callFeishuAPI('GET', `/tables/${FEISHU_CONFIG.tableId}/records?page_size=500`);
        if (data && data.items) {
            const newTasks = data.items.map(recordToTask);
            if (JSON.stringify(newTasks) !== JSON.stringify(allTasks)) {
                allTasks = newTasks;
                updateAllViews();
                showToast('数据已更新', 'info');
            }
        }
    } catch (error) {
        console.error('静默刷新失败:', error);
    }
}

// ===== 手动刷新按钮 =====
async function manualRefresh() {
    console.log('🔄 手动刷新被点击, isFeishuReady:', isFeishuReady);
    if (!isFeishuReady) {
        showToast('请在飞书工作台中打开此应用', 'error');
        console.log('💡 当前不在飞书环境，无法刷新');
        return;
    }
    await loadFromFeishu();
}

// ===== 飞书记录 → 本地任务 =====
function recordToTask(record) {
    const f = record.fields;
    return {
        id: record.record_id,
        title: f['事项(月份+事项)'] || '',
        teams: f['团队'] || [],
        month: f['月份'] || '',
        date: formatDateValue(f['日期']),
        type: f['事项类型'] || '',
        assignee: f['责任人'] || '',
        receiver: f['接收人'] || '',
        cycle: f['周期类型'] || ''
    };
}

// ===== 本地任务 → 飞书记录 =====
function taskToRecord(task) {
    return {
        fields: {
            '事项(月份+事项)': task.title || '',
            '团队': task.teams || [],
            '月份': task.month || '',
            '日期': task.date ? parseInt(task.date.replace(/-/g, '')) : null,
            '事项类型': task.type || '',
            '责任人': task.assignee || '',
            '接收人': task.receiver || '',
            '周期类型': task.cycle || ''
        }
    };
}

// ===== 日期格式转换 =====
function formatDateValue(val) {
    if (!val) return '';
    const str = String(val);
    if (str.length === 8 && /^\d{8}$/.test(str)) {
        return str.substring(0, 4) + '-' + str.substring(4, 6) + '-' + str.substring(6, 8);
    }
    if (typeof val === 'number') {
        const s = String(val);
        if (s.length === 8) return s.substring(0, 4) + '-' + s.substring(4, 6) + '-' + s.substring(6, 8);
    }
    return String(val || '');
}

function getMonthFromDate(dateStr) {
    return dateStr ? dateStr.substring(0, 7) : '';
}

// ===== 创建任务到飞书 =====
async function createTaskToFeishu(task) {
    if (!isFeishuReady) return null;

    try {
        const record = taskToRecord(task);
        const data = await callFeishuAPI('POST', `/tables/${FEISHU_CONFIG.tableId}/records`, record);
        if (data && data.record) {
            return recordToTask(data.record);
        }
    } catch (error) {
        console.error('❌ 创建任务失败:', error);
        showToast('创建失败: ' + error.message, 'error');
    }
    return null;
}

// ===== 更新任务到飞书 =====
async function updateTaskToFeishu(task) {
    if (!isFeishuReady || !task.id) return false;

    try {
        const record = taskToRecord(task);
        await callFeishuAPI('PUT', `/tables/${FEISHU_CONFIG.tableId}/records/${task.id}`, record);
        console.log('✅ 已更新:', task.title);
        return true;
    } catch (error) {
        console.error('❌ 更新失败:', error);
        showToast('更新失败: ' + error.message, 'error');
    }
    return false;
}

// ===== 删除任务从飞书 =====
async function deleteTaskFromFeishu(taskId) {
    if (!isFeishuReady || !taskId) return false;

    try {
        await callFeishuAPI('DELETE', `/tables/${FEISHU_CONFIG.tableId}/records/${taskId}`);
        console.log('✅ 已删除:', taskId);
        return true;
    } catch (error) {
        console.error('❌ 删除失败:', error);
        showToast('删除失败: ' + error.message, 'error');
    }
    return false;
}

// ===== 初始化演示数据 =====
function initDemoData() {
    allTasks = [
        { id: 'demo1', title: '完成Q3财务报表', teams: ['GL', 'AP'], month: '2025-06', date: '2025-06-15', type: '财务报告', assignee: '张三', receiver: '李四', cycle: '每季度' },
        { id: 'demo2', title: '供应商付款审核', teams: ['AP'], month: '2025-06', date: '2025-06-20', type: '付款审核', assignee: '王五', receiver: '赵六', cycle: '每月' },
        { id: 'demo3', title: '客户对账', teams: ['AR'], month: '2025-06', date: '2025-06-25', type: '对账', assignee: '李四', receiver: '张三', cycle: '每月' },
        { id: 'demo4', title: '库存盘点', teams: ['SCMC'], month: '2025-06', date: '2025-06-30', type: '盘点', assignee: '赵六', receiver: '王五', cycle: '每月' },
        { id: 'demo5', title: '资金计划编制', teams: ['Treasury'], month: '2025-06', date: '2025-06-10', type: '资金计划', assignee: '张三', receiver: '李四', cycle: '每月' }
    ];
}

// ===== Toast 提示 =====
function showToast(message, type) {
    type = type || 'info';
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// ===== 标签页切换 =====
function switchTab(tabName) {
    document.querySelectorAll('.tab-item').forEach(function(item) {
        item.classList.remove('active');
        if (item.dataset.tab === tabName) item.classList.add('active');
    });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    document.getElementById(tabName).classList.add('active');
    if (tabName === 'calendar' && calendarInstance) calendarInstance.updateSize();
}

// ===== 任务总览 =====
function initOverview() { filterOverview(); }

function getSelectedTeam() { return document.getElementById('teamFilter').value; }

function filterOverview() {
    const selectedTeam = getSelectedTeam();
    const startMonth = document.getElementById('overviewStartMonth').value;
    const endMonth = document.getElementById('overviewEndMonth').value;
    let filtered = allTasks.slice();
    if (selectedTeam) filtered = filtered.filter(function(t) { return t.teams && t.teams.includes(selectedTeam); });
    if (startMonth) filtered = filtered.filter(function(t) { return (t.month || '') >= startMonth; });
    if (endMonth) filtered = filtered.filter(function(t) { return (t.month || '') <= endMonth; });
    renderOverviewTaskList(filtered);
    updateOverviewStats(filtered);
    updateCharts(filtered);
}

function resetOverviewFilter() {
    document.getElementById('teamFilter').value = '';
    document.getElementById('overviewStartMonth').value = '';
    document.getElementById('overviewEndMonth').value = '';
    filterOverview();
}

function renderOverviewTaskList(tasks) {
    const tbody = document.getElementById('overviewTaskList');
    tbody.innerHTML = '';
    tasks.forEach(function(task) {
        const row = document.createElement('tr');
        row.innerHTML =
            '<td>' + (task.title || '') + '</td>' +
            '<td>' + (task.teams ? task.teams.join(', ') : '') + '</td>' +
            '<td>' + (task.month || '') + '</td>' +
            '<td>' + (task.date || '') + '</td>' +
            '<td>' + (task.type || '') + '</td>' +
            '<td>' + (task.assignee || '') + '</td>' +
            '<td>' + (task.receiver || '') + '</td>' +
            '<td>' + (task.cycle || '') + '</td>';
        tbody.appendChild(row);
    });
    document.getElementById('overviewCount').textContent = tasks.length;
}

function updateOverviewStats(tasks) {
    document.getElementById('totalTasks').textContent = tasks.length;
    document.getElementById('monthlyTasks').textContent = tasks.filter(function(t) { return t.cycle === '每月'; }).length;
    document.getElementById('quarterlyTasks').textContent = tasks.filter(function(t) { return t.cycle === '每季度'; }).length;
    document.getElementById('yearlyTasks').textContent = tasks.filter(function(t) { return t.cycle === '每年'; }).length;
}

function updateCharts(tasks) { updateTeamChart(tasks); updateCycleChart(tasks); }

function updateTeamChart(tasks) {
    const ctx = document.getElementById('teamChart').getContext('2d');
    const teamData = {};
    tasks.forEach(function(t) { if (t.teams) t.teams.forEach(function(team) { teamData[team] = (teamData[team] || 0) + 1; }); });
    if (teamChartInstance) teamChartInstance.destroy();
    teamChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(teamData), datasets: [{ label: '任务数量', data: Object.values(teamData), backgroundColor: ['#3182ce', '#38a169', '#dd6b20', '#805ad5', '#e53e3e'], borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function updateCycleChart(tasks) {
    const ctx = document.getElementById('cycleChart').getContext('2d');
    const cycleData = { '每年': 0, '每半年': 0, '每季度': 0, '每月': 0, '每两周': 0, '每周': 0, '一次性': 0 };
    tasks.forEach(function(t) { if (cycleData[t.cycle] !== undefined) cycleData[t.cycle]++; });
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(cycleData), datasets: [{ label: '任务数量', data: Object.values(cycleData), backgroundColor: ['#3182ce', '#38a169', '#dd6b20', '#805ad5', '#e53e3e', '#f6ad55', '#a0aec0'], borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

// ===== 日历视图 =====
function initCalendar() {
    const calendarEl = document.getElementById('calendarView');
    calendarEl.style.height = '650px';
    const dates = allTasks.map(function(t) { return t.date; }).filter(function(d) { return d; }).sort();
    const initialDate = dates.length > 0 ? dates[0] : '2025-06-01';
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', initialDate: initialDate, locale: 'zh-cn', firstDay: 1,
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
        events: [], eventDisplay: 'block', displayEventTime: false,
        eventClick: function(info) {
            const p = info.event.extendedProps;
            alert('事项：' + p.title + '\n团队：' + p.teams + '\n责任人：' + p.assignee + '\n接收人：' + p.receiver + '\n周期：' + p.cycle);
        }
    });
    calendarInstance.render();
}

function updateCalendar() {
    if (!calendarInstance) return;
    const events = allTasks.filter(function(t) { return t.date; }).map(function(task) {
        return {
            id: task.id,
            title: (task.teams ? task.teams.join('/') : '') + ' - ' + (task.title || ''),
            start: task.date, allDay: true,
            color: getEventColorByTeam(task.teams),
            extendedProps: { title: task.title, teams: task.teams ? task.teams.join(', ') : '', assignee: task.assignee, receiver: task.receiver, cycle: task.cycle }
        };
    });
    calendarInstance.removeAllEvents();
    calendarInstance.addEventSource(events);
}

function getEventColorByTeam(teams) {
    var colors = { 'AP': '#3182ce', 'AR': '#38a169', 'GL': '#dd6b20', 'SCMC': '#805ad5', 'Treasury': '#e53e3e' };
    return (teams && teams.length > 0) ? (colors[teams[0]] || '#3182ce') : '#3182ce';
}

// ===== 数据源（多维表格）=====
function renderBitable() {
    const tbody = document.getElementById('bitableBody');
    tbody.innerHTML = '';

    allTasks.forEach(function(task, index) {
        const row = document.createElement('tr');
        row.dataset.id = task.id;
        row.innerHTML =
            '<td><span class="seq-number">' + (index + 1) + '</span></td>' +
            '<td><div class="cell" contenteditable="true" data-field="title" data-id="' + task.id + '">' + (task.title || '') + '</div></td>' +
            '<td><div class="cell-multi-select" data-field="teams" data-id="' + task.id + '">' + renderTeamMultiSelect(task.teams, task.id) + '</div></td>' +
            '<td><div class="cell month-display" data-field="month" data-id="' + task.id + '">' + (task.month || '') + '</div></td>' +
            '<td><div class="cell-select"><input type="date" data-field="date" data-id="' + task.id + '" value="' + (task.date || '') + '" onchange="onDateChange(this)" style="border:none;background:transparent;font-size:14px;padding:6px 0;width:100%;outline:none;"></div></td>' +
            '<td><div class="cell" contenteditable="true" data-field="type" data-id="' + task.id + '">' + (task.type || '') + '</div></td>' +
            '<td><div class="cell" contenteditable="true" data-field="assignee" data-id="' + task.id + '">' + (task.assignee || '') + '</div></td>' +
            '<td><div class="cell" contenteditable="true" data-field="receiver" data-id="' + task.id + '">' + (task.receiver || '') + '</div></td>' +
            '<td><div class="cell-select"><select data-field="cycle" data-id="' + task.id + '" onchange="onCellChange(this)">' + getOptionsHtml(CYCLE_OPTIONS, task.cycle) + '</select></div></td>' +
            '<td style="text-align:center"><button class="btn-delete" onclick="deleteTask(\'' + task.id + '\')" title="删除">🗑</button></td>';
        tbody.appendChild(row);
    });

    tbody.querySelectorAll('.cell[contenteditable]').forEach(function(cell) {
        cell.addEventListener('blur', function() { onCellChange(this); });
    });
    tbody.querySelectorAll('.team-checkbox').forEach(function(cb) {
        cb.addEventListener('change', function() { onTeamMultiSelectChange(this); });
    });

    document.getElementById('datasourceCount').textContent = allTasks.length;
}

function onDateChange(element) {
    const id = element.dataset.id;
    const dateValue = element.value;
    const monthValue = getMonthFromDate(dateValue);
    const task = allTasks.find(function(t) { return t.id === id; });
    if (task) {
        task.date = dateValue;
        task.month = monthValue;
        const monthCell = element.closest('tr').querySelector('.month-display');
        if (monthCell) monthCell.textContent = monthValue;
        updateAllViews();
        if (isFeishuReady) updateTaskToFeishu(task);
    }
}

function renderTeamMultiSelect(selectedTeams, taskId) {
    const teams = selectedTeams || [];
    let html = '<div class="multi-select-dropdown" data-id="' + taskId + '">' +
        '<div class="multi-select-display" onclick="toggleTeamDropdown(\'' + taskId + '\')">' +
        (teams.length > 0 ? teams.join(', ') : '<span class="placeholder">选择团队</span>') +
        '</div><div class="multi-select-options" id="team-options-' + taskId + '">';
    TEAM_OPTIONS.forEach(function(team) {
        html += '<label class="multi-select-option"><input type="checkbox" class="team-checkbox" value="' + team + '" data-id="' + taskId + '"' + (teams.includes(team) ? ' checked' : '') + '><span>' + team + '</span></label>';
    });
    html += '</div></div>';
    return html;
}

function toggleTeamDropdown(taskId) {
    const dropdown = document.getElementById('team-options-' + taskId);
    document.querySelectorAll('.multi-select-options').forEach(function(d) {
        if (d.id !== 'team-options-' + taskId) d.classList.remove('show');
    });
    dropdown.classList.toggle('show');
}

function onTeamMultiSelectChange(checkbox) {
    const taskId = checkbox.dataset.id;
    const task = allTasks.find(function(t) { return t.id === taskId; });
    if (task) {
        const checked = document.querySelectorAll('.team-checkbox[data-id="' + taskId + '"]:checked');
        task.teams = Array.from(checked).map(function(cb) { return cb.value; });
        const display = checkbox.closest('.multi-select-dropdown').querySelector('.multi-select-display');
        display.innerHTML = task.teams.length > 0 ? task.teams.join(', ') : '<span class="placeholder">选择团队</span>';
        updateAllViews();
        if (isFeishuReady) updateTaskToFeishu(task);
    }
}

function getOptionsHtml(options, selectedValue) {
    let html = '<option value="">--</option>';
    options.forEach(function(opt) {
        html += '<option value="' + opt + '"' + (opt === selectedValue ? ' selected' : '') + '>' + opt + '</option>';
    });
    return html;
}

function onCellChange(element) {
    const id = element.dataset.id;
    const field = element.dataset.field;
    const value = element.value || element.textContent.trim();
    const task = allTasks.find(function(t) { return t.id === id; });
    if (task) {
        task[field] = value;
        updateAllViews();
        if (isFeishuReady) updateTaskToFeishu(task);
    }
}

async function addNewRow() {
    const newTask = {
        id: 'temp_' + Date.now(),
        title: '', month: '', date: '', type: '', assignee: '', receiver: '', cycle: '', teams: []
    };

    if (isFeishuReady) {
        const saved = await createTaskToFeishu(newTask);
        if (saved) {
            allTasks.push(saved);
            renderBitable();
            updateAllViews();
            showToast('已添加到飞书', 'success');
        }
    } else {
        allTasks.push(newTask);
        renderBitable();
        updateAllViews();
        showToast('演示模式：仅本地添加', 'info');
    }

    setTimeout(function() {
        const tbody = document.getElementById('bitableBody');
        const lastRow = tbody.lastElementChild;
        if (lastRow) {
            lastRow.classList.add('row-new');
            lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const firstCell = lastRow.querySelector('.cell[contenteditable]');
            if (firstCell) setTimeout(function() { firstCell.focus(); }, 100);
        }
    }, 100);
}

async function deleteTask(id) {
    if (!confirm('确定要删除这条任务吗？')) return;
    if (isFeishuReady) {
        await deleteTaskFromFeishu(id);
    }
    allTasks = allTasks.filter(function(t) { return t.id !== id; });
    renderBitable();
    updateAllViews();
    showToast('已删除', 'success');
}

function updateAllViews() {
    filterOverview();
    updateCalendar();
    renderBitable();
}
