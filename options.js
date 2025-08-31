// File: options.js (Fully Internationalized)

// --- ELEMENT SELECTORS ---
const speedStepInput = document.getElementById('speed-step-input');
const skipAmountInput = document.getElementById('skip-amount-input'); // New
const ruleForm = document.getElementById('add-rule-form');
const hostnameInput = document.getElementById('hostname-input');
const speedInput = document.getElementById('speed-input');
const rulesList = document.getElementById('rules-list');
const exclusionForm = document.getElementById('add-exclusion-form');
const exclusionInput = document.getElementById('exclusion-input');
const excludedSitesList = document.getElementById('excluded-sites-list');
const statusMessage = document.getElementById('status-message');
const resetAllButton = document.getElementById('reset-all-settings');

// --- GENERAL FUNCTIONS ---
const showStatus = (message) => {
    statusMessage.textContent = message;
    statusMessage.style.opacity = '1';
    setTimeout(() => { statusMessage.style.opacity = '0'; }, 2000);
};

// --- BEHAVIOR FUNCTIONS ---
const loadSpeedStep = async () => {
    const data = await chrome.storage.sync.get(['speedStep']);
    speedStepInput.value = data.speedStep || 0.10;
};

const loadSkipAmount = async () => {
    const data = await chrome.storage.sync.get(['skipAmount']);
    skipAmountInput.value = data.skipAmount || 5;
};
// --- RULE MANAGEMENT FUNCTIONS ---
const renderRule = (hostname, speed) => {
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'rule';
    ruleDiv.innerHTML = `
        <div>
            <span class="hostname">${hostname}</span>
            <span>&rarr; ${speed}x</span>
        </div>
        <button class="delete-btn" data-hostname="${hostname}">${chrome.i18n.getMessage("deleteButton")}</button>
    `;
    rulesList.appendChild(ruleDiv);
    ruleDiv.querySelector('.delete-btn').addEventListener('click', () => deleteRule(hostname));
};

const loadRules = async () => {
    rulesList.innerHTML = '';
    const data = await chrome.storage.sync.get(['siteRules']);
    const siteRules = data.siteRules || {};
    for (const hostname in siteRules) {
        renderRule(hostname, siteRules[hostname]);
    }
};

const deleteRule = async (hostname) => {
    const data = await chrome.storage.sync.get(['siteRules']);
    let siteRules = data.siteRules || {};
    delete siteRules[hostname];
    await chrome.storage.sync.set({ siteRules });
    await loadRules();
    showStatus(chrome.i18n.getMessage("statusRuleDeleted"));
};

// --- EXCLUSION MANAGEMENT FUNCTIONS ---
const renderExcludedSite = (hostname) => {
    const siteDiv = document.createElement('div');
    siteDiv.className = 'rule';
    siteDiv.innerHTML = `
        <span class="hostname">${hostname}</span>
        <button class="delete-btn" data-hostname="${hostname}">${chrome.i18n.getMessage("removeButton")}</button>
    `;
    excludedSitesList.appendChild(siteDiv);
    siteDiv.querySelector('.delete-btn').addEventListener('click', () => deleteExcludedSite(hostname));
};

const loadExcludedSites = async () => {
    excludedSitesList.innerHTML = '';
    const data = await chrome.storage.sync.get(['excludedSites']);
    const sites = data.excludedSites || [];
    sites.forEach(site => renderExcludedSite(site));
};

const deleteExcludedSite = async (hostname) => {
    const data = await chrome.storage.sync.get(['excludedSites']);
    let sites = data.excludedSites || [];
    sites = sites.filter(site => site !== hostname);
    await chrome.storage.sync.set({ excludedSites: sites });
    await loadExcludedSites();
    showStatus(chrome.i18n.getMessage("statusSiteRemoved"));
};

// --- EVENT LISTENERS ---
speedStepInput.addEventListener('change', async () => {
    const newStep = parseFloat(speedStepInput.value);
    if (newStep && newStep > 0) {
        await chrome.storage.sync.set({ speedStep: newStep });
        showStatus(chrome.i18n.getMessage("statusSaved"));
    }
});

skipAmountInput.addEventListener('change', async () => {
    const newAmount = parseInt(skipAmountInput.value, 10);
    if (newAmount && newAmount > 0) {
        await chrome.storage.sync.set({ skipAmount: newAmount });
        showStatus(chrome.i18n.getMessage("statusSaved"));
    }
});

ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hostname = hostnameInput.value.trim();
    const speed = parseFloat(speedInput.value);
    if (!hostname || !speed) {
        showStatus(chrome.i18n.getMessage("statusFillFields"));
        return;
    }
    const data = await chrome.storage.sync.get(['siteRules']);
    let siteRules = data.siteRules || {};
    siteRules[hostname] = speed;
    await chrome.storage.sync.set({ siteRules });
    await loadRules();
    showStatus(chrome.i18n.getMessage("statusSaved"));
    ruleForm.reset();
});

exclusionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hostname = exclusionInput.value.trim();
    if (!hostname) return;
    const data = await chrome.storage.sync.get(['excludedSites']);
    let sites = data.excludedSites || [];
    if (sites.includes(hostname)) {
        showStatus(chrome.i18n.getMessage("statusAlreadyExcluded"));
        return;
    }
    sites.push(hostname);
    await chrome.storage.sync.set({ excludedSites: sites });
    await loadExcludedSites();
    showStatus(chrome.i18n.getMessage("statusSiteExcluded"));
    exclusionForm.reset();
});

resetAllButton.addEventListener('click', () => {
    if (confirm(chrome.i18n.getMessage("confirmResetAll"))) {
        chrome.storage.sync.clear(() => {
            loadRules();
            loadExcludedSites();
            loadSpeedStep();
            showStatus(chrome.i18n.getMessage("statusAllReset"));
            console.log('All settings cleared.');
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadSpeedStep();
    loadRules();
    loadExcludedSites();
    loadSkipAmount();
});