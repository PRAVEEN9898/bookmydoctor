// =====================================================
//  BookMyDoctor — Shared Navbar
//  Include on every page:
//  <script src="../js/bmd-nav.js"></script>
//  <div id="bmd-navbar"></div>
// =====================================================

(function () {

    // ── Role config ──────────────────────────────────
    const ROLE_CONFIG = {
        'PATIENT'        : { label: 'PATIENT',        color: '#2d9e5f', home: '../index.html' },
        'DOCTOR'         : { label: 'DOCTOR',          color: '#1565c0', home: '../doctor/dashboard.html' },
        'ADMIN'          : { label: 'ADMIN',           color: '#6a1b9a', home: '../admin/dashboard.html' },
        'HOSPITAL_ADMIN' : { label: 'HOSPITAL ADMIN',  color: '#e65100', home: '../hospital/dashboard.html' },
    };

    // ── Get session ──────────────────────────────────
    function getSession() {
        return {
            token    : localStorage.getItem('bmd_token'),
            userType : localStorage.getItem('bmd_user_type'),
            userId   : localStorage.getItem('bmd_user_id'),
            name     : localStorage.getItem('bmd_name'),
            adminRole: localStorage.getItem('bmd_admin_role') || ''
        };
    }

    // ── Logout ───────────────────────────────────────
    async function handleLogout() {
        const s = getSession();
        if (s.token) {
            try {
                await fetch(
                    'https://bookmydoctor-proxy.pulipraveenkumar08.workers.dev/logout',
                    {
                        method  : 'POST',
                        headers : { 'Content-Type': 'application/json' },
                        body    : JSON.stringify({ session_token: s.token })
                    }
                );
            } catch (e) {}
        }
        localStorage.clear();
        window.location.href = '../patient/login.html';
    }

    // ── Render navbar ────────────────────────────────
    function renderNavbar() {
        const container = document.getElementById('bmd-navbar');
        if (!container) return;

        const s      = getSession();
        const role   = s.userType || '';
        const config = ROLE_CONFIG[role] || {};
        const label  = config.label || role;
        const color  = config.color || '#2d9e5f';
        const name   = s.name || '—';

        // Nav links based on role
        let links = '';

        if (role === 'PATIENT') {
            links = `
                <a href="../index.html"                  class="bmd-nav-link">🏥 Find Doctors</a>
                <a href="../patient/appointments.html"   class="bmd-nav-link">📋 My Appointments</a>
                <a href="../patient/profile.html"        class="bmd-nav-link">👤 Profile</a>
            `;
        } else if (role === 'DOCTOR') {
            links = `
                <a href="../doctor/dashboard.html"  class="bmd-nav-link">🏠 Dashboard</a>
                <a href="../doctor/queue.html"       class="bmd-nav-link">👥 Queue</a>
                <a href="../doctor/schedule.html"    class="bmd-nav-link">📅 Schedule</a>
                <a href="../doctor/earnings.html"    class="bmd-nav-link">💰 Earnings</a>
            `;
        } else if (role === 'ADMIN') {
            links = `
                <a href="../admin/dashboard.html"    class="bmd-nav-link">🏠 Dashboard</a>
                <a href="../admin/hospitals.html"    class="bmd-nav-link">🏥 Hospitals</a>
                <a href="../admin/doctors.html"      class="bmd-nav-link">👨‍⚕️ Doctors</a>
                <a href="../admin/settlements.html"  class="bmd-nav-link">💰 Settlements</a>
            `;
        } else if (role === 'HOSPITAL_ADMIN') {
            links = `
                <a href="../hospital/dashboard.html" class="bmd-nav-link">🏠 Dashboard</a>
                <a href="../hospital/doctors.html"   class="bmd-nav-link">👨‍⚕️ Doctors</a>
                <a href="../hospital/analytics.html" class="bmd-nav-link">📊 Analytics</a>
            `;
        }

        container.innerHTML = `
            <style>
                #bmd-navbar * { box-sizing: border-box; margin: 0; padding: 0; }

                .bmd-nav {
                    background    : #ffffff;
                    padding       : 0 24px;
                    height        : 60px;
                    display       : flex;
                    align-items   : center;
                    justify-content: space-between;
                    box-shadow    : 0 1px 4px rgba(0,0,0,0.08);
                    position      : sticky;
                    top           : 0;
                    z-index       : 1000;
                    font-family   : 'Segoe UI', Arial, sans-serif;
                }

                .bmd-nav-brand {
                    display         : flex;
                    align-items     : center;
                    gap             : 9px;
                    text-decoration : none;
                }

                .bmd-nav-brand-icon {
                    width           : 34px;
                    height          : 34px;
                    background      : #2d9e5f;
                    border-radius   : 8px;
                    display         : flex;
                    align-items     : center;
                    justify-content : center;
                    font-size       : 18px;
                }

                .bmd-nav-brand-name {
                    font-size   : 18px;
                    font-weight : 700;
                    color       : #1a6b3c;
                    white-space : nowrap;
                }

                .bmd-nav-links {
                    display     : flex;
                    align-items : center;
                    gap         : 4px;
                    justify-content: center;
                    flex        : 1;
                    overflow    : hidden;
                }

                .bmd-nav-link {
                    padding         : 6px 12px;
                    border-radius   : 8px;
                    font-size       : 13px;
                    font-weight     : 500;
                    color           : #6c757d;
                    text-decoration : none;
                    transition      : all 0.2s;
                    white-space     : nowrap;
                }

                .bmd-nav-link:hover {
                    background : #f4fbf7;
                    color      : #1a6b3c;
                }

                .bmd-nav-right {
                    display     : flex;
                    align-items : center;
                    gap         : 10px;
                }

                .bmd-user-badge {
                    display       : flex;
                    align-items   : center;
                    gap           : 8px;
                    background    : #f4fbf7;
                    border-radius : 20px;
                    padding       : 5px 12px 5px 5px;
                    border        : 1px solid #e8f5ee;
                }

                .bmd-role-pill {
                    font-size     : 10px;
                    font-weight   : 700;
                    color         : #ffffff;
                    padding       : 3px 9px;
                    border-radius : 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    white-space   : nowrap;
                }

                .bmd-user-name {
                    font-size   : 13px;
                    font-weight : 600;
                    color       : #343a40;
                    white-space : nowrap;
                }

                .bmd-logout-btn {
                    padding       : 6px 14px;
                    background    : #ffffff;
                    color         : #dc3545;
                    border        : 1.5px solid #dc3545;
                    border-radius : 20px;
                    font-size     : 13px;
                    font-weight   : 600;
                    cursor        : pointer;
                    font-family   : 'Segoe UI', Arial, sans-serif;
                    transition    : all 0.2s;
                    white-space   : nowrap;
                }

                .bmd-logout-btn:hover { background: #fdecea; }

                @media (max-width: 768px) {
                    .bmd-nav-links { display: none; }
                    .bmd-nav-brand-name { font-size: 15px; }
                }

                @media (max-width: 480px) {
                    .bmd-nav { padding: 0 12px; }
                    .bmd-user-name { display: none; }
                }
            </style>

            <nav class="bmd-nav">

                <a href="${config.home || '../index.html'}" class="bmd-nav-brand">
                    <div class="bmd-nav-brand-icon">🏥</div>
                    <span class="bmd-nav-brand-name">BookMyDoctor</span>
                </a>

                <div class="bmd-nav-links">
                    ${links}
                </div>

                <div class="bmd-nav-right">
                    ${s.token ? `
                        <div class="bmd-user-badge">
                            <span class="bmd-role-pill" style="background:${color};">${label}</span>
                            <span class="bmd-user-name">${name}</span>
                        </div>
                        <button class="bmd-logout-btn" onclick="bmdLogout()">Logout</button>
                    ` : `
                        <a href="../patient/login.html"    style="padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;color:#1a6b3c;border:1.5px solid #2d9e5f;text-decoration:none;background:#fff;">Sign In</a>
                        <a href="../patient/register.html" style="padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;color:#fff;background:#2d9e5f;text-decoration:none;">Get Started</a>
                    `}
                </div>

            </nav>
        `;
    }

    // ── Expose logout globally ───────────────────────
    window.bmdLogout = handleLogout;

    // ── Auto render on DOM ready ─────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderNavbar);
    } else {
        renderNavbar();
    }

})();
