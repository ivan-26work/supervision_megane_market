// ============ CONFIGURATION SUPABASE ============
(function() {
    const SUPABASE_URL = 'https://emcsigvlopntwbfkkjkh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY3NpZ3Zsb3BudHdiZmtramtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODE5MTgsImV4cCI6MjA5NDQ1NzkxOH0.YwYoV-azL3WEFtHoh4yoF7xTLrOwZILKCzJrGPsCs6I';

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ============ DOM ÉLÉMENTS ============
    const tabContent = document.getElementById('tabContent');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const globalSearch = document.getElementById('globalSearch');

    // ============ ÉTAT ============
    let allSellers = [];
    let allClients = [];
    let allProducts = [];
    let currentTab = 'sellers';

    // ============ UTILITAIRES ============
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatPrice(price) {
        return new Intl.NumberFormat('fr-FR').format(price);
    }

    function showToast(message, type = 'info') {
        let toast = document.getElementById('customToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'customToast';
            toast.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: #1a2a3a;
                color: white;
                padding: 10px 20px;
                border-radius: 40px;
                font-size: 0.8rem;
                z-index: 1100;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.style.opacity = '1';
        if (type === 'success') toast.style.background = '#4ade80';
        if (type === 'error') toast.style.background = '#ff4d4d';
        if (type === 'info') toast.style.background = '#5a9eff';
        
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

    // ============ AUTHENTIFICATION ============
    async function checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session || session.user.email !== 'ipoteivan23@gmail.com') {
            window.location.href = 'auth-supervision.html';
            return false;
        }
        return true;
    }

    async function logout() {
        await supabaseClient.auth.signOut();
        window.location.href = 'auth-supervision.html';
    }

    // ============ CHARGEMENT DES DONNÉES ============
    async function loadAllData() {
        showLoading();
        try {
            const [sellersRes, clientsRes, productsRes] = await Promise.all([
                supabaseClient.from('markets').select('*'),
                supabaseClient.from('buyers').select('*'),
                supabaseClient.from('products').select('*')
            ]);

            allSellers = sellersRes.data || [];
            allClients = clientsRes.data || [];
            allProducts = productsRes.data || [];

            updateBadges();
            renderCurrentTab();
        } catch (err) {
            console.error('Erreur:', err);
            tabContent.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erreur chargement des données</p></div>';
            showToast('Erreur chargement', 'error');
        }
    }

    function updateBadges() {
        document.getElementById('sellersBadge').textContent = allSellers.length;
        document.getElementById('clientsBadge').textContent = allClients.length;
        document.getElementById('productsBadge').textContent = allProducts.length;
    }

    function showLoading() {
        tabContent.innerHTML = '<div class="loader"><div class="spinner"></div><p>Chargement des données...</p></div>';
    }

    // ============ RENDU SELON L'ONGLET ============
    function renderCurrentTab() {
        if (currentTab === 'sellers') renderSellers();
        else if (currentTab === 'clients') renderClients();
        else if (currentTab === 'products') renderProducts();
    }

    function getSearchTerm() {
        return globalSearch ? globalSearch.value.toLowerCase().trim() : '';
    }

    // ============ VENDEURS ============
    function renderSellers() {
        const searchTerm = getSearchTerm();
        let filtered = [...allSellers];
        
        if (searchTerm) {
            filtered = allSellers.filter(s =>
                s.market_name?.toLowerCase().includes(searchTerm) ||
                s.owner_name?.toLowerCase().includes(searchTerm) ||
                s.email?.toLowerCase().includes(searchTerm) ||
                s.city?.toLowerCase().includes(searchTerm)
            );
        }

        if (filtered.length === 0) {
            tabContent.innerHTML = '<div class="empty-state"><i class="fas fa-store-slash"></i><p>Aucun vendeur trouvé</p></div>';
            return;
        }

        tabContent.innerHTML = `
            <div class="card-list">
                ${filtered.map(seller => {
                    const isActive = seller.market_active !== false;
                    const avatarUrl = seller.avatar_url;
                    return `
                        <div class="info-card" data-id="${seller.id}" data-type="seller">
                            ${avatarUrl 
                                ? `<img src="${escapeHtml(avatarUrl)}" class="avatar" onerror="this.src=''">`
                                : `<div class="avatar-placeholder"><i class="fas fa-store"></i></div>`
                            }
                            <div class="info-content">
                                <div class="info-header">
                                    <span class="name">${escapeHtml(seller.market_name || 'Sans nom')}</span>
                                    <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'Actif' : 'Inactif'}</span>
                                </div>
                                <div class="info-details">
                                    <span><i class="fas fa-envelope"></i> ${escapeHtml(seller.email || '-')}</span>
                                    <span><i class="fas fa-user"></i> ${escapeHtml(seller.owner_name || '-')}</span>
                                    <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(seller.city || '-')}</span>
                                    <span><i class="fas fa-phone"></i> ${escapeHtml(seller.phone || '-')}</span>
                                </div>
                            </div>
                            <div class="info-card-arrow"><i class="fas fa-chevron-right"></i></div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        document.querySelectorAll('.info-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                window.location.href = `vendeur.html?id=${id}`;
            });
        });
    }

    // ============ CLIENTS ============
    function renderClients() {
        const searchTerm = getSearchTerm();
        let filtered = [...allClients];
        
        if (searchTerm) {
            filtered = allClients.filter(c =>
                c.full_name?.toLowerCase().includes(searchTerm) ||
                c.email?.toLowerCase().includes(searchTerm) ||
                c.city?.toLowerCase().includes(searchTerm) ||
                c.phone?.toLowerCase().includes(searchTerm)
            );
        }

        if (filtered.length === 0) {
            tabContent.innerHTML = '<div class="empty-state"><i class="fas fa-users-slash"></i><p>Aucun client trouvé</p></div>';
            return;
        }

        tabContent.innerHTML = `
            <div class="card-list">
                ${filtered.map(client => {
                    const isComplete = client.full_name && client.city;
                    const avatarUrl = client.avatar_url;
                    return `
                        <div class="info-card" data-id="${client.id}" data-type="client">
                            ${avatarUrl 
                                ? `<img src="${escapeHtml(avatarUrl)}" class="avatar" onerror="this.src=''">`
                                : `<div class="avatar-placeholder"><i class="fas fa-user"></i></div>`
                            }
                            <div class="info-content">
                                <div class="info-header">
                                    <span class="name">${escapeHtml(client.full_name || 'Non renseigné')}</span>
                                    <span class="status-badge ${isComplete ? 'status-complet' : 'status-incomplet'}">${isComplete ? 'Complet' : 'Incomplet'}</span>
                                </div>
                                <div class="info-details">
                                    <span><i class="fas fa-envelope"></i> ${escapeHtml(client.email || '-')}</span>
                                    <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(client.city || '-')}</span>
                                    <span><i class="fas fa-phone"></i> ${escapeHtml(client.phone || '-')}</span>
                                </div>
                            </div>
                            <div class="info-card-arrow"><i class="fas fa-chevron-right"></i></div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        document.querySelectorAll('.info-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                window.location.href = `client.html?id=${id}`;
            });
        });
    }

    // ============ PRODUITS ============
    function renderProducts() {
        const searchTerm = getSearchTerm();
        let filtered = [...allProducts];
        
        if (searchTerm) {
            filtered = allProducts.filter(p =>
                p.name?.toLowerCase().includes(searchTerm) ||
                p.category?.toLowerCase().includes(searchTerm)
            );
        }

        if (filtered.length === 0) {
            tabContent.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>Aucun produit trouvé</p></div>';
            return;
        }

        tabContent.innerHTML = `
            <div class="products-grid">
                ${filtered.map(product => {
                    const imageUrl = (product.images && product.images[0]) ? product.images[0] : null;
                    return `
                        <div class="product-card" data-id="${product.id}">
                            ${imageUrl 
                                ? `<img src="${escapeHtml(imageUrl)}" class="product-image" onerror="this.src=''">`
                                : `<div class="product-image-placeholder"><i class="fas fa-image"></i></div>`
                            }
                            <div class="product-info">
                                <div class="product-name">${escapeHtml(product.name)}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                window.location.href = `produit.html?id=${id}`;
            });
        });
    }

    // ============ INITIALISATION ============
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.getAttribute('data-tab');
            renderCurrentTab();
        });
    });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.style.transform = 'rotate(180deg)';
            setTimeout(() => { refreshBtn.style.transform = ''; }, 500);
            loadAllData();
        });
    }

    if (globalSearch) {
        globalSearch.addEventListener('input', () => renderCurrentTab());
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    (async () => {
        const isAuth = await checkSession();
        if (isAuth) {
            await loadAllData();
        }
    })();
})();