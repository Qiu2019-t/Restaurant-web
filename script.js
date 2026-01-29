document.addEventListener('DOMContentLoaded', () => {
    // --- Shared State ---
    const STATE = {
        transactions: [],
        chartInstance: null, // For Dashboard Main Chart
        reportCharts: []     // For Report Page Charts
    };

    // --- Core Functions ---
    function init() {
        loadData();

        // Router Logic based on page presence
        if (document.getElementById('today-income') && document.getElementById('transaction-modal')) {
            initDashboard();
        } else if (document.getElementById('monthlyChart')) {
            initReport();
        }
    }

    function loadData() {
        const stored = localStorage.getItem('restaurant_transactions');
        if (stored) {
            STATE.transactions = JSON.parse(stored);
        }
    }

    function saveData() {
        localStorage.setItem('restaurant_transactions', JSON.stringify(STATE.transactions));
    }

    function formatCurrency(num) {
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: 'CNY'
        }).format(num);
    }

    // --- Dashboard Logic ---
    function initDashboard() {
        const elements = {
            todayIncome: document.getElementById('today-income'),
            todayExpense: document.getElementById('today-expense'),
            yearBalance: document.getElementById('year-balance'),
            transactionsList: document.getElementById('transactions-list'),
            modal: document.getElementById('transaction-modal'),
            addBtn: document.getElementById('add-btn'),
            closeModalBtn: document.getElementById('close-modal'),
            form: document.getElementById('transaction-form'),
            ctx: document.getElementById('mainChart').getContext('2d'),
            dateInput: document.getElementById('date'),
            typeRadios: document.querySelectorAll('input[name="type"]')
        };

        // Set Default Date
        elements.dateInput.value = new Date().toISOString().split('T')[0];

        // Render Initial View
        renderDashboard(elements);

        // Event Listeners
        elements.addBtn.addEventListener('click', () => elements.modal.classList.remove('hidden'));
        elements.closeModalBtn.addEventListener('click', () => elements.modal.classList.add('hidden'));
        elements.modal.addEventListener('click', (e) => {
            if (e.target === elements.modal) elements.modal.classList.add('hidden');
        });

        elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                id: Date.now().toString(),
                type: document.querySelector('input[name="type"]:checked').value,
                amount: document.getElementById('amount').value,
                orderId: document.getElementById('order-id').value.trim(),
                category: document.getElementById('category').value,
                date: document.getElementById('date').value,
                note: document.getElementById('note').value
            };

            STATE.transactions.unshift(formData); // Add to top
            saveData();
            elements.form.reset();
            elements.dateInput.value = new Date().toISOString().split('T')[0]; // Reset date to today
            elements.modal.classList.add('hidden');
            renderDashboard(elements);
        });

        // Expose delete globally
        window.deleteItem = function (id) {
            if (confirm('确定要删除这条记录吗？')) {
                STATE.transactions = STATE.transactions.filter(t => t.id !== id);
                saveData();
                renderDashboard(elements);
            }
        };
    }

    function renderDashboard(elements) {
        // 1. Update Summaries
        let tIncome = 0, tExpense = 0, yBalance = 0;
        const todayStr = new Date().toISOString().split('T')[0];
        const currentYear = new Date().getFullYear().toString();

        STATE.transactions.forEach(t => {
            const val = parseFloat(t.amount);
            if (t.date === todayStr) {
                t.type === 'income' ? tIncome += val : tExpense += val;
            }
            if (t.date.startsWith(currentYear)) {
                t.type === 'income' ? yBalance += val : yBalance -= val;
            }
        });

        elements.todayIncome.textContent = formatCurrency(tIncome);
        elements.todayExpense.textContent = formatCurrency(tExpense);
        elements.yearBalance.textContent = formatCurrency(yBalance);
        elements.yearBalance.style.color = yBalance >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

        // 2. Render List
        elements.transactionsList.innerHTML = '';
        if (STATE.transactions.length === 0) {
            elements.transactionsList.innerHTML = `<div class="empty-state"><i class="ri-file-list-3-line"></i><p>暂无收支记录</p></div>`;
        } else {
            STATE.transactions.slice(0, 20).forEach(t => {
                const el = document.createElement('div');
                el.className = `transaction-item ${t.type}`;
                let metaText = t.date;
                if (t.orderId) metaText += ` • #${t.orderId}`;
                if (t.note) metaText += ` • ${t.note}`;

                el.innerHTML = `
                    <div class="t-left"><span class="t-category">${t.category}</span><span class="t-date">${metaText}</span></div>
                    <div class="t-right"><span class="t-amount ${t.type === 'income' ? 'income-text' : 'expense-text'}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
                    <button class="delete-btn" onclick="deleteItem('${t.id}')"><i class="ri-delete-bin-line"></i></button></div>
                `;
                elements.transactionsList.appendChild(el);
            });
        }

        // 3. Render Chart (Last 7 Days)
        const labels = [], incData = [], expData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            labels.push(dStr.slice(5));
            let di = 0, de = 0;
            STATE.transactions.filter(t => t.date === dStr).forEach(t => t.type === 'income' ? di += parseFloat(t.amount) : de += parseFloat(t.amount));
            incData.push(di); expData.push(de);
        }

        if (STATE.chartInstance) STATE.chartInstance.destroy();
        STATE.chartInstance = new Chart(elements.ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: '收入', data: incData, backgroundColor: '#10b981', borderRadius: 4 },
                    { label: '支出', data: expData, backgroundColor: '#ef4444', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8' } } },
                plugins: { legend: { labels: { color: '#f1f5f9' } } }
            }
        });
    }

    // --- Report Page Logic ---
    function initReport() {
        const yearSelect = document.getElementById('year-select');
        const currentYear = new Date().getFullYear();

        // Populate Years (Current +/- 2)
        yearSelect.innerHTML = '';
        for (let y = currentYear + 1; y >= currentYear - 2; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y + '年';
            if (y === currentYear) opt.selected = true;
            yearSelect.appendChild(opt);
        }

        yearSelect.addEventListener('change', () => renderReport(yearSelect.value));
        renderReport(currentYear.toString());
    }

    function renderReport(year) {
        const elements = {
            totalIncome: document.getElementById('year-total-income'),
            totalExpense: document.getElementById('year-total-expense'),
            netProfit: document.getElementById('year-net-profit'),
            monthlyCtx: document.getElementById('monthlyChart').getContext('2d'),
            catCtx: document.getElementById('categoryChart').getContext('2d'),
            incCatCtx: document.getElementById('incomeCategoryChart').getContext('2d')
        };

        // Filter Data for Year
        const yearData = STATE.transactions.filter(t => t.date.startsWith(year));

        // 1. Calculate Totals
        let tIncome = 0, tExpense = 0;
        yearData.forEach(t => t.type === 'income' ? tIncome += parseFloat(t.amount) : tExpense += parseFloat(t.amount));

        elements.totalIncome.textContent = formatCurrency(tIncome);
        elements.totalExpense.textContent = formatCurrency(tExpense);
        const net = tIncome - tExpense;
        elements.netProfit.textContent = formatCurrency(net);
        elements.netProfit.style.color = net >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

        // 2. Monthly Data
        const monthlyInc = new Array(12).fill(0);
        const monthlyExp = new Array(12).fill(0);

        yearData.forEach(t => {
            const month = parseInt(t.date.split('-')[1]) - 1; // 0-11
            const val = parseFloat(t.amount);
            t.type === 'income' ? monthlyInc[month] += val : monthlyExp[month] += val;
        });

        // 3. Category Data (Expense)
        const expCats = {};
        const incCats = {};

        yearData.forEach(t => {
            const val = parseFloat(t.amount);
            if (t.type === 'expense') {
                expCats[t.category] = (expCats[t.category] || 0) + val;
            } else {
                incCats[t.category] = (incCats[t.category] || 0) + val;
            }
        });

        // --- Render Charts ---
        // Clean up old charts
        STATE.reportCharts.forEach(c => c.destroy());
        STATE.reportCharts = [];

        // Monthly Bar Chart
        STATE.reportCharts.push(new Chart(elements.monthlyCtx, {
            type: 'bar',
            data: {
                labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
                datasets: [
                    { label: '收入', data: monthlyInc, backgroundColor: '#10b981', borderRadius: 4 },
                    { label: '支出', data: monthlyExp, backgroundColor: '#ef4444', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { labels: { color: '#f1f5f9' } } }
            }
        }));

        // Expense Pie Chart
        STATE.reportCharts.push(new Chart(elements.catCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(expCats),
                datasets: [{
                    data: Object.values(expCats),
                    backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#8b5cf6', '#d946ef'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#f1f5f9' } },
                    title: { display: false }
                }
            }
        }));

        // Income Pie Chart
        STATE.reportCharts.push(new Chart(elements.incCatCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(incCats),
                datasets: [{
                    data: Object.values(incCats),
                    backgroundColor: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#f1f5f9' } },
                    title: { display: false }
                }
            }
        }));
    }

    init();
});
