// =============================================================================
//  BookMyDoctor — api.js
//  Foundation file — include in every HTML page
//  Author : BookMyDoctor Team
//  Version: 1.0
// =============================================================================

// -----------------------------------------------------------------------------
//  Configuration
// -----------------------------------------------------------------------------
const BMD_CONFIG = {
    BASE_URL      : 'https://oracleapex.com/ords/praveen_9898/BMD_APP/',
    RAZORPAY_KEY  : 'rzp_test_T0D2rGD0MsFXyZ',
    APP_NAME      : 'BookMyDoctor',
    CURRENCY      : 'INR',
    SESSION_EXPIRY: 24  // hours
};


// =============================================================================
//  CORE API CALLER
// =============================================================================

async function callBMD(endpoint, payload) {
    try {
        showLoader();

        const res = await fetch(BMD_CONFIG.BASE_URL + endpoint, {
            method  : 'POST',
            headers : { 'Content-Type': 'application/json' },
            body    : JSON.stringify(payload)
        });

        if (!res.ok) {
            hideLoader();
            return {
                status  : 'ERROR',
                message : 'Server error: ' + res.status + '. Please try again.'
            };
        }

        const raw  = await res.json();
        const data = JSON.parse(raw.p_message || raw.p_result);

        hideLoader();
        return data;

    } catch (err) {
        hideLoader();
        if (err.name === 'SyntaxError') {
            return { status: 'ERROR', message: 'Invalid response from server.' };
        }
        return { status: 'ERROR', message: 'Network error. Please check your connection.' };
    }
}


// =============================================================================
//  SESSION MANAGEMENT
// =============================================================================

function saveSession(data) {
    localStorage.setItem('bmd_token',     data.session_token);
    localStorage.setItem('bmd_user_type', data.user_type);
    localStorage.setItem('bmd_user_id',   data.user_id);
    localStorage.setItem('bmd_name',      data.full_name);
    localStorage.setItem('bmd_login_time',new Date().getTime());
}

function getSession() {
    return {
        token     : localStorage.getItem('bmd_token'),
        user_type : localStorage.getItem('bmd_user_type'),
        user_id   : localStorage.getItem('bmd_user_id'),
        name      : localStorage.getItem('bmd_name')
    };
}

function clearSession() {
    localStorage.removeItem('bmd_token');
    localStorage.removeItem('bmd_user_type');
    localStorage.removeItem('bmd_user_id');
    localStorage.removeItem('bmd_name');
    localStorage.removeItem('bmd_login_time');
}

function isLoggedIn() {
    const token = localStorage.getItem('bmd_token');
    return token !== null && token !== '';
}

// Redirect to login if not logged in
// expected_type = 'PATIENT' or 'DOCTOR' or 'ADMIN' or null (any)
function requireLogin(expected_type) {
    const s = getSession();

    if (!s.token) {
        window.location.href = getLoginPage();
        return false;
    }

    if (expected_type && s.user_type !== expected_type) {
        window.location.href = getLoginPage();
        return false;
    }

    return true;
}

function getLoginPage() {
    const s = getSession();
    if (s.user_type === 'DOCTOR') return '../doctor/login.html';
    if (s.user_type === 'ADMIN')  return '../admin/login.html';
    return '../patient/login.html';
}

// Logout function
async function logout() {
    const s = getSession();
    if (s.token) {
        await callBMD('logout', { session_token: s.token });
    }
    clearSession();
    window.location.href = '../index.html';
}


// =============================================================================
//  LOOKUP HELPER
//  Populates any dropdown from BMD_LOOKUPS_T
// =============================================================================

async function loadLookup(lookup_type, selectId, placeholder, selectedValue) {
    const res = await callBMD('get-lookups', { lookup_type });
    const sel = document.getElementById(selectId);
    if (!sel) return;

    sel.innerHTML = '<option value="">' + (placeholder || 'Select...') + '</option>';

    if (res.status === 'SUCCESS') {
        res.lookups.forEach(l => {
            const opt       = document.createElement('option');
            opt.value       = l.code;
            opt.textContent = l.meaning;
            if (selectedValue && l.code === selectedValue) {
                opt.selected = true;
            }
            sel.appendChild(opt);
        });
    }
}

// Load multiple lookups at once
async function loadLookups(lookupMap) {
    // lookupMap = { 'BMD_GENDER': { id: 'gender_select', placeholder: 'Select Gender' } }
    const promises = Object.entries(lookupMap).map(([type, config]) =>
        loadLookup(type, config.id, config.placeholder, config.selected)
    );
    await Promise.all(promises);
}


// =============================================================================
//  PAYMENT — RAZORPAY
// =============================================================================

async function initiatePayment(appointment_id, onSuccess, onFailure) {
    const session = getSession();

    // Step 1 -- Create payment record
    const paymentRes = await callBMD('create-payment', {
        session_token  : session.token,
        appointment_id : appointment_id,
        payment_mode   : 'UPI',
        gateway_name   : 'RAZORPAY'
    });

    if (paymentRes.status !== 'SUCCESS') {
        // Check if payment already exists
        if (paymentRes.existing_payment_id) {
            showError('Payment already initiated. Please complete or retry.');
        } else {
            showError(paymentRes.message);
        }
        if (onFailure) onFailure(paymentRes);
        return;
    }

    const payment_id = paymentRes.payment_id;
    const amount     = paymentRes.amount;

    // Step 2 -- Open Razorpay popup
    const options = {
        key         : BMD_CONFIG.RAZORPAY_KEY,
        amount      : amount * 100,  // Razorpay needs paise
        currency    : BMD_CONFIG.CURRENCY,
        name        : BMD_CONFIG.APP_NAME,
        description : 'Consultation Fee',

        prefill : {
            name    : session.name,
            email   : '',
            contact : ''
        },

        theme : { color : '#00688C' },

        // Payment SUCCESS
        handler : async function(response) {
            const updateRes = await callBMD('update-payment-status', {
                session_token   : session.token,
                payment_id      : payment_id,
                payment_status  : 'SUCCESS',
                gateway_txn_id  : response.razorpay_payment_id,
                payment_mode    : 'UPI'
            });

            if (updateRes.status === 'SUCCESS') {
                // Create settlement record
                await callBMD('create-settlement', {
                    session_token : session.token,
                    payment_id    : payment_id
                });

                if (onSuccess) onSuccess({
                    payment_id     : payment_id,
                    amount         : amount,
                    txn_id         : response.razorpay_payment_id
                });
            } else {
                showError('Payment received but confirmation failed. Contact support.');
            }
        },

        // Popup closed without paying
        modal : {
            ondismiss : async function() {
                await callBMD('update-payment-status', {
                    session_token  : session.token,
                    payment_id     : payment_id,
                    payment_status : 'FAILED',
                    gateway_txn_id : 'DISMISSED'
                });
                if (onFailure) onFailure({ message: 'Payment cancelled' });
            }
        }
    };

    const rzp = new Razorpay(options);

    rzp.on('payment.failed', async function(response) {
        await callBMD('update-payment-status', {
            session_token  : session.token,
            payment_id     : payment_id,
            payment_status : 'FAILED',
            gateway_txn_id : response.error.metadata.payment_id || 'FAILED'
        });
        showError('Payment failed: ' + response.error.description);
        if (onFailure) onFailure(response.error);
    });

    rzp.open();
}


// =============================================================================
//  UI HELPERS
// =============================================================================

// Loading spinner
function showLoader() {
    const loader = document.getElementById('bmd-loader');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('bmd-loader');
    if (loader) loader.style.display = 'none';
}

// Toast notifications
function showSuccess(message, duration) {
    showToast(message, 'success', duration || 3000);
}

function showError(message, duration) {
    showToast(message, 'error', duration || 4000);
}

function showInfo(message, duration) {
    showToast(message, 'info', duration || 3000);
}

function showToast(message, type, duration) {
    // Remove existing toast
    const existing = document.getElementById('bmd-toast');
    if (existing) existing.remove();

    const colors = {
        success : '#28a745',
        error   : '#dc3545',
        info    : '#00688C'
    };

    const icons = {
        success : '✅',
        error   : '❌',
        info    : 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.id = 'bmd-toast';
    toast.style.cssText = `
        position   : fixed;
        bottom     : 24px;
        right      : 24px;
        background : ${colors[type]};
        color      : #fff;
        padding    : 14px 20px;
        border-radius : 8px;
        font-size  : 14px;
        font-family: Arial, sans-serif;
        box-shadow : 0 4px 12px rgba(0,0,0,0.2);
        z-index    : 99999;
        max-width  : 360px;
        display    : flex;
        align-items: center;
        gap        : 10px;
        animation  : slideIn 0.3s ease;
    `;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100px); opacity: 0; }
            to   { transform: translateX(0);     opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, duration);
}

// Confirmation dialog
function showConfirm(message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position   : fixed;
        top        : 0; left: 0;
        width      : 100%; height: 100%;
        background : rgba(0,0,0,0.5);
        z-index    : 99998;
        display    : flex;
        align-items: center;
        justify-content: center;
    `;

    overlay.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:28px;max-width:380px;width:90%;text-align:center;font-family:Arial,sans-serif;">
            <p style="font-size:16px;color:#333;margin:0 0 24px;">${message}</p>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="bmd-confirm-yes" style="background:#dc3545;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer;">Yes</button>
                <button id="bmd-confirm-no"  style="background:#6c757d;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer;">No</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('bmd-confirm-yes').onclick = function() {
        overlay.remove();
        if (onConfirm) onConfirm();
    };

    document.getElementById('bmd-confirm-no').onclick = function() {
        overlay.remove();
        if (onCancel) onCancel();
    };
}


// =============================================================================
//  DATE AND FORMAT HELPERS
// =============================================================================

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
        day   : '2-digit',
        month : 'short',
        year  : 'numeric'
    });
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    // Convert 09:00 to 9:00 AM
    const [h, m] = timeStr.split(':');
    const hour   = parseInt(h);
    const ampm   = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
}

function formatCurrency(amount) {
    return '₹' + parseFloat(amount).toLocaleString('en-IN');
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    return dateTimeStr;
}

// Get today date in YYYY-MM-DD format
function today() {
    return new Date().toISOString().split('T')[0];
}

// Get date N days from now in YYYY-MM-DD
function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

// Get day name from date
function getDayName(dateStr) {
    const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    return days[new Date(dateStr).getDay()];
}


// =============================================================================
//  FORM HELPERS
// =============================================================================

function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    new FormData(form).forEach((value, key) => {
        data[key] = value;
    });
    return data;
}

function setFormData(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;
    Object.entries(data).forEach(([key, value]) => {
        const el = form.elements[key];
        if (el) el.value = value || '';
    });
}

function clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) form.reset();
}

// Validate required fields
function validateRequired(fields) {
    for (const [id, label] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (!el || !el.value.trim()) {
            showError(label + ' is required');
            if (el) el.focus();
            return false;
        }
    }
    return true;
}


// =============================================================================
//  NAVIGATION HELPERS
// =============================================================================

function setActiveNav(pageId) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const active = document.getElementById(pageId);
    if (active) active.classList.add('active');
}

function setUserName() {
    const s = getSession();
    const el = document.getElementById('bmd-username');
    if (el && s.name) el.textContent = s.name;
}


// =============================================================================
//  STATUS BADGE HELPERS
// =============================================================================

function getStatusBadge(status) {
    const config = {
        'BOOKED'           : { color: '#007bff', bg: '#e7f3ff', text: 'Booked'          },
        'COMPLETED'        : { color: '#28a745', bg: '#e8f5e9', text: 'Completed'        },
        'CANCELLED'        : { color: '#dc3545', bg: '#fdecea', text: 'Cancelled'        },
        'NO_SHOW'          : { color: '#fd7e14', bg: '#fff3e0', text: 'No Show'          },
        'WAITING'          : { color: '#ffc107', bg: '#fff8e1', text: 'Waiting'          },
        'IN_CONSULTATION'  : { color: '#17a2b8', bg: '#e0f7fa', text: 'In Consultation'  },
        'DONE'             : { color: '#28a745', bg: '#e8f5e9', text: 'Done'             },
        'AVAILABLE'        : { color: '#28a745', bg: '#e8f5e9', text: 'Available'        },
        'BLOCKED'          : { color: '#dc3545', bg: '#fdecea', text: 'Blocked'          },
        'PENDING'          : { color: '#ffc107', bg: '#fff8e1', text: 'Pending'          },
        'SUCCESS'          : { color: '#28a745', bg: '#e8f5e9', text: 'Paid'             },
        'FAILED'           : { color: '#dc3545', bg: '#fdecea', text: 'Failed'           },
        'REFUNDED'         : { color: '#6c757d', bg: '#f8f9fa', text: 'Refunded'         },
        'PARTIALLY_REFUNDED':{ color: '#fd7e14', bg: '#fff3e0', text: 'Partial Refund'   },
    };

    const c = config[status] || { color: '#6c757d', bg: '#f8f9fa', text: status };

    return `<span style="
        background    : ${c.bg};
        color         : ${c.color};
        padding       : 3px 10px;
        border-radius : 20px;
        font-size     : 12px;
        font-weight   : 600;
        border        : 1px solid ${c.color}30;
    ">${c.text}</span>`;
}


// =============================================================================
//  LOADER HTML — Add this to every page body
// =============================================================================

// Call this once on page load to inject loader
function initBMD() {
    // Inject loader
    if (!document.getElementById('bmd-loader')) {
        const loader = document.createElement('div');
        loader.id = 'bmd-loader';
        loader.style.cssText = `
            display        : none;
            position       : fixed;
            top            : 0; left: 0;
            width          : 100%; height: 100%;
            background     : rgba(255,255,255,0.7);
            z-index        : 99997;
            align-items    : center;
            justify-content: center;
            flex-direction : column;
            gap            : 12px;
        `;
        loader.innerHTML = `
            <div style="
                width        : 44px;
                height       : 44px;
                border       : 4px solid #e0e0e0;
                border-top   : 4px solid #00688C;
                border-radius: 50%;
                animation    : bmd-spin 0.8s linear infinite;
            "></div>
            <span style="color:#00688C;font-family:Arial;font-size:14px;">Loading...</span>
            <style>
                @keyframes bmd-spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(loader);
    }

    // Set username in navbar if element exists
    setUserName();
}

// Auto init when DOM ready
document.addEventListener('DOMContentLoaded', initBMD);
