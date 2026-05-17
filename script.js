// ===============================================
// SCRIPT.JS - SUPERVISION (Listes avec redirection)
// ===============================================

(function() {
    const SUPABASE_URL = 'https://emcsigvlopntwbfkkjkh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY3NpZ3Zsb3BudHdiZmtramtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODE5MTgsImV4cCI6MjA5NDQ1NzkxOH0.YwYoV-azL3WEFtHoh4yoF7xTLrOwZILKCzJrGPsCs6I';

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let allSellers = [];
    let allClients = [];
    let allProducts = [];
    let currentTab = 'sellers';

    const tabContent = document.getElementById('tabContent');
    const refreshBtn = document.getElementById('refreshBtn');
    const globalSearch = document.getElementById('globalSearch');

    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || session.user.email !== 'ipoteivan23@gmail.com') {
            window.location.href = 'auth-supervision.html';
            return false;
        }
        return true;
    }

    async function loadAllData() {
        showLoading();
        try {
            const [sellersRes, clientsRes, productsRes] = await Promise.all([
                supabase.from('markets').select('*'),
                supabase.from('buyers').select('*'),
                supabase.from('products').select('*')
            ]);

            allSellers = sellersRes.data || [];
            allClients = clientsRes.data || [];
            allProducts = productsRes.data || [];

            updateBadges();
            renderCurrentTab();
        } catch (err) {
            console.error(err);
            tabContent.innerHTML = '<div class="loader">Erreur chargement</div>';
        }
    }

    function updateBadges() {
        document.getElementById('sellersBadge').textContent = allSellers.length;
        document.getElementById('clientsBadge').textContent = allClients.length;
        document.getElementById('productsBadge').textContent = allProducts.length;
    }

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
                s.email?.toLowerCase().includes(searchTerm)
            );
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
                                </div>
                            </div>
                            <div class="info-card-arrow"><i class="fas fa-chevron-right"></i></div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${filtered.length === 0 ? '<div class="loader">Aucun vendeur trouvé</div>' : ''}
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
                c.city?.toLowerCase().includes(searchTerm)
            );
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
            ${filtered.length === 0 ? '<div class="loader">Aucun client trouvé</div>' : ''}
        `;

        document.querySelectorAll('.info-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                window.location.href = `client.html?id=${id}`;
            });
        });
    }

    // ============ PRODUITS (format carré : image + nom) ============
    function renderProducts() {
        const searchTerm = getSearchTerm();
        let filtered = [...allProducts];
        if (searchTerm) {
            filtered = allProducts.filter(p =>
                p.name?.toLowerCase().includes(searchTerm)
            );
        }

        const sellerMap = Object.fromEntries(allSellers.map(s => [s.id, s.market_name || s.owner_name || '?']));

        tabContent.innerHTML = `
            <div class="products-grid">
                ${filtered.map(product => {
                    const imageUrl = (product.images && product.images[0]) ? product.images[0] : null;
                    return `
                        <div class="product-card" data-id="${product.id}" data-type="product">
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
            ${filtered.length === 0 ? '<div class="loader">Aucun produit trouvé</div>' : ''}
        `;

        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                window.location.href = `produit.html?id=${id}`;
            });
        });
    }

    // ============ UTILITAIRES ============
    function formatPrice(price) {
        return new Intl.NumberFormat('fr-FR').format(price);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showLoading() {
        tabContent.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
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

    refreshBtn.addEventListener('click', () => loadAllData());
    globalSearch.addEventListener('input', () => renderCurrentTab());

    (async () => {
        const isAuth = await checkSession();
        if (isAuth) {
            await loadAllData();
        }
    })();
})();