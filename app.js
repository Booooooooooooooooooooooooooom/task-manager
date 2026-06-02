// ===== API 配置 =====
// 腾讯云 SCF 函数 URL
const API_BASE_URL = 'https://1439227087-fulx05vji4.ap-chengdu.tencentscf.com';

// ===== 全局数据 =====
let allTasks = [];
let teamChartInstance = null;
let statusChartInstance = null;
let calendarInstance = null;
let isLoading = false;

// ===== 常量定义 =====
const TEAM_OPTIONS = ['AP', 'AR', 'GL', 'SCMC', 'Treasury'];
const CYCLE_OPTIONS = ['每年', '每半年', '每季度', '每月', '每两周', '每周', '一次性'];

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成');
    initApp();
});

// ===== 初始化应用 =====
async function initApp() {
    updateStatus('正在连接服务器...', 'loading');
    showLoading('正在加载数据...');

    try {
        await loadFromServer();
        initOverview();
        initCalendar();
        updateAllViews();

        // 每 5 分钟自动刷新（节省腾讯云额度）
        setInterval(function() {
            if (!isLoading) {
                silentRefresh();
            }
        }, 300000);

    } catch (error) {
        console.error('初始化失败:', error);
        updateStatus('服务器连接失败，使用演示数据', 'error');
        initDemoData();
        updateAllViews();
    } finally {
        hideLoading();
    }

    // 点击外部关闭下拉
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.multi-select-dropdown')) {
            document.querySelectorAll('.multi-select-options').forEach(function(d) { d.classList.remove('show'); });
        }
    });
}

// ===== 从服务器加载数据 =====
async function loadFromServer() {
    try {
        console.log('从服务器加载数据...');
        
        const response = await fetch(API_BASE_URL + '/api/tasks');
        const data = await response.json();
        
        if (data.code === 0 && Array.isArray(data.data)) {
            allTasks = data.data.map(recordToTask);
            console.log('成功加载 ' + allTasks.length + ' 条记录');
            updateStatus('已加载 ' + allTasks.length + ' 条任务', 'success');
            updateAllViews();
            showToast('已加载 ' + allTasks.length + ' 条任务', 'success');
        } else {
            throw new Error(data.msg || '加载失败');
        }
        
    } catch (error) {
        console.error('加载失败:', error);
        throw error;
    }
}

// ===== 静默刷新 =====
async function silentRefresh() {
    try {
        await loadFromServer();
    } catch (error) {
        console.error('静默刷新失败:', error);
    }
}

// ===== 手动刷新 =====
async function manualRefresh() {
    console.log('手动刷新');
    showLoading('正在刷新数据...');
    try {
        await loadFromServer();
        showToast('数据已刷新', 'success');
    } catch (error) {
        showToast('刷新失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ===== 创建任务 =====
async function createTask(task) {
    try {
        const response = await fetch(API_BASE_URL + '/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskToRecord(task))
        });
        const data = await response.json();
        if (data.code === 0 && data.data) {
            return recordToTask(data.data);
        }
        throw new Error(data.msg || '创建失败');
    } catch (error) {
        console.error('创建失败:', error);
        showToast('创建失败: ' + error.message, 'error');
        return null;
    }
}

// ===== 更新任务 =====
async function updateTask(task) {
    try {
        const response = await fetch(API_BASE_URL + '/api/tasks/' + task.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskToRecord(task))
        });
        const data = await response.json();
        if (data.code === 0) {
            return true;
        }
        throw new Error(data.msg || '更新失败');
    } catch (error) {
        console.error('更新失败:', error);
        showToast('更新失败: ' + error.message, 'error');
        return false;
    }
}

// ===== 删除任务 =====
async function deleteTaskFromServer(taskId) {
    try {
        const response = await fetch(API_BASE_URL + '/api/tasks/' + taskId, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.code === 0) {
            return true;
        }
        throw new Error(data.msg || '删除失败');
    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败: ' + error.message, 'error');
        return false;
    }
}

// ===== 飞书记录 转 本地任务 =====
function recordToTask(record) {
    var f = record.fields || {};
    
    // 处理团队字段 - 可能是数组或字符串
    var teams = f['团队'];
    if (typeof teams === 'string') {
        teams = teams.split(/[,，]/).map(function(t) { return t.trim(); }).filter(function(t) { return t; });
    } else if (Array.isArray(teams)) {
        teams = teams;
    } else {
        teams = [];
    }
    
    return {
        id: record.record_id,
        title: f['事项(月份+事项)'] || '',
        teams: teams,
        month: f['月份'] || '',
        date: f['日期'] || '',
        type: f['事项类型'] || '',
        assignee: f['责任人'] || '',
        receiver: f['接收人'] || '',
        cycle: f['周期类型'] || ''
    };
}

// ===== 本地任务 转 飞书记录 =====
function taskToRecord(task) {
    return {
        fields: {
            '事项(月份+事项)': task.title || '',
            '团队': task.teams || [],
            '月份': task.month || '',
            '日期': task.date || '',
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
    var str = String(val);
    if (str.length === 8 && /^\d{8}$/.test(str)) {
        return str.substring(0, 4) + '-' + str.substring(4, 6) + '-' + str.substring(6, 8);
    }
    return String(val || '');
}

function getMonthFromDate(dateStr) {
    return dateStr ? dateStr.substring(0, 7) : '';
}

// ===== 状态更新 =====
function updateStatus(message, type) {
    var statusEl = document.getElementById('loginStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'login-status ' + type;
    }
    console.log('状态:', message);
}

// ===== 显示/隐藏加载状态 =====
function showLoading(message) {
    isLoading = true;
    var el = document.getElementById('globalLoading');
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
    var el = document.getElementById('globalLoading');
    if (el) el.style.display = 'none';
}

// ===== Toast =====
function showToast(message, type) {
    type = type || 'info';
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// ===== 演示数据 =====
function initDemoData() {
    allTasks = [
        { id: 'demo1', title: '完成Q3财务报表', teams: ['GL', 'AP'], month: '2025-06', date: '2025-06-15', type: '财务报告', assignee: '张三', receiver: '李四', cycle: '每季度' },
        { id: 'demo2', title: '供应商付款审核', teams: ['AP'], month: '2025-06', date: '2025-06-20', type: '付款审核', assignee: '王五', receiver: '赵六', cycle: '每月' },
        { id: 'demo3', title: '客户对账', teams: ['AR'], month: '2025-06', date: '2025-06-25', type: '对账', assignee: '李四', receiver: '张三', cycle: '每月' },
        { id: 'demo4', title: '库存盘点', teams: ['SCMC'], month: '2025-06', date: '2025-06-30', type: '盘点', assignee: '赵六', receiver: '王五', cycle: '每月' },
        { id: 'demo5', title: '资金计划编制', teams: ['Treasury'], month: '2025-06', date: '2025-06-10', type: '资金计划', assignee: '张三', receiver: '李四', cycle: '每月' }
    ];
}

// ===== 标签页切换 =====
function switchTab(tabName) {
    document.querySelectorAll('.tab-item').forEach(function(item) {
        item.classList.remove('active');
        if (item.dataset.tab === tabName) item.classList.add('active');
    });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    document.getElementById(tabName).classList.add('active');
    if (tabName === 'calendar' && calendarInstance) {
        setTimeout(function() { calendarInstance.updateSize(); }, 100);
    }
}

// ===== 任务总览 =====
function initOverview() { filterOverview(); }
function getSelectedTeam() { return document.getElementById('teamFilter').value; }

function filterOverview() {
    var selectedTeam = getSelectedTeam();
    var startMonth = document.getElementById('overviewStartMonth').value;
    var endMonth = document.getElementById('overviewEndMonth').value;
    var filtered = allTasks.slice();
    if (selectedTeam) filtered = filtered.filter(function(t) { return t.teams && t.teams.indexOf(selectedTeam) >= 0; });
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
    var tbody = document.getElementById('overviewTaskList');
    tbody.innerHTML = '';
    tasks.forEach(function(task) {
        var row = document.createElement('tr');
        var teamsStr = (task.teams && task.teams.length > 0) ? task.teams.join(', ') : '';
        row.innerHTML = '<td>' + (task.title || '') + '</td><td>' + teamsStr + '</td><td>' + (task.month || '') + '</td><td>' + (task.date || '') + '</td><td>' + (task.type || '') + '</td><td>' + (task.assignee || '') + '</td><td>' + (task.receiver || '') + '</td><td>' + (task.cycle || '') + '</td>';
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
    var ctx = document.getElementById('teamChart').getContext('2d');
    var teamData = {};
    tasks.forEach(function(t) { 
        if (t.teams) {
            t.teams.forEach(function(team) { 
                teamData[team] = (teamData[team] || 0) + 1; 
            }); 
        }
    });
    if (teamChartInstance) teamChartInstance.destroy();
    teamChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(teamData), datasets: [{ label: '任务数量', data: Object.values(teamData), backgroundColor: ['#3182ce', '#38a169', '#dd6b20', '#805ad5', '#e53e3e'], borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function updateCycleChart(tasks) {
    var ctx = document.getElementById('cycleChart').getContext('2d');
    var cycleData = { '每年': 0, '每半年': 0, '每季度': 0, '每月': 0, '每两周': 0, '每周': 0, '一次性': 0 };
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
    var calendarEl = document.getElementById('calendarView');
    if (!calendarEl) return;
    
    calendarEl.style.height = '650px';
    
    // 获取第一个有日期的任务作为初始日期
    var dates = allTasks.map(function(t) { return t.date; }).filter(function(d) { return d && d.length === 10; }).sort();
    var initialDate = dates.length > 0 ? dates[0] : '2025-06-01';
    
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        initialDate: initialDate,
        locale: 'zh-cn',
        firstDay: 1,
        headerToolbar: { 
            left: 'prev,next today', 
            center: 'title', 
            right: 'dayGridMonth,timeGridWeek,timeGridDay' 
        },
        events: [],
        eventDisplay: 'block',
        displayEventTime: false,
        eventClick: function(info) {
            var p = info.event.extendedProps;
            alert('事项：' + p.title + '\n团队：' + p.teams + '\n责任人：' + p.assignee + '\n接收人：' + p.receiver + '\n周期：' + p.cycle);
        }
    });
    
    calendarInstance.render();
    console.log('日历初始化完成，初始日期:', initialDate);
}

function updateCalendar() {
    if (!calendarInstance) {
        console.log('日历实例不存在，重新初始化');
        initCalendar();
        return;
    }
    
    var events = allTasks.filter(function(t) { 
        return t.date && t.date.length === 10; 
    }).map(function(task) {
        var teamsStr = (task.teams && task.teams.length > 0) ? task.teams.join('/') : '';
        return {
            id: task.id,
            title: teamsStr + ' - ' + (task.title || ''),
            start: task.date,
            allDay: true,
            color: getEventColorByTeam(task.teams),
            extendedProps: { 
                title: task.title, 
                teams: (task.teams || []).join(', '), 
                assignee: task.assignee, 
                receiver: task.receiver, 
                cycle: task.cycle 
            }
        };
    });
    
    console.log('更新日历事件:', events.length, '条');
    
    calendarInstance.removeAllEvents();
    calendarInstance.addEventSource(events);
}

function getEventColorByTeam(teams) {
    var colors = { 'AP': '#3182ce', 'AR': '#38a169', 'GL': '#dd6b20', 'SCMC': '#805ad5', 'Treasury': '#e53e3e' };
    return (teams && teams.length > 0) ? (colors[teams[0]] || '#3182ce') : '#3182ce';
}

// ===== 数据源 =====
function renderBitable() {
    var tbody = document.getElementById('bitableBody');
    tbody.innerHTML = '';

    allTasks.forEach(function(task, index) {
        var row = document.createElement('tr');
        row.dataset.id = task.id;
        var teamsStr = (task.teams && task.teams.length > 0) ? task.teams.join(', ') : '';
        row.innerHTML = '<td><span class="seq-number">' + (index + 1) + '</span></td><td><div class="cell" contenteditable="true" data-field="title" data-id="' + task.id + '">' + (task.title || '') + '</div></td><td><div class="cell-multi-select" data-field="teams" data-id="' + task.id + '">' + renderTeamMultiSelect(task.teams, task.id) + '</div></td><td><div class="cell month-display" data-field="month" data-id="' + task.id + '">' + (task.month || '') + '</div></td><td><div class="cell-select"><input type="date" data-field="date" data-id="' + task.id + '" value="' + (task.date || '') + '" onchange="onDateChange(this)" style="border:none;background:transparent;font-size:14px;padding:6px 0;width:100%;outline:none;"></div></td><td><div class="cell" contenteditable="true" data-field="type" data-id="' + task.id + '">' + (task.type || '') + '</div></td><td><div class="cell" contenteditable="true" data-field="assignee" data-id="' + task.id + '">' + (task.assignee || '') + '</div></td><td><div class="cell" contenteditable="true" data-field="receiver" data-id="' + task.id + '">' + (task.receiver || '') + '</div></td><td><div class="cell-select"><select data-field="cycle" data-id="' + task.id + '" onchange="onCellChange(this)">' + getOptionsHtml(CYCLE_OPTIONS, task.cycle) + '</select></div></td><td style="text-align:center"><button class="btn-delete" onclick="deleteTask(\'' + task.id + '\')" title="删除">🗑</button></td>';
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
    var id = element.dataset.id;
    var dateValue = element.value;
    var monthValue = getMonthFromDate(dateValue);
    var task = allTasks.find(function(t) { return t.id === id; });
    if (task) {
        task.date = dateValue;
        task.month = monthValue;
        var monthCell = element.closest('tr').querySelector('.month-display');
        if (monthCell) monthCell.textContent = monthValue;
        updateAllViews();
        updateTask(task);
    }
}

function renderTeamMultiSelect(selectedTeams, taskId) {
    var teams = selectedTeams || [];
    var displayText = teams.length > 0 ? teams.join(', ') : '<span class="placeholder">选择团队</span>';
    var html = '<div class="multi-select-dropdown" data-id="' + taskId + '"><div class="multi-select-display" onclick="toggleTeamDropdown(\'' + taskId + '\')">' + displayText + '</div><div class="multi-select-options" id="team-options-' + taskId + '">';
    TEAM_OPTIONS.forEach(function(team) {
        var isChecked = teams.indexOf(team) >= 0 ? ' checked' : '';
        html += '<label class="multi-select-option"><input type="checkbox" class="team-checkbox" value="' + team + '" data-id="' + taskId + '"' + isChecked + '><span>' + team + '</span></label>';
    });
    html += '</div></div>';
    return html;
}

function toggleTeamDropdown(taskId) {
    var dropdown = document.getElementById('team-options-' + taskId);
    document.querySelectorAll('.multi-select-options').forEach(function(d) {
        if (d.id !== 'team-options-' + taskId) d.classList.remove('show');
    });
    dropdown.classList.toggle('show');
}

function onTeamMultiSelectChange(checkbox) {
    var taskId = checkbox.dataset.id;
    var task = allTasks.find(function(t) { return t.id === taskId; });
    if (task) {
        var checked = document.querySelectorAll('.team-checkbox[data-id="' + taskId + '"]:checked');
        task.teams = Array.from(checked).map(function(cb) { return cb.value; });
        var display = checkbox.closest('.multi-select-dropdown').querySelector('.multi-select-display');
        display.innerHTML = task.teams.length > 0 ? task.teams.join(', ') : '<span class="placeholder">选择团队</span>';
        updateAllViews();
        updateTask(task);
    }
}

function getOptionsHtml(options, selectedValue) {
    var html = '<option value="">--</option>';
    options.forEach(function(opt) {
        html += '<option value="' + opt + '"' + (opt === selectedValue ? ' selected' : '') + '>' + opt + '</option>';
    });
    return html;
}

function onCellChange(element) {
    var id = element.dataset.id;
    var field = element.dataset.field;
    var value = element.value || element.textContent.trim();
    var task = allTasks.find(function(t) { return t.id === id; });
    if (task) {
        task[field] = value;
        updateAllViews();
        updateTask(task);
    }
}

async function addNewRow() {
    var newTask = { id: 'temp_' + Date.now(), title: '', month: '', date: '', type: '', assignee: '', receiver: '', cycle: '', teams: [] };
    
    var saved = await createTask(newTask);
    if (saved) {
        allTasks.push(saved);
        renderBitable();
        updateAllViews();
        showToast('已添加到飞书', 'success');
    } else {
        allTasks.push(newTask);
        renderBitable();
        updateAllViews();
        showToast('已添加（本地模式）', 'info');
    }

    setTimeout(function() {
        var tbody = document.getElementById('bitableBody');
        var lastRow = tbody.lastElementChild;
        if (lastRow) {
            lastRow.classList.add('row-new');
            lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            var firstCell = lastRow.querySelector('.cell[contenteditable]');
            if (firstCell) setTimeout(function() { firstCell.focus(); }, 100);
        }
    }, 100);
}

async function deleteTask(id) {
    if (!confirm('确定要删除这条任务吗？')) return;
    await deleteTaskFromServer(id);
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
