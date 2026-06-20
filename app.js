// Store all expenses and budget
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let budget = parseFloat(localStorage.getItem('budget')) || 0;

// Category icons and colors
const categoryConfig = {
    'Food':          { icon: '🍔', color: '#fb923c', class: 'cat-food' },
    'Transport':     { icon: '🚌', color: '#3b82f6', class: 'cat-transport' },
    'Books':         { icon: '📚', color: '#10b981', class: 'cat-books' },
    'Entertainment': { icon: '🎮', color: '#a855f7', class: 'cat-entertainment' },
    'Shopping':      { icon: '🛍️', color: '#ec4899', class: 'cat-shopping' },
    'Other':         { icon: '📌', color: '#94a3b8', class: 'cat-other' }
};

let pieChart = null;

// Run when page loads
window.onload = function() {
    updateDisplay();
};

// Set monthly budget
function setBudget() {
    const input = document.getElementById('budget-input').value;
    if (!input || input <= 0) {
        alert('Please enter a valid budget amount!');
        return;
    }
    budget = parseFloat(input);
    localStorage.setItem('budget', budget);
    document.getElementById('budget-input').value = '';
    updateDisplay();
}

// Add new expense
function addExpense() {
    const description = document.getElementById('description').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;

    // Validation
    if (!description) {
        alert('Please enter a description!');
        return;
    }
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount!');
        return;
    }

    // Create expense object
    const expense = {
        id: Date.now(),
        description: description,
        amount: amount,
        category: category,
        date: new Date().toLocaleDateString('en-IN')
    };

    // Add to array and save
    expenses.push(expense);
    localStorage.setItem('expenses', JSON.stringify(expenses));

    // Clear inputs
    document.getElementById('description').value = '';
    document.getElementById('amount').value = '';

    // Update display
    updateDisplay();
}

// Delete single expense
function deleteExpense(id) {
    expenses = expenses.filter(e => e.id !== id);
    localStorage.setItem('expenses', JSON.stringify(expenses));
    updateDisplay();
}

// Clear all expenses
function clearAll() {
    if (expenses.length === 0) return;
    if (confirm('Are you sure you want to clear all expenses?')) {
        expenses = [];
        localStorage.setItem('expenses', JSON.stringify(expenses));
        updateDisplay();
    }
}

// Calculate total spent
function getTotalSpent() {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
}

// Update everything on screen
function updateDisplay() {
    const totalSpent = getTotalSpent();
    const remaining = budget - totalSpent;

    // Update budget display
    document.getElementById('budget-display').textContent = '₹' + budget.toLocaleString('en-IN');

    // Update total spent
    document.getElementById('total-spent').textContent = '₹' + totalSpent.toLocaleString('en-IN');

    // Update remaining with color
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

    // Show/hide alert
    const alert = document.getElementById('alert');
    if (budget > 0 && totalSpent > budget) {
        alert.style.display = 'block';
    } else {
        alert.style.display = 'none';
    }

    // Update expense list
    updateExpenseList();

    // Update pie chart
    updateChart();
}

// Update expense list
function updateExpenseList() {
    const listEl = document.getElementById('expense-list');

    if (expenses.length === 0) {
        listEl.innerHTML = '<p class="no-data">No expenses yet. Add one above!</p>';
        return;
    }

    // Show newest first
    const sorted = [...expenses].reverse();

    listEl.innerHTML = sorted.map(expense => {
        const config = categoryConfig[expense.category];
        return `
            <div class="expense-item">
                <div class="expense-left">
                    <div class="expense-icon ${config.class}">
                        ${config.icon}
                    </div>
                    <div>
                        <div class="expense-desc">${expense.description}</div>
                        <div class="expense-cat">${expense.category} • ${expense.date}</div>
                    </div>
                </div>
                <div class="expense-right">
                    <div class="expense-amount">₹${expense.amount.toLocaleString('en-IN')}</div>
                    <button class="delete-btn" onclick="deleteExpense(${expense.id})">✕</button>
                </div>
            </div>
        `;
    }).join('');
}

// Update pie chart
function updateChart() {
    const noDataEl = document.getElementById('no-chart-data');

    if (expenses.length === 0) {
        noDataEl.style.display = 'block';
        if (pieChart) {
            pieChart.destroy();
            pieChart = null;
        }
        return;
    }

    noDataEl.style.display = 'none';

    // Group expenses by category
    const categoryTotals = {};
    expenses.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const colors = labels.map(l => categoryConfig[l].color);

    // Destroy old chart
    if (pieChart) {
        pieChart.destroy();
    }

    // Create new chart
    const ctx = document.getElementById('pie-chart').getContext('2d');
    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
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
                    labels: {
                        color: '#94a3b8',
                        padding: 12,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ' ₹' + context.parsed.toLocaleString('en-IN');
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}