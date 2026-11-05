// js/ui.js - Handles DOM rendering for both roles

export function renderApp(bankData, sessionState) {
    const adminView = document.getElementById('admin-view');
    const memberView = document.getElementById('member-view');
    
    const btnAdmin = document.getElementById('btn-role-admin');
    const btnMember = document.getElementById('btn-role-member');

    if (sessionState.role === "admin") {
        adminView.style.display = "block";
        memberView.style.display = "none";
        btnAdmin.classList.add("active-role");
        btnMember.classList.remove("active-role");
        
        renderAdminDashboard(bankData);
    } else {
        adminView.style.display = "none";
        memberView.style.display = "block";
        btnMember.classList.add("active-role");
        btnAdmin.classList.remove("active-role");

        renderMemberPortal(bankData, sessionState.currentMemberName);
    }
}

function renderAdminDashboard(bankData) {
    const tableBody = document.getElementById('ledger-table-body');
    tableBody.innerHTML = '';

    let totalSavingsCalc = 0;
    let totalLoansCalc = 0;
    let overdueCount = 0;

    bankData.members.forEach(member => {
        totalSavingsCalc += member.savings;
        totalLoansCalc += member.loan.balanceRemaining;

        if (member.loan.status === "Overdue") {
            overdueCount++;
        }

        let badgeClass = "badge-none";
        if (member.loan.status === "Active") badgeClass = "badge-active";
        if (member.loan.status === "Overdue") badgeClass = "badge-overdue";

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${member.name}</strong></td>
            <td>$${member.savings}</td>
            <td>$${member.loan.balanceRemaining}</td>
            <td><span class="badge ${badgeClass}">${member.loan.status}</span></td>
            <td><button class="btn-sm view-profile-btn" data-name="${member.name}">View Account</button></td>
        `;
        tableBody.appendChild(row);
    });

    // Update Top Overview Metric Cards
    document.getElementById('total-savings').textContent = `$${totalSavingsCalc}`;
    document.getElementById('total-loans').textContent = `$${totalLoansCalc}`;
    document.getElementById('total-pool').textContent = `$${totalSavingsCalc}`;

    // Update Meeting Financial Report Card Metrics
    document.getElementById('report-member-count').textContent = bankData.members.length;
    document.getElementById('report-total-savings').textContent = `$${totalSavingsCalc}`;
    document.getElementById('report-total-loans').textContent = `$${totalLoansCalc}`;
    document.getElementById('report-overdue-count').textContent = overdueCount;
}

function renderMemberPortal(bankData, currentName) {
    const selector = document.getElementById('member-selector');
    selector.innerHTML = '';

    // Populate dropdown with all member names
    bankData.members.forEach(m => {
        const option = document.createElement('option');
        option.value = m.name;
        option.textContent = m.name;
        if (m.name.toLowerCase() === currentName.toLowerCase()) {
            option.selected = true;
        }
        selector.appendChild(option);
    });

    const member = bankData.members.find(m => m.name.toLowerCase() === currentName.toLowerCase());
    if (!member) return;

    // Populate Savings & Loan Financial Standing
    document.getElementById('portal-savings').textContent = `$${member.savings}`;
    document.getElementById('portal-loan-principal').textContent = `$${member.loan.principal || 0}`;
    document.getElementById('portal-loan-total').textContent = `$${member.loan.totalDue || 0} (${member.loan.interestRate || 0}% ${member.loan.interestType || 'simple'} interest)`;
    document.getElementById('portal-loan-paid').textContent = `$${member.loan.amountPaid || 0}`;
    document.getElementById('portal-loan-balance').textContent = `$${member.loan.balanceRemaining || 0}`;
    
    document.getElementById('portal-due-date').textContent = member.loan.dueDate || "No active due date";
    
    const statusEl = document.getElementById('portal-status');
    statusEl.textContent = member.loan.status;
    statusEl.className = `badge ${member.loan.status === 'Active' ? 'badge-active' : member.loan.status === 'Overdue' ? 'badge-overdue' : 'badge-none'}`;

    // Populate Transaction History
    const historyList = document.getElementById('portal-history-list');
    historyList.innerHTML = '';
    if (member.history.length === 0) {
        historyList.innerHTML = '<li>No recorded transactions.</li>';
    } else {
        member.history.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `[${item.date}] ${item.type}: $${item.amount}`;
            historyList.appendChild(li);
        });
    }
}
export function showProfileModal(memberName, bankData) {
    const member = bankData.members.find(m => m.name.toLowerCase() === memberName.toLowerCase());
    if (!member) return;

    document.getElementById('profile-name').textContent = `${member.name}'s Account Profile`;
    document.getElementById('profile-savings').textContent = `$${member.savings}`;
    
    // Detailed Loan breakdown in modal
    document.getElementById('profile-loan-amount').textContent = `$${member.loan.balanceRemaining} (Principal: $${member.loan.principal} + ${member.loan.interestRate}% ${member.loan.interestType} interest - Paid: $${member.loan.amountPaid})`;
    document.getElementById('profile-due-date').textContent = member.loan.dueDate || "No active due date";
    
    const statusEl = document.getElementById('profile-status');
    statusEl.textContent = member.loan.status;
    statusEl.className = `badge ${member.loan.status === 'Active' ? 'badge-active' : member.loan.status === 'Overdue' ? 'badge-overdue' : 'badge-none'}`;

    const historyList = document.getElementById('profile-history-list');
    historyList.innerHTML = '';
    if (member.history.length === 0) {
        historyList.innerHTML = '<li>No recorded transactions.</li>';
    } else {
        member.history.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `[${item.date}] ${item.type}: $${item.amount}`;
            historyList.appendChild(li);
        });
    }

    document.getElementById('profile-modal').style.display = 'flex';
}

export function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}