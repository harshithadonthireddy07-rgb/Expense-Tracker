const API_URL = 'https://expense-tracker-backend-1-j2c9.onrender.com/api';

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) window.location.href = 'login.html';

const categoryConfig = {
    'Food':          { icon: '🍔', color: '#fb923c', class: 'cat-food' },
    'Transport':     { icon: '🚌', color: '#3b82f6', class: 'cat-transport' },
    'Books':         { icon: '📚', color: '#10b981', class: 'cat-books' },
    'Entertainment': { icon: '🎮', color: '#a855f7', class: 'cat-entertainment' },
    'Shopping':      { icon: '🛍️', color: '#ec4899', class: 'cat-shopping' },
    'Other':         { icon: '📌', color: '#94a3b8', class: 'cat-other' }
};

let expenses = [];
let filteredExpenses = [];
let budget = parseFloat(localStorage.getItem('budget')) || 0;
let categoryBudgets = {};
let pieChart = null;
let historyChart = null;
let activeTimeFilter = 'all';
let activeCategoryFilter = 'all';

window.onload = async function() {
    document.getElementById('username').textContent = user.name || 'User';
    document.getElementById('profile-name').textContent = user.name || 'User';
    document.getElementById('profile-email').textContent = user.email || '';
    document.getElementById('avatar-icon').textContent = (user.name || 'U')[0].toUpperCase();
    await loadExpenses();
    await loadCategoryBudgets();
    renderCategoryBudgetGrid();
};

// ==================
// TAB NAVIGATION
// ==================
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.querySelectorAll('.tab').forEach(t => {
        if (t.textContent.toLowerCase().includes(tabName) ||
            (tabName === 'dashboard' && t.textContent.includes('Dashboard')) ||
            (tabName === 'expenses' && t.textContent.includes('Expenses')) ||
            (tabName === 'budgets' && t.textContent.includes('Budgets')) ||
            (tabName === 'history' && t.textContent.includes('History')) ||
            (tabName === 'profile' && t.textContent.includes('Profile'))) {
            t.classList.add('active');
        }
    });
    if (tabName === 'history') loadHistory();
    if (tabName === 'profile') updateProfileStats();
}

// ==================
// LOAD EXPENSES
// ==================
async function loadExpenses() {
    try {
        const response = await fetch(`${API_URL}/expenses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401) { logout(); return; }
        expenses = await response.json();
        filteredExpenses = [...expenses];
        updateDisplay();
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

// ==================
// SET BUDGET
// ==================
function setBudget() {
    const input = document.getElementById('budget-input').value;
    if (!input || input <= 0) { alert('Please enter a valid budget!'); return; }
    budget = parseFloat(input);
    localStorage.setItem('budget', budget);
    document.getElementById('budget-input').value = '';
    updateDisplay();
}

// ==================
// ADD EXPENSE
// ==================
async function addExpense() {
    const description = document.getElementById('description').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;

    if (!description) { alert('Please enter a description!'); return; }
    if (!amount || amount <= 0) { alert('Please enter a valid amount!'); return; }

    try {
        const response = await fetch(`${API_URL}/expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ description, amount, category })
        });

        const data = await response.json();
        if (!response.ok) { alert(data.message || 'Failed to add expense!'); return; }

 expenses.unshift(data.expense);
applyFilters();
document.getElementById('description').value = '';
document.getElementById('amount').value = '';
updateDisplay();

// Check if category budget exceeded
const cat = category;
const catLimit = categoryBudgets[cat] || 0;
if (catLimit > 0) {
    const catSpent = expenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
    if (catSpent > catLimit) {
        alert(`⚠️ Warning! You have exceeded your ${cat} budget of ₹${catLimit}!\nTotal spent on ${cat}: ₹${catSpent}`);
    } else if (catSpent >= catLimit * 0.8) {
        alert(`⚡ Alert! You have used ${Math.round((catSpent/catLimit)*100)}% of your ${cat} budget!`);
    }
}
    } catch (error) {
        console.error('Error:', error);
    }
}

// ==================
// DELETE EXPENSE
// ==================
async function deleteExpense(id) {
    try {
        const response = await fetch(`${API_URL}/expenses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) { alert('Failed to delete!'); return; }
        expenses = expenses.filter(e => e._id !== id);
        applyFilters();
        updateDisplay();
    } catch (error) {
        console.error('Error:', error);
    }
}

// ==================
// CLEAR ALL
// ==================
async function clearAll() {
    if (expenses.length === 0) return;
    if (!confirm('Clear all expenses?')) return;
    for (const expense of expenses) {
        await fetch(`${API_URL}/expenses/${expense._id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }
    expenses = [];
    filteredExpenses = [];
    updateDisplay();
}

// ==================
// FILTERS
// ==================
function filterByTime(period, btn) {
    activeTimeFilter = period;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
}

function filterByCategory(category) {
    activeCategoryFilter = category;
    applyFilters();
}

function applyFilters() {
    const now = new Date();
    filteredExpenses = expenses.filter(e => {
        const date = new Date(e.date);
        let timeMatch = true;

        if (activeTimeFilter === 'today') {
            timeMatch = date.toDateString() === now.toDateString();
        } else if (activeTimeFilter === 'week') {
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            timeMatch = date >= weekAgo;
        } else if (activeTimeFilter === 'month') {
            timeMatch = date.getMonth() === now.getMonth() &&
                       date.getFullYear() === now.getFullYear();
        }

        const categoryMatch = activeCategoryFilter === 'all' || e.category === activeCategoryFilter;
        return timeMatch && categoryMatch;
    });
    updateDisplay();
}

// ==================
// CATEGORY BUDGETS
// ==================
async function loadCategoryBudgets() {
    try {
        const response = await fetch(`${API_URL}/budget`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            console.log('Budget data from server:', data);
            categoryBudgets = {
    Food: data.categoryBudgets?.Food || 0,
    Transport: data.categoryBudgets?.Transport || 0,
    Books: data.categoryBudgets?.Books || 0,
    Entertainment: data.categoryBudgets?.Entertainment || 0,
    Shopping: data.categoryBudgets?.Shopping || 0,
    Other: data.categoryBudgets?.Other || 0
};
            if (data.monthlyBudget > 0) {
                budget = data.monthlyBudget;
                localStorage.setItem('budget', budget);
            }
        }
    } catch (error) {
        console.error('Error loading budgets:', error);
    }
}

async function saveCategoryBudgets() {
    const categories = ['Food', 'Transport', 'Books', 'Entertainment', 'Shopping', 'Other'];
    const newCategoryBudgets = {};

    categories.forEach(cat => {
        const input = document.getElementById(`cat-budget-${cat}`);
        newCategoryBudgets[cat] = parseFloat(input?.value) || 0;
    });

    try {
        const response = await fetch(`${API_URL}/budget`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                monthlyBudget: budget,
                categoryBudgets: newCategoryBudgets
            })
        });

        if (response.ok) {
            categoryBudgets = newCategoryBudgets;
            alert('✅ Budgets saved successfully!');
            renderCategoryBudgetGrid();
        }
    } catch (error) {
        console.error('Error saving budgets:', error);
    }
}

function renderCategoryBudgetGrid() {
    const categories = [
        { name: 'Food', icon: '🍔', color: '#fb923c' },
        { name: 'Transport', icon: '🚌', color: '#3b82f6' },
        { name: 'Books', icon: '📚', color: '#10b981' },
        { name: 'Entertainment', icon: '🎮', color: '#a855f7' },
        { name: 'Shopping', icon: '🛍️', color: '#ec4899' },
        { name: 'Other', icon: '📌', color: '#94a3b8' }
    ];

    const grid = document.getElementById('cat-budget-grid');
    if (!grid) return;

    grid.innerHTML = categories.map(cat => {
        const spent = expenses
            .filter(e => e.category === cat.name)
            .reduce((sum, e) => sum + e.amount, 0);
        const limit = categoryBudgets[cat.name] || 0;
        const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
        const color = percent >= 100 ? '#ef4444' : percent >= 70 ? '#f59e0b' : cat.color;

        return `
            <div class="cat-budget-item">
                <div class="cat-budget-label">
                    ${cat.icon} ${cat.name}
                </div>
                <input type="number"
                    id="cat-budget-${cat.name}"
                    placeholder="Set limit..."
                    value="${limit > 0 ? limit : ''}" />
                <div style="color: #475569; font-size: 11px; margin-top: 6px;">
                    Spent: ₹${spent.toLocaleString('en-IN')} ${limit > 0 ? `/ ₹${limit.toLocaleString('en-IN')}` : ''}
                </div>
                ${limit > 0 ? `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percent}%; background: ${color};"></div>
                </div>` : ''}
            </div>
        `;
    }).join('');
}

// ==================
// HISTORY CHART
// ==================
async function loadHistory() {
    try {
        const response = await fetch(`${API_URL}/budget/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return;

        const history = await response.json();

        if (history.length === 0) {
            document.getElementById('no-history-data').style.display = 'block';
            return;
        }

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const labels = history.map(h => `${monthNames[h._id.month - 1]} ${h._id.year}`);
        const data = history.map(h => h.total);

        if (historyChart) historyChart.destroy();

        const ctx = document.getElementById('history-chart').getContext('2d');
        historyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Total Spent (₹)',
                    data,
                    backgroundColor: 'rgba(124, 58, 237, 0.5)',
                    borderColor: '#7c3aed',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#94a3b8' } }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });

    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// ==================
// PROFILE STATS
// ==================
function updateProfileStats() {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const count = expenses.length;
    const avg = count > 0 ? total / count : 0;

    document.getElementById('stat-total').textContent = '₹' + total.toLocaleString('en-IN');
    document.getElementById('stat-count').textContent = count;
    document.getElementById('stat-avg').textContent = '₹' + Math.round(avg).toLocaleString('en-IN');
}

// ==================
// LOGOUT
// ==================
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// ==================
// UPDATE DISPLAY
// ==================
function getTotalSpent() {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
}

function updateDisplay() {
    const totalSpent = getTotalSpent();
    const remaining = budget - totalSpent;

    document.getElementById('budget-display').textContent = '₹' + budget.toLocaleString('en-IN');
    document.getElementById('total-spent').textContent = '₹' + totalSpent.toLocaleString('en-IN');

    const remainingEl = document.getElementById('remaining');
    remainingEl.textContent = '₹' + Math.abs(remaining).toLocaleString('en-IN') +
                              (remaining < 0 ? ' over' : '');
    remainingEl.className = 'summary-value';
    if (budget > 0) {
        const percent = totalSpent / budget;
        if (percent < 0.7) remainingEl.classList.add('remaining-safe');
        else if (percent < 1) remainingEl.classList.add('remaining-warning');
        else remainingEl.classList.add('remaining-danger');
    }

    const alertEl = document.getElementById('alert');
    alertEl.style.display = (budget > 0 && totalSpent > budget) ? 'block' : 'none';

    updateExpenseList();
    updateDashboardList();
    updateChart();
    renderCategoryBudgetGrid();
}

function updateExpenseList() {
    const listEl = document.getElementById('expense-list');
    if (!listEl) return;

    if (filteredExpenses.length === 0) {
        listEl.innerHTML = '<p class="no-data">No expenses found!</p>';
        return;
    }

    listEl.innerHTML = filteredExpenses.map(expense => {
        const config = categoryConfig[expense.category];
        const date = new Date(expense.date).toLocaleDateString('en-IN');
        return `
            <div class="expense-item">
                <div class="expense-left">
                    <div class="expense-icon ${config.class}">${config.icon}</div>
                    <div>
                        <div class="expense-desc">${expense.description}</div>
                        <div class="expense-cat">${expense.category} • ${date}</div>
                    </div>
                </div>
                <div class="expense-right">
                    <div class="expense-amount">₹${expense.amount.toLocaleString('en-IN')}</div>
                    <button class="delete-btn" onclick="deleteExpense('${expense._id}')">✕</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateDashboardList() {
    const listEl = document.getElementById('expense-list-dashboard');
    if (!listEl) return;

    const recent = expenses.slice(0, 5);
    if (recent.length === 0) {
        listEl.innerHTML = '<p class="no-data">No expenses yet!</p>';
        return;
    }

    listEl.innerHTML = recent.map(expense => {
        const config = categoryConfig[expense.category];
        const date = new Date(expense.date).toLocaleDateString('en-IN');
        return `
            <div class="expense-item">
                <div class="expense-left">
                    <div class="expense-icon ${config.class}">${config.icon}</div>
                    <div>
                        <div class="expense-desc">${expense.description}</div>
                        <div class="expense-cat">${expense.category} • ${date}</div>
                    </div>
                </div>
                <div class="expense-right">
                    <div class="expense-amount">₹${expense.amount.toLocaleString('en-IN')}</div>
                    <button class="delete-btn" onclick="deleteExpense('${expense._id}')">✕</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateChart() {
    const noDataEl = document.getElementById('no-chart-data');
    if (expenses.length === 0) {
        if (noDataEl) noDataEl.style.display = 'block';
        if (pieChart) { pieChart.destroy(); pieChart = null; }
        return;
    }

    if (noDataEl) noDataEl.style.display = 'none';

    const categoryTotals = {};
    expenses.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const colors = labels.map(l => categoryConfig[l].color);

    if (pieChart) pieChart.destroy();

    const ctx = document.getElementById('pie-chart').getContext('2d');
    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.map(c => c + '99'),
                borderColor: colors,
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', padding: 12, font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => ' ₹' + context.parsed.toLocaleString('en-IN')
                    }
                }
            },
            cutout: '65%'
        }
    });
}