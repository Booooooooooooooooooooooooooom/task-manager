// ===== API 配置 =====
// 腾讯云 SCF 函数 URL
const API_BASE_URL = 'https://1439227087-fyudtqk2vo.ap-chengdu.tencentscf.com';

// ===== 飞书多维表格链接 =====
const BITABLE_URL = 'https://bytedance.feishu.cn/base/BnZIbE8xiauxKYsjef5cOw70nFc?table=tblPwyRZonL7YmLs';

// ===== 全局数据 =====
let allTasks = [];
let filteredTasks = [];
let typeChartInstance = null;
let cycleChartInstance = null;
let calendarInstance = null;
let isLoading = false;

// ===== 分页配置 =====
let currentPage = 1;
let pageSize = 20; // 默认20条

// ===== 常量定义 =====
const TEAM_OPTIONS = ['AP', 'AR', 'GL', 'OE', 'SCMC', 'Treasury'];
const CYCLE_OPTIONS = ['每季度', '每月', '每两周', '每周'];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ===== localStorage 缓存配置 =====
const CACHE_KEY = 'ssc_task_cache';
const CACHE_TIME_KEY = 'ssc_task_cache_time';
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12小时

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成');
    initApp();
});

// ===== 初始化应用 =====
async function initApp() {
    updateStatus('正在连接服务器...', 'loading');
    showLoading('正在加载数据...');

    // 尝试从缓存加载
    var cachedData = loadFromCache();
    if (cachedData) {
        allTasks = cachedData;
        console.log('从缓存加载 ' + allTasks.length + ' 条记录');
        initOverview();
        initCalendar();
        updateAllViews();
        hideLoading();
        updateStatus('已从缓存加载 ' + allTasks.length + ' 条任务', 'success');
    }

    try {
        await loadFromServer();
        initOverview();
        initCalendar();
        updateAllViews();

        // 每 12 小时自动刷新
        setInterval(function() {
            if (!isLoading) {
                silentRefresh();
            }
        }, 43200000); // 12 * 60 * 60 * 1000

    } catch (error) {
        console.error('初始化失败:', error);
        if (!cachedData) {
            updateStatus('服务器连接失败，使用演示数据', 'error');
            initDemoData();
            updateAllViews();
        } else {
            updateStatus('服务器连接失败，使用缓存数据', 'warning');
        }
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
            allTasks = data.data.map(transformRecord);
            console.log('成功加载 ' + allTasks.length + ' 条记录');
            updateStatus('已加载 ' + allTasks.length + ' 条任务', 'success');
            updateAllViews();
            showToast('已加载 ' + allTasks.length + ' 条任务', 'success');
            // 自动保存到缓存
            saveToCache(allTasks);
        } else {
            throw new Error(data.msg || '加载失败');
        }
        
    } catch (error) {
        console.error('加载失败:', error);
        throw error;
    }
}

// ===== 转换飞书记录为本任务对象 =====
function transformRecord(record) {
    const f = record.fields || {};
    return {
        id: record.record_id,
        title: extractString(f['事项(月份+事项)']),
        teams: Array.isArray(f['团队']) ? f['团队'] : (f['团队'] ? [f['团队']] : []),
        month: extractString(f['月份']),
        date: extractString(f['日期']),
        type: extractString(f['事项类型']),
        assignee: extractString(f['责任人']),
        receiver: extractString(f['接收人']),
        cycle: extractString(f['周期类型'])
    };
}

// ===== 安全提取字符串值（防止 [object Object]）=====
function extractString(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (Array.isArray(val)) return val.map(function(v) { return extractString(v); }).filter(function(v) { return v; }).join(', ');
    if (typeof val === 'object') {
        if (val.text !== undefined && val.text !== null) return String(val.text);
        if (val.value !== undefined && val.value !== null) return String(val.value);
        if (val.name !== undefined && val.name !== null) return String(val.name);
        return '';
    }
    return String(val);
}

// ===== 转换任务对象为飞书记录格式 =====
function taskToRecord(task) {
    return {
        fields: {
            '事项(月份+事项)': task.title || '',
            '团队': task.teams || [],
            '事项类型': task.type || '',
            '责任人 (人员 )': task.assignee || '',
            '接收人 (人员 )': task.receiver || '',
            '周期类型': task.cycle || ''
        }
    };
}

// ===== localStorage 缓存 =====
function saveToCache(tasks) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(tasks));
        localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
        console.log('数据已保存到缓存');
    } catch (e) {
        console.warn('缓存保存失败:', e);
    }
}

function loadFromCache() {
    try {
        var cacheTime = localStorage.getItem(CACHE_TIME_KEY);
        var cacheData = localStorage.getItem(CACHE_KEY);
        
        if (!cacheData || !cacheTime) return null;
        
        // 检查缓存是否过期
        var elapsed = Date.now() - parseInt(cacheTime);
        if (elapsed > CACHE_DURATION) {
            console.log('缓存已过期 (' + Math.round(elapsed / 3600000) + '小时前)');
            return null;
        }
        
        var tasks = JSON.parse(cacheData);
        if (Array.isArray(tasks) && tasks.length > 0) {
            console.log('缓存有效，' + Math.round(elapsed / 60000) + '分钟前保存');
            return tasks;
        }
        return null;
    } catch (e) {
        console.warn('缓存读取失败:', e);
        return null;
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
        showToast('数据已刷新并保存', 'success');
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
            return transformRecord(data.data);
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
function initOverview() { 
    currentPage = 1;
    filterOverview(); 
}
function getSelectedTeam() { return document.getElementById('teamFilter').value; }

function filterOverview() {
    var selectedTeam = getSelectedTeam();
    var startMonth = document.getElementById('overviewStartMonth').value;
    var endMonth = document.getElementById('overviewEndMonth').value;
    
    filteredTasks = allTasks.slice();
    if (selectedTeam) filteredTasks = filteredTasks.filter(function(t) { return t.teams && t.teams.indexOf(selectedTeam) >= 0; });
    if (startMonth) filteredTasks = filteredTasks.filter(function(t) { return (t.month || '') >= startMonth; });
    if (endMonth) filteredTasks = filteredTasks.filter(function(t) { return (t.month || '') <= endMonth; });
    
    currentPage = 1;
    renderOverviewTaskList();
    updateOverviewStats();
    updateCharts(filteredTasks);
}

function resetOverviewFilter() {
    document.getElementById('teamFilter').value = '';
    document.getElementById('overviewStartMonth').value = '';
    document.getElementById('overviewEndMonth').value = '';
    filterOverview();
}

// ===== 分页相关函数 =====
function changePageSize(newSize) {
    pageSize = parseInt(newSize);
    currentPage = 1;
    renderOverviewTaskList();
}

function goToPage(page) {
    var totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    currentPage = page;
    renderOverviewTaskList();
}

function updatePaginationControls() {
    var totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
    var startItem = filteredTasks.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
    var endItem = Math.min(currentPage * pageSize, filteredTasks.length);
    
    document.getElementById('paginationInfo').textContent = 
        '显示 ' + startItem + '-' + endItem + ' 条，共 ' + filteredTasks.length + ' 条';
    
    var prevBtn = document.getElementById('prevPageBtn');
    var nextBtn = document.getElementById('nextPageBtn');
    var firstBtn = document.getElementById('firstPageBtn');
    var lastBtn = document.getElementById('lastPageBtn');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (firstBtn) firstBtn.disabled = currentPage <= 1;
    if (lastBtn) lastBtn.disabled = currentPage >= totalPages;
    
    // 更新页码按钮
    var pageNumbers = document.getElementById('pageNumbers');
    if (pageNumbers) {
        pageNumbers.innerHTML = '';
        var maxButtons = 5;
        var startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        var endPage = Math.min(totalPages, startPage + maxButtons - 1);
        startPage = Math.max(1, endPage - maxButtons + 1);
        
        for (var i = startPage; i <= endPage; i++) {
            var btn = document.createElement('button');
            btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
            btn.textContent = i;
            btn.setAttribute('data-page', i);
            btn.onclick = (function(p) { return function() { goToPage(p); }; })(i);
            pageNumbers.appendChild(btn);
        }
    }
}

function renderOverviewTaskList() {
    var tbody = document.getElementById('overviewTaskList');
    tbody.innerHTML = '';
    
    var startIdx = (currentPage - 1) * pageSize;
    var endIdx = Math.min(startIdx + pageSize, filteredTasks.length);
    var pageTasks = filteredTasks.slice(startIdx, endIdx);
    
    pageTasks.forEach(function(task) {
        var row = document.createElement('tr');
        var teamsStr = (task.teams && task.teams.length > 0) ? task.teams.join(', ') : '';
        row.innerHTML = '<td>' + escapeHtml(task.title || '') + '</td><td>' + escapeHtml(teamsStr) + '</td><td>' + escapeHtml(task.month || '') + '</td><td>' + escapeHtml(task.date || '') + '</td><td>' + escapeHtml(task.type || '') + '</td><td>' + escapeHtml(task.assignee || '') + '</td><td>' + escapeHtml(task.receiver || '') + '</td><td>' + escapeHtml(task.cycle || '') + '</td>';
        tbody.appendChild(row);
    });
    
    document.getElementById('overviewCount').textContent = filteredTasks.length;
    updatePaginationControls();
}

// HTML 转义防止 XSS
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateOverviewStats() {
    document.getElementById('totalTasks').textContent = filteredTasks.length;
    document.getElementById('monthlyTasks').textContent = filteredTasks.filter(function(t) { return t.cycle === '每月'; }).length;
    document.getElementById('quarterlyTasks').textContent = filteredTasks.filter(function(t) { return t.cycle === '每季度'; }).length;
    document.getElementById('biweeklyTasks').textContent = filteredTasks.filter(function(t) { return t.cycle === '每两周'; }).length;
}

function updateCharts(tasks) { updateTypeChart(tasks); updateCycleChart(tasks); }

// 事项类型分布柱状图
function updateTypeChart(tasks) {
    var ctx = document.getElementById('typeChart').getContext('2d');
    var typeData = {};
    tasks.forEach(function(t) { 
        if (t.type) {
            typeData[t.type] = (typeData[t.type] || 0) + 1;
        }
    });
    
    var labels = Object.keys(typeData);
    var values = Object.values(typeData);
    var colors = ['#3182ce', '#38a169', '#dd6b20', '#805ad5', '#e53e3e', '#f6ad55', '#a0aec0', '#4fd1c5', '#fc8181', '#9f7aea'];
    
    if (typeChartInstance) typeChartInstance.destroy();
    typeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: labels, 
            datasets: [{ 
                label: '任务数量', 
                data: values, 
                backgroundColor: colors.slice(0, labels.length),
                borderRadius: 8 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } }
            } 
        }
    });
}

// 任务周期分布（仅显示有数据的周期）
function updateCycleChart(tasks) {
    var ctx = document.getElementById('cycleChart').getContext('2d');
    var cycleData = {};
    tasks.forEach(function(t) { 
        if (t.cycle && CYCLE_OPTIONS.indexOf(t.cycle) >= 0) {
            cycleData[t.cycle] = (cycleData[t.cycle] || 0) + 1;
        }
    });
    
    var labels = Object.keys(cycleData);
    var values = Object.values(cycleData);
    var colors = ['#3182ce', '#38a169', '#dd6b20', '#805ad5'];
    
    if (cycleChartInstance) cycleChartInstance.destroy();
    cycleChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: labels, 
            datasets: [{ 
                label: '任务数量', 
                data: values, 
                backgroundColor: colors.slice(0, labels.length),
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

// ===== 日历视图 =====
function initCalendar() {
    var calendarEl = document.getElementById('calendarView');
    if (!calendarEl) return;
    
    calendarEl.style.height = '650px';
    
    // 默认展示本月
    var today = new Date();
    var currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
    
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        initialDate: currentMonth,
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
    console.log('日历初始化完成，当前月份:', currentMonth);
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
    var colors = { 'AP': '#3182ce', 'AR': '#38a169', 'GL': '#dd6b20', 'OE': '#4fd1c5', 'SCMC': '#805ad5', 'Treasury': '#e53e3e' };
    return (teams && teams.length > 0) ? (colors[teams[0]] || '#3182ce') : '#3182ce';
}

// ===== 跳转到飞书多维表格 =====
function openBitable() {
    window.open(BITABLE_URL, '_blank');
}

// ===== 更新所有视图 =====
function updateAllViews() {
    filterOverview();
    updateCalendar();
}
