// ===== 飞书配置 =====
const FEISHU_CONFIG = {
    appId: 'cli_aa8c75fb89629bdd',
    appSecret: 'ZPiTGdPm9h8O6fJGaqwHMh2KjaMBhUVp',
    baseUrl: 'https://h03iw32mvho.feishu.cn/base/BnZIbE8xiauxKYsjef5cOw70nFc',
    tableId: 'tblPwyRZonL7YmLs'
};

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
    initFeishu();
});

// ===== 飞书初始化 =====
function initFeishu() {
    updateStatus('正在连接飞书...', 'loading');
    
    // 检查是否在飞书环境中
    if (typeof window.h5 !== 'undefined') {
        window.h5.ready(() => {
            console.log('✅ 飞书 SDK 已就绪');
            isFeishuReady = true;
            
            // 获取用户信息
            window.h5.getUserInfo({
                success: (res) => {
                    currentUser = res;
                    updateStatus(`已登录: ${res.name}`, 'success');
                    updateUserInfo(res.name);
                    initApp();
                },
                fail: (err) => {
                    console.error('❌ 获取用户信息失败:', err);
                    updateStatus('获取用户信息失败', 'error');
                    // 仍然初始化，但使用本地模式
                    initApp();
                }
            });
        });
    } else {
        console.log('⚠️ 不在飞书环境，使用演示模式');
        updateStatus('演示模式（请在飞书内打开）', 'warning');
        initApp();
    }
}

function updateStatus(message, type) {
    const statusEl = document.getElementById('loginStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'login-status ' + type;
    }
}

function updateUserInfo(name) {
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
        userInfoEl.textContent = `当前用户: ${name}`;
    }
}

async function initApp() {
    showLoading('正在加载数据...');
    
    try {
        // 尝试从飞书加载数据
        if (isFeishuReady) {
            await loadFromFeishu();
        } else {
            // 使用演示数据
            initDemoData();
        }
        
        initOverview();
        initCalendar();
        updateAllViews();
        
        // 设置自动刷新（每30秒）
        setInterval(() => {
            if (isFeishuReady && !isLoading) {
                refreshData();
            }
        }, 30000);
        
    } catch (error) {
        console.error('初始化失败:', error);
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
    let loadingEl = document.getElementById('globalLoading');
    if (!loadingEl) {
        loadingEl = document.createElement('div');
        loadingEl.id = 'globalLoading';
        loadingEl.className = 'global-loading';
        loadingEl.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
        `;
        document.body.appendChild(loadingEl);
    } else {
        loadingEl.querySelector('.loading-text').textContent = message;
        loadingEl.style.display = 'flex';
    }
}

function hideLoading() {
    isLoading = false;
    const loadingEl = document.getElementById('globalLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// ===== 从飞书加载数据 =====
async function loadFromFeishu() {
    if (!isFeishuReady) {
        alert('请在飞书环境中使用此功能');
        return;
    }

    try {
        showLoading('正在从飞书加载数据...');
        console.log('📥 开始从飞书加载数据...');
        
        // 调用飞书 API 获取记录
        const records = await fetchFeishuRecords();
        
        // 转换为本地格式
        allTasks = records.map(recordToTask);
        
        console.log(`✅ 成功加载 ${allTasks.length} 条记录`);
        updateAllViews();
        
        // 显示成功提示
        showToast(`已加载 ${allTasks.length} 条任务`);
        
    } catch (error) {
        console.error('❌ 加载失败:', error);
        showToast('加载失败: ' + error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// ===== 调用飞书 API 获取记录 =====
async function fetchFeishuRecords() {
    return new Promise((resolve, reject) => {
        // 使用飞书 JS SDK 调用 API
        // 注意：实际部署时需要通过飞书应用代理或使用云函数
        
        // 模拟数据（实际使用时替换为真实 API 调用）
        setTimeout(() => {
            resolve([
                {
                    record_id: 'rec1',
                    fields: {
                        '任务事项': '完成Q3财务报表',
                        '团队': ['GL', 'AP'],
                        '月份': '2025-06',
                        '日期': 20250615,
                        '任务类型': '财务报告',
                        '责任人': '张三',
                        '接收人': '李四',
                        '周期类型': '每季度',
                        '创建时间': '2025-06-01T10:00:00Z',
                        '创建人': 'system'
                    }
                },
                {
                    record_id: 'rec2',
                    fields: {
                        '任务事项': '供应商付款审核',
                        '团队': ['AP'],
                        '月份': '2025-06',
                        '日期': 20250620,
                        '任务类型': '付款审核',
                        '责任人': '王五',
                        '接收人': '赵六',
                        '周期类型': '每月',
                        '创建时间': '2025-06-01T10:00:00Z',
                        '创建人': 'system'
                    }
                },
                {
                    record_id: 'rec3',
                    fields: {
                        '任务事项': '客户对账',
                        '团队': ['AR'],
                        '月份': '2025-06',
                        '日期': 20250625,
                        '任务类型': '对账',
                        '责任人': '李四',
                        '接收人': '张三',
                        '周期类型': '每月',
                        '创建时间': '2025-06-01T10:00:00Z',
                        '创建人': 'system'
                    }
                },
                {
                    record_id: 'rec4',
                    fields: {
                        '任务事项': '库存盘点',
                        '团队': ['SCMC'],
                        '月份': '2025-06',
                        '日期': 20250630,
                        '任务类型': '盘点',
                        '责任人': '赵六',
                        '接收人': '王五',
                        '周期类型': '每月',
                        '创建时间': '2025-06-01T10:00:00Z',
                        '创建人': 'system'
                    }
                },
                {
                    record_id: 'rec5',
                    fields: {
                        '任务事项': '资金计划编制',
                        '团队': ['Treasury'],
                        '月份': '2025-06',
                        '日期': 20250610,
                        '任务类型': '资金计划',
                        '责任人': '张三',
                        '接收人': '李四',
                        '周期类型': '每月',
                        '创建时间': '2025-06-01T10:00:00Z',
                        '创建人': 'system'
                    }
                }
            ]);
        }, 500);
    });
}

// ===== 将飞书记录转换为任务数据 =====
function recordToTask(record) {
    const f = record.fields;
    return {
        id: record.record_id,
        title: f['任务事项'] || '',
        teams: f['团队'] || [],
        month: f['月份'] || '',
        date: f['日期'] ? String(f['日期']).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '',
        type: f['任务类型'] || '',
        assignee: f['责任人'] || '',
        receiver: f['接收人'] || '',
        cycle: f['周期类型'] || '',
        createdAt: f['创建时间'] || '',
        createdBy: f['创建人'] || '',
        lastModifiedAt: f['最后修改时间'] || '',
        lastModifiedBy: f['最后修改人'] || ''
    };
}

// ===== 将任务数据转换为飞书记录格式 =====
function taskToRecord(task) {
    return {
        fields: {
            '任务事项': task.title || '',
            '团队': task.teams || [],
            '月份': task.month || '',
            '日期': task.date ? parseInt(task.date.replace(/-/g, '')) : null,
            '任务类型': task.type || '',
            '责任人': task.assignee || '',
            '接收人': task.receiver || '',
            '周期类型': task.cycle || '',
            '创建时间': task.createdAt || new Date().toISOString(),
            '创建人': task.createdBy || (currentUser ? currentUser.name : 'unknown'),
            '最后修改时间': new Date().toISOString(),
            '最后修改人': currentUser ? currentUser.name : 'unknown'
        }
    };
}

// ===== 保存任务到飞书 =====
async function saveTaskToFeishu(task) {
    if (!isFeishuReady) return false;

    try {
        console.log('💾 保存任务到飞书:', task.title || '新任务');
        
        // 实际使用时调用飞书 API
        // await callFeishuAPI('POST', '/records', taskToRecord(task));
        
        showToast('已保存到飞书', 'success');
        return true;
    } catch (error) {
        console.error('❌ 保存失败:', error);
        showToast('保存失败: ' + error.message, 'error');
        return false;
    }
}

// ===== 更新任务到飞书 =====
async function updateTaskToFeishu(task) {
    if (!isFeishuReady || !task.id) return false;

    try {
        console.log('📝 更新任务:', task.title);
        
        // 实际使用时调用飞书 API
        // await callFeishuAPI('PUT', `/records/${task.id}`, taskToRecord(task));
        
        return true;
    } catch (error) {
        console.error('❌ 更新失败:', error);
        return false;
    }
}

// ===== 删除任务从飞书 =====
async function deleteTaskFromFeishu(taskId) {
    if (!isFeishuReady || !taskId) return false;

    try {
        console.log('🗑️ 删除任务:', taskId);
        
        // 实际使用时调用飞书 API
        // await callFeishuAPI('DELETE', `/records/${taskId}`);
        
        return true;
    } catch (error) {
        console.error('❌ 删除失败:', error);
        return false;
    }
}

// ===== 刷新数据 =====
async function refreshData() {
    try {
        console.log('🔄 自动刷新数据...');
        const records = await fetchFeishuRecords();
        const newTasks = records.map(recordToTask);
        
        // 检查是否有变化
        if (JSON.stringify(newTasks) !== JSON.stringify(allTasks)) {
            allTasks = newTasks;
            updateAllViews();
            showToast('数据已更新', 'info');
        }
    } catch (error) {
        console.error('自动刷新失败:', error);
    }
}

// ===== 初始化演示数据 =====
function initDemoData() {
    allTasks = [
        {
            id: '1',
            title: '完成Q3财务报表',
            month: '2025-06',
            date: '2025-06-15',
            type: '财务报告',
            assignee: '张三',
            receiver: '李四',
            cycle: '每季度',
            teams: ['GL', 'AP'],
            createdAt: new Date().toISOString(),
            createdBy: 'system'
        },
        {
            id: '2',
            title: '供应商付款审核',
            month: '2025-06',
            date: '2025-06-20',
            type: '付款审核',
            assignee: '王五',
            receiver: '赵六',
            cycle: '每月',
            teams: ['AP'],
            createdAt: new Date().toISOString(),
            createdBy: 'system'
        },
        {
            id: '3',
            title: '客户对账',
            month: '2025-06',
            date: '2025-06-25',
            type: '对账',
            assignee: '李四',
            receiver: '张三',
            cycle: '每月',
            teams: ['AR'],
            createdAt: new Date().toISOString(),
            createdBy: 'system'
        },
        {
            id: '4',
            title: '库存盘点',
            month: '2025-06',
            date: '2025-06-30',
            type: '盘点',
            assignee: '赵六',
            receiver: '王五',
            cycle: '每月',
            teams: ['SCMC'],
            createdAt: new Date().toISOString(),
            createdBy: 'system'
        },
        {
            id: '5',
            title: '资金计划编制',
            month: '2025-06',
            date: '2025-06-10',
            type: '资金计划',
            assignee: '张三',
            receiver: '李四',
            cycle: '每月',
            teams: ['Treasury'],
            createdAt: new Date().toISOString(),
            createdBy: 'system'
        }
    ];
}

// ===== 显示提示消息 =====
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== 标签页切换 =====
function switchTab(tabName) {
    document.querySelectorAll('.tab-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        }
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    if (tabName === 'calendar' && calendarInstance) {
        calendarInstance.updateSize();
    }
}

// ===== 第一部分：任务总览 =====
function initOverview() {
    filterOverview();
}

function getSelectedTeam() {
    return document.getElementById('teamFilter').value;
}

function filterOverview() {
    const selectedTeam = getSelectedTeam();
    const startMonth = document.getElementById('overviewStartMonth').value;
    const endMonth = document.getElementById('overviewEndMonth').value;

    let filtered = [...allTasks];

    if (selectedTeam) {
        filtered = filtered.filter(t => t.teams && t.teams.includes(selectedTeam));
    }
    if (startMonth) {
        filtered = filtered.filter(t => (t.month || '') >= startMonth);
    }
    if (endMonth) {
        filtered = filtered.filter(t => (t.month || '') <= endMonth);
    }

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

    tasks.forEach(task => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.title || ''}</td>
            <td>${task.teams ? task.teams.join(', ') : ''}</td>
            <td>${task.month || ''}</td>
            <td>${task.date || ''}</td>
            <td>${task.type || ''}</td>
            <td>${task.assignee || ''}</td>
            <td>${task.receiver || ''}</td>
            <td>${task.cycle || ''}</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('overviewCount').textContent = tasks.length;
}

function updateOverviewStats(tasks) {
    const total = tasks.length;
    const monthly = tasks.filter(t => t.cycle === '每月').length;
    const quarterly = tasks.filter(t => t.cycle === '每季度').length;
    const yearly = tasks.filter(t => t.cycle === '每年').length;

    document.getElementById('totalTasks').textContent = total;
    document.getElementById('monthlyTasks').textContent = monthly;
    document.getElementById('quarterlyTasks').textContent = quarterly;
    document.getElementById('yearlyTasks').textContent = yearly;
}

function updateCharts(tasks) {
    updateTeamChart(tasks);
    updateCycleChart(tasks);
}

function updateTeamChart(tasks) {
    const ctx = document.getElementById('teamChart').getContext('2d');
    const teamData = {};
    tasks.forEach(t => {
        if (t.teams) {
            t.teams.forEach(team => {
                teamData[team] = (teamData[team] || 0) + 1;
            });
        }
    });

    if (teamChartInstance) teamChartInstance.destroy();

    teamChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(teamData),
            datasets: [{
                label: '任务数量',
                data: Object.values(teamData),
                backgroundColor: ['#3182ce', '#38a169', '#dd6b20', '#805ad5', '#e53e3e'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function updateCycleChart(tasks) {
    const ctx = document.getElementById('cycleChart').getContext('2d');
    const cycleData = { '每年': 0, '每半年': 0, '每季度': 0, '每月': 0, '每两周': 0, '每周': 0, '一次性': 0 };
    tasks.forEach(t => {
        if (cycleData[t.cycle] !== undefined) cycleData[t.cycle]++;
    });

    if (statusChartInstance) statusChartInstance.destroy();

    statusChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(cycleData),
            datasets: [{
                label: '任务数量',
                data: Object.values(cycleData),
                backgroundColor: ['#3182ce', '#38a169', '#dd6b20', '#805ad5', '#e53e3e', '#f6ad55', '#a0aec0'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// ===== 第二部分：日历视图 =====
function initCalendar() {
    const calendarEl = document.getElementById('calendarView');
    calendarEl.style.height = '650px';

    const dates = allTasks.map(t => t.date).filter(d => d).sort();
    const initialDate = dates.length > 0 ? dates[0] : '2025-06-01';

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
            const props = info.event.extendedProps;
            alert(`事项：${props.title}\n团队：${props.teams}\n责任人：${props.assignee}\n接收人：${props.receiver}\n周期：${props.cycle}`);
        }
    });

    calendarInstance.render();
}

function updateCalendar() {
    if (!calendarInstance) return;

    const events = allTasks.filter(task => task.date).map(task => ({
        id: task.id,
        title: `${task.teams ? task.teams.join('/') : ''} - ${task.title || ''}`,
        start: task.date,
        allDay: true,
        color: getEventColorByTeam(task.teams),
        extendedProps: {
            title: task.title,
            teams: task.teams ? task.teams.join(', ') : '',
            assignee: task.assignee,
            receiver: task.receiver,
            cycle: task.cycle
        }
    }));

    calendarInstance.removeAllEvents();
    calendarInstance.addEventSource(events);
}

function getEventColorByTeam(teams) {
    const colors = { 'AP': '#3182ce', 'AR': '#38a169', 'GL': '#dd6b20', 'SCMC': '#805ad5', 'Treasury': '#e53e3e' };
    return (teams && teams.length > 0) ? colors[teams[0]] : '#3182ce';
}

function getMonthFromDate(dateStr) {
    return dateStr ? dateStr.substring(0, 7) : '';
}

// ===== 第三部分：数据源 =====
function renderBitable() {
    const tbody = document.getElementById('bitableBody');
    tbody.innerHTML = '';

    allTasks.forEach((task, index) => {
        const row = document.createElement('tr');
        row.dataset.id = task.id;

        row.innerHTML = `
            <td><span class="seq-number">${index + 1}</span></td>
            <td><div class="cell" contenteditable="true" data-field="title" data-id="${task.id}">${task.title || ''}</div></td>
            <td><div class="cell-multi-select" data-field="teams" data-id="${task.id}">${renderTeamMultiSelect(task.teams, task.id)}</div></td>
            <td><div class="cell month-display" data-field="month" data-id="${task.id}">${task.month || ''}</div></td>
            <td><div class="cell-select"><input type="date" data-field="date" data-id="${task.id}" value="${task.date || ''}" onchange="onDateChange(this)" style="border:none;background:transparent;font-size:14px;padding:6px 0;width:100%;outline:none;"></div></td>
            <td><div class="cell" contenteditable="true" data-field="type" data-id="${task.id}">${task.type || ''}</div></td>
            <td><div class="cell" contenteditable="true" data-field="assignee" data-id="${task.id}">${task.assignee || ''}</div></td>
            <td><div class="cell" contenteditable="true" data-field="receiver" data-id="${task.id}">${task.receiver || ''}</div></td>
            <td><div class="cell-select"><select data-field="cycle" data-id="${task.id}" onchange="onCellChange(this)">${getOptionsHtml(CYCLE_OPTIONS, task.cycle)}</select></div></td>
            <td style="text-align:center"><button class="btn-delete" onclick="deleteTask('${task.id}')" title="删除">🗑</button></td>
        `;

        tbody.appendChild(row);
    });

    tbody.querySelectorAll('.cell[contenteditable]').forEach(cell => {
        cell.addEventListener('blur', function() { onCellChange(this); });
    });

    tbody.querySelectorAll('.team-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() { onTeamMultiSelectChange(this); });
    });

    document.getElementById('datasourceCount').textContent = allTasks.length;
}

function onDateChange(element) {
    const id = element.dataset.id;
    const dateValue = element.value;
    const monthValue = getMonthFromDate(dateValue);

    const task = allTasks.find(t => t.id === id);
    if (task) {
        task.date = dateValue;
        task.month = monthValue;
        task.lastModifiedAt = new Date().toISOString();
        task.lastModifiedBy = currentUser ? currentUser.name : 'unknown';

        const monthCell = element.closest('tr').querySelector('.month-display');
        if (monthCell) monthCell.textContent = monthValue;

        updateAllViews();
        
        // 自动保存到飞书
        if (isFeishuReady) {
            updateTaskToFeishu(task);
        }
    }
}

function renderTeamMultiSelect(selectedTeams, taskId) {
    const teams = selectedTeams || [];
    return `
        <div class="multi-select-dropdown" data-id="${taskId}">
            <div class="multi-select-display" onclick="toggleTeamDropdown('${taskId}')">
                ${teams.length > 0 ? teams.join(', ') : '<span class="placeholder">选择团队</span>'}
            </div>
            <div class="multi-select-options" id="team-options-${taskId}">
                ${TEAM_OPTIONS.map(team => `
                    <label class="multi-select-option">
                        <input type="checkbox" class="team-checkbox" value="${team}" data-id="${taskId}" ${teams.includes(team) ? 'checked' : ''}>
                        <span>${team}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

function toggleTeamDropdown(taskId) {
    const dropdown = document.getElementById(`team-options-${taskId}`);
    document.querySelectorAll('.multi-select-options').forEach(d => {
        if (d.id !== `team-options-${taskId}`) d.classList.remove('show');
    });
    dropdown.classList.toggle('show');
}

function onTeamMultiSelectChange(checkbox) {
    const taskId = checkbox.dataset.id;
    const task = allTasks.find(t => t.id === taskId);

    if (task) {
        const checkedBoxes = document.querySelectorAll(`.team-checkbox[data-id="${taskId}"]:checked`);
        task.teams = Array.from(checkedBoxes).map(cb => cb.value);
        task.lastModifiedAt = new Date().toISOString();
        task.lastModifiedBy = currentUser ? currentUser.name : 'unknown';

        const display = checkbox.closest('.multi-select-dropdown').querySelector('.multi-select-display');
        display.innerHTML = task.teams.length > 0 ? task.teams.join(', ') : '<span class="placeholder">选择团队</span>';

        updateAllViews();
        
        // 自动保存到飞书
        if (isFeishuReady) {
            updateTaskToFeishu(task);
        }
    }
}

function getOptionsHtml(options, selectedValue) {
    return '<option value="">--</option>' + options.map(opt =>
        `<option value="${opt}" ${opt === selectedValue ? 'selected' : ''}>${opt}</option>`
    ).join('');
}

function onCellChange(element) {
    const id = element.dataset.id;
    const field = element.dataset.field;
    const value = element.value || element.textContent.trim();

    const task = allTasks.find(t => t.id === id);
    if (task) {
        task[field] = value;
        task.lastModifiedAt = new Date().toISOString();
        task.lastModifiedBy = currentUser ? currentUser.name : 'unknown';
        updateAllViews();
        
        // 自动保存到飞书
        if (isFeishuReady) {
            updateTaskToFeishu(task);
        }
    }
}

async function addNewRow() {
    const newTask = {
        id: 'temp_' + Date.now(),
        title: '',
        month: '',
        date: '',
        type: '',
        assignee: '',
        receiver: '',
        cycle: '',
        teams: [],
        createdAt: new Date().toISOString(),
        createdBy: currentUser ? currentUser.name : 'unknown'
    };

    // 如果连接到飞书，先保存到飞书
    if (isFeishuReady) {
        const saved = await saveTaskToFeishu(newTask);
        if (saved) {
            // 重新加载获取真实 ID
            await refreshData();
        }
    } else {
        allTasks.push(newTask);
        renderBitable();
        updateAllViews();
    }

    // 滚动到新行
    setTimeout(() => {
        const tbody = document.getElementById('bitableBody');
        const lastRow = tbody.lastElementChild;
        if (lastRow) {
            lastRow.classList.add('row-new');
            lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const firstCell = lastRow.querySelector('.cell[contenteditable]');
            if (firstCell) setTimeout(() => firstCell.focus(), 100);
        }
    }, 100);
}

async function deleteTask(id) {
    if (!confirm('确定要删除这条任务吗？')) return;

    // 如果连接到飞书，先从飞书删除
    if (isFeishuReady) {
        await deleteTaskFromFeishu(id);
    }

    allTasks = allTasks.filter(t => t.id !== id);
    renderBitable();
    updateAllViews();
    
    showToast('已删除', 'success');
}

function updateAllViews() {
    filterOverview();
    updateCalendar();
    renderBitable();
}
