// ============ SERVICE WORKER PWA ============
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW enregistré:', reg))
            .catch(err => console.log('Erreur SW:', err));
    });
}

// ============ INSTALLATION PWA ============
(function setupPWA() {
    let deferredPrompt;
    const installBanner = document.getElementById('installBanner');
    const installBtn = document.getElementById('installBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBanner) installBanner.classList.add('show');
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted' && installBanner) {
                    installBanner.classList.remove('show');
                }
                deferredPrompt = null;
            }
        });
    }
})();

// ============ CONFIGURATION SUPABASE ============
const DB_URL = 'https://emcsigvlopntwbfkkjkh.supabase.co';
const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY3NpZ3Zsb3BudHdiZmtramtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODE5MTgsImV4cCI6MjA5NDQ1NzkxOH0.YwYoV-azL3WEFtHoh4yoF7xTLrOwZILKCzJrGPsCs6I';

const db = window.supabase.createClient(DB_URL, DB_KEY);

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

// ============ GESTION DU CACHE ============
let lastNewsIds = new Set();

function saveNewsToSession(news) {
    sessionStorage.setItem('index_news', JSON.stringify({
        news: news,
        timestamp: Date.now()
    }));
}

function loadNewsFromSession() {
    const cached = sessionStorage.getItem('index_news');
    if (!cached) return null;
    try {
        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp > 30 * 60 * 1000) {
            sessionStorage.removeItem('index_news');
            return null;
        }
        return data.news;
    } catch (e) {
        return null;
    }
}

function clearCache() {
    sessionStorage.removeItem('index_news');
    sessionStorage.removeItem('index_cache');
    sessionStorage.removeItem('infinite_banners_cache');
}

// ============ BONJOUR CLIENT ============
async function showWelcome() {
    const { data: { session } } = await db.auth.getSession();
    const titleEl = document.getElementById('welcomeTitle');
    const textEl = document.getElementById('welcomeText');
    const encouragementBanner = document.getElementById('encouragementBanner');
    
    if (session) {
        const { data: buyer } = await db
            .from('buyers')
            .select('full_name')
            .eq('id', session.user.id)
            .single();
        
        const name = buyer?.full_name || session.user.email?.split('@')[0] || 'cher client';
        if (titleEl) titleEl.textContent = `Bonjour ${name} 👋`;
        if (textEl) textEl.textContent = 'Content de vous revoir sur Megane Market.';
        if (encouragementBanner) encouragementBanner.style.display = 'flex';
    } else {
        if (titleEl) titleEl.textContent = 'Bonjour 👋';
        if (textEl) textEl.innerHTML = '<span class="connect-message error">🔐 Connectez-vous pour profiter de toutes les fonctionnalités</span><br>ou continuez en tant qu\'invité.';
        if (encouragementBanner) encouragementBanner.style.display = 'none';
    }
}

// ============ BANNIÈRES D'ACTUALITÉS ============
async function loadNewsBanners() {
    try {
        const { data: markets } = await db
            .from('markets')
            .select('id, market_name, announcement_text, show_announcement, updated_at')
            .eq('market_active', true);
        
        if (!markets) return [];
        
        const marketIds = markets.map(m => m.id);
        
        const { data: products } = await db
            .from('products')
            .select('id, name, user_id, active, created_at, updated_at')
            .in('user_id', marketIds);
        
        const news = [];
        const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
        
        for (const product of products || []) {
            const createdAt = new Date(product.created_at).getTime();
            if (createdAt > twoDaysAgo) {
                const market = markets.find(m => m.id === product.user_id);
                news.push({
                    id: `new_${product.id}`,
                    type: 'new-product',
                    title: 'NOUVEAU PRODUIT',
                    titleBadge: 'green',
                    message: `${escapeHtml(market?.market_name || 'Un vendeur')} a ajouté`,
                    productName: escapeHtml(product.name),
                    date: product.created_at
                });
            }
        }
        
        for (const market of markets) {
            if (market.show_announcement && market.announcement_text) {
                const updatedAt = new Date(market.updated_at).getTime();
                if (updatedAt > twoDaysAgo) {
                    news.push({
                        id: `msg_${market.id}_${market.updated_at}`,
                        type: 'message',
                        title: 'MESSAGE DU VENDEUR',
                        titleBadge: 'blue',
                        message: `${escapeHtml(market.market_name)} :`,
                        announcement: escapeHtml(market.announcement_text.substring(0, 100)),
                        date: market.updated_at
                    });
                }
            }
        }
        
        for (const product of products || []) {
            const updatedAt = new Date(product.updated_at).getTime();
            if (updatedAt > twoDaysAgo && product.active === false) {
                const market = markets.find(m => m.id === product.user_id);
                news.push({
                    id: `disable_${product.id}_${product.updated_at}`,
                    type: 'product-disabled',
                    title: 'PRODUIT RETIRE',
                    titleBadge: 'orange',
                    message: `${escapeHtml(market?.market_name || 'Un vendeur')} a retiré`,
                    productName: escapeHtml(product.name),
                    date: product.updated_at
                });
            }
        }
        
        news.sort((a, b) => new Date(b.date) - new Date(a.date));
        return news;
    } catch (err) {
        console.error('Erreur chargement actualités:', err);
        return [];
    }
}

function renderNewsBanners(news, highlightNew = false) {
    const container = document.getElementById('newsBanners');
    if (!container) return;
    
    if (news.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucune actualité récente</div>';
        return;
    }
    
    const currentIds = new Set(news.map(n => n.id));
    const newIds = [...currentIds].filter(id => !lastNewsIds.has(id));
    const hasNew = newIds.length > 0;
    
    const refreshBadge = document.getElementById('refreshBadge');
    if (refreshBadge) {
        if (hasNew && highlightNew) {
            refreshBadge.textContent = newIds.length;
            refreshBadge.style.display = 'flex';
        } else {
            refreshBadge.textContent = '0';
            refreshBadge.style.display = 'none';
        }
    }
    
    container.innerHTML = news.map(item => {
        let iconClass = '';
        let borderClass = '';
        let badgeColor = '';
        
        switch (item.type) {
            case 'new-product':
                iconClass = 'fa-plus-circle';
                borderClass = 'new-product';
                badgeColor = 'badge-green';
                break;
            case 'message':
                iconClass = 'fa-bullhorn';
                borderClass = 'message';
                badgeColor = 'badge-blue';
                break;
            case 'product-disabled':
                iconClass = 'fa-eye-slash';
                borderClass = 'product-disabled';
                badgeColor = 'badge-orange';
                break;
            default:
                iconClass = 'fa-info-circle';
                borderClass = '';
                badgeColor = '';
        }
        
        const isNew = newIds.includes(item.id);
        const highlightClass = (highlightNew && isNew) ? 'highlight' : '';
        
        let contentHtml = '';
        if (item.type === 'message') {
            contentHtml = `
                <div class="news-message-line">${item.message}</div>
                <div class="news-announcement">${item.announcement}</div>
            `;
        } else {
            contentHtml = `
                <div class="news-message-line">${item.message}</div>
                <div class="product-name-badge">${item.productName}</div>
            `;
        }
        
        return `
            <div class="news-banner ${borderClass} ${highlightClass}" data-id="${item.id}">
                <div class="news-icon"><i class="fas ${iconClass}"></i></div>
                <div class="news-content">
                    <div class="news-title">
                        <span class="title-badge ${badgeColor}">${escapeHtml(item.title)}</span>
                    </div>
                    ${contentHtml}
                    <div class="news-time">${formatDate(item.date)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    lastNewsIds = currentIds;
    saveNewsToSession(news);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'À l\'instant';
    if (diffHours < 24) return `Il y a ${diffHours} heure(s)`;
    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays} jour(s)`;
}

// ============ PRODUITS TENDANCES ============
async function loadTrendingProducts() {
    try {
        const { data: products } = await db
            .from('products')
            .select('*')
            .eq('active', true)
            .limit(10);
        
        if (!products || products.length === 0) return [];
        
        const shuffled = [...products];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, 10);
    } catch (err) {
        console.error('Erreur chargement tendances:', err);
        return [];
    }
}

function renderTrendingCarousel(products) {
    const track = document.getElementById('trendingTrack');
    if (!track) return;
    
    if (products.length === 0) {
        track.innerHTML = '<div class="empty-state">Aucun produit tendance</div>';
        return;
    }
    
    track.innerHTML = products.map(product => `
        <div class="trending-item" data-id="${product.id}">
            ${product.images && product.images[0] 
                ? `<img src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.name)}">`
                : `<div class="image-placeholder"><i class="fas fa-image"></i></div>`
            }
            <div class="info">
                <div class="name">${escapeHtml(product.name)}</div>
                <div class="price">${formatPrice(product.price)} FCFA</div>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.trending-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.getAttribute('data-id');
            if (id) window.location.href = `viewproduct.html?id=${id}`;
        });
    });
}

function initTrendingCarousel() {
    const track = document.getElementById('trendingTrack');
    const prevBtn = document.getElementById('trendingPrev');
    const nextBtn = document.getElementById('trendingNext');
    
    if (!track || !prevBtn || !nextBtn) return;
    
    prevBtn.addEventListener('click', () => {
        track.scrollBy({ left: -200, behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', () => {
        track.scrollBy({ left: 200, behavior: 'smooth' });
    });
}

// ============ MARCHÉS DISPONIBLES ============
async function loadMarkets() {
    try {
        const { data } = await db
            .from('markets')
            .select('id, market_name, owner_name, city, avatar_url')
            .eq('market_active', true)
            .order('created_at', { ascending: false })
            .limit(6);
        return data || [];
    } catch (err) {
        console.error('Erreur chargement marchés:', err);
        return [];
    }
}

function renderMarkets(markets) {
    const grid = document.getElementById('marketsGrid');
    if (!grid) return;
    
    if (markets.length === 0) {
        grid.innerHTML = '<div class="empty-state">Aucun marché disponible</div>';
        return;
    }
    
    grid.innerHTML = markets.map(market => `
        <div class="market-card" data-id="${market.id}">
            <i class="fas fa-store"></i>
            <h4>${escapeHtml(market.market_name || market.owner_name || 'Marché')}</h4>
            <p>${escapeHtml(market.city || 'Localisation')}</p>
        </div>
    `).join('');
    
    document.querySelectorAll('.market-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            if (id) window.location.href = `vendeur.html?id=${id}`;
        });
    });
}

// ============ PRODUITS TOP ============
let topProductsInterval = null;
let currentTopIndex = 0;
let topProductsList = [];

async function loadTopProducts() {
    try {
        const { data: products } = await db
            .from('products')
            .select('*')
            .eq('active', true);
        
        if (!products || products.length === 0) return [];
        
        const shuffled = [...products];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, 5);
    } catch (err) {
        console.error('Erreur chargement produits top:', err);
        return [];
    }
}

function renderTopProductsCarousel(products) {
    const container = document.getElementById('topProductsSlides');
    const dotsContainer = document.getElementById('topProductsDots');
    if (!container || !dotsContainer) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="carousel-slide"><div class="info"><h3>Aucun produit disponible</h3></div></div>';
        return;
    }
    
    topProductsList = products;
    
    container.innerHTML = products.map(product => `
        <div class="carousel-slide" data-id="${product.id}">
            ${product.images && product.images[0] 
                ? `<img src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.name)}">`
                : `<div class="image-placeholder"><i class="fas fa-image"></i></div>`
            }
            <div class="info">
                <div class="badge">TOP PRODUIT</div>
                <h3>${escapeHtml(product.name)}</h3>
                <div class="price">${formatPrice(product.price)} FCFA</div>
            </div>
        </div>
    `).join('');
    
    dotsContainer.innerHTML = products.map((_, i) => `
        <div class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>
    `).join('');
    
    document.querySelectorAll('#topProductsSlides .carousel-slide').forEach(slide => {
        slide.addEventListener('click', () => {
            const id = slide.dataset.id;
            if (id) window.location.href = `viewproduct.html?id=${id}`;
        });
    });
    
    document.querySelectorAll('#topProductsDots .carousel-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.dataset.index);
            goToTopSlide(index);
            resetTopTimer();
        });
    });
}

function goToTopSlide(index) {
    const container = document.getElementById('topProductsSlides');
    if (!container || !topProductsList.length) return;
    
    currentTopIndex = Math.min(Math.max(0, index), topProductsList.length - 1);
    container.style.transform = `translateX(-${currentTopIndex * 100}%)`;
    
    const dots = document.querySelectorAll('#topProductsDots .carousel-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentTopIndex);
    });
}

function nextTopSlide() {
    if (!topProductsList.length) return;
    const nextIndex = (currentTopIndex + 1) % topProductsList.length;
    goToTopSlide(nextIndex);
}

function prevTopSlide() {
    if (!topProductsList.length) return;
    const prevIndex = (currentTopIndex - 1 + topProductsList.length) % topProductsList.length;
    goToTopSlide(prevIndex);
}

function startTopCarousel() {
    if (topProductsInterval) clearInterval(topProductsInterval);
    if (topProductsList.length > 1) {
        topProductsInterval = setInterval(() => {
            nextTopSlide();
        }, 5000);
    }
}

function resetTopTimer() {
    if (topProductsInterval) {
        clearInterval(topProductsInterval);
        startTopCarousel();
    }
}

function initTopCarousel() {
    const prevBtn = document.getElementById('topProductsPrev');
    const nextBtn = document.getElementById('topProductsNext');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            prevTopSlide();
            resetTopTimer();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            nextTopSlide();
            resetTopTimer();
        });
    }
}

// ============ COUP DE CŒUR ============
async function loadFeaturedProduct() {
    try {
        const { data: products } = await db
            .from('products')
            .select('*')
            .eq('active', true);
        
        if (!products || products.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * products.length);
        return products[randomIndex];
    } catch (err) {
        console.error('Erreur chargement coup de cœur:', err);
        return null;
    }
}

async function renderFeaturedProduct() {
    const container = document.getElementById('featuredProduct');
    if (!container) return;
    
    const product = await loadFeaturedProduct();
    
    if (!product) {
        container.innerHTML = '<div class="empty-state">Aucun produit pour le moment</div>';
        return;
    }
    
    const imageUrl = product.images?.[0] || null;
    
    container.innerHTML = `
        ${imageUrl 
            ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}">`
            : `<div class="image-placeholder"><i class="fas fa-image"></i></div>`
        }
        <div class="info">
            <div class="badge">COUP DE COEUR</div>
            <h3>${escapeHtml(product.name)}</h3>
            <div class="price">${formatPrice(product.price)} FCFA</div>
        </div>
    `;
    
    container.addEventListener('click', () => {
        window.location.href = `viewproduct.html?id=${product.id}`;
    });
}

// ============ BANNIÈRES INFINIES (PRODUITS ALÉATOIRES) ============
let allProductsList = [];
let isLoadingBanners = false;
let bannersPerLoad = 10;
let infiniteBannerObserver = null;
let hasMoreBanners = true;

async function loadAllProductsForBanners() {
    try {
        const { data: products } = await db
            .from('products')
            .select('*')
            .eq('active', true);
        
        allProductsList = products || [];
        hasMoreBanners = allProductsList.length > 0;
        
        sessionStorage.setItem('infinite_banners_cache', JSON.stringify({
            products: allProductsList,
            timestamp: Date.now()
        }));
        
        return allProductsList;
    } catch (err) {
        console.error('Erreur chargement produits pour bannières:', err);
        return [];
    }
}

function getRandomProducts(count) {
    if (allProductsList.length === 0) return [];
    
    const shuffled = [...allProductsList];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
}

// Enregistrement des touchers (comme dans market.html)
async function recordTouch(productId) {
    try {
        await db
            .from('product_stats')
            .insert({
                product_id: productId,
                click_count: 1,
                click_type: 'touch',
                clicked_at: new Date().toISOString()
            });
        console.log('Toucher enregistré pour le produit:', productId);
    } catch (err) {
        console.error('Erreur enregistrement toucher:', err);
    }
}

function renderBanner(product) {
    const imageUrl = product.images && product.images[0] ? product.images[0] : null;
    
    return `
        <div class="product-banner" data-id="${product.id}">
            <div class="banner-image">
                ${imageUrl
                    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}">`
                    : `<div class="image-placeholder"><i class="fas fa-image"></i></div>`
                }
            </div>
            <div class="banner-content">
                <h3 class="banner-name">${escapeHtml(product.name)}</h3>
                <p class="banner-price">${formatPrice(product.price)} FCFA</p>
                <button class="banner-btn">Voir détails <i class="fas fa-arrow-right"></i></button>
            </div>
        </div>
    `;
}

function renderBanners(banners, append = true) {
    const container = document.getElementById('infiniteBannersContainer');
    if (!container) return;
    
    const bannersHtml = banners.map(product => renderBanner(product)).join('');
    
    if (append) {
        container.insertAdjacentHTML('beforeend', bannersHtml);
    } else {
        container.innerHTML = bannersHtml;
    }
    
    // Ajouter les événements
    document.querySelectorAll('.product-banner').forEach(banner => {
        const productId = banner.getAttribute('data-id');
        
        // Clic sur la bannière
        banner.addEventListener('click', async (e) => {
            if (e.target.closest('.banner-btn')) return;
            if (productId) {
                await recordTouch(productId);
                window.location.href = `viewproduct.html?id=${productId}`;
            }
        });
        
        // Bouton "Voir détails"
        const btn = banner.querySelector('.banner-btn');
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (productId) {
                    await recordTouch(productId);
                    window.location.href = `viewproduct.html?id=${productId}`;
                }
            });
        }
        
        // TOUCHER MOBILE INSTANTANÉ
        banner.addEventListener('touchstart', (e) => {
            if (productId) recordTouch(productId);
        });
    });
}

function loadMoreBanners() {
    if (isLoadingBanners) return;
    if (!hasMoreBanners) return;
    if (allProductsList.length === 0) return;
    
    isLoadingBanners = true;
    const loadingTrigger = document.getElementById('infiniteLoadingTrigger');
    if (loadingTrigger) loadingTrigger.style.display = 'flex';
    
    setTimeout(() => {
        const newBanners = getRandomProducts(bannersPerLoad);
        if (newBanners.length > 0) {
            renderBanners(newBanners, true);
            // Observer le nouveau dernier élément
            setTimeout(() => {
                const container = document.getElementById('infiniteBannersContainer');
                if (container && infiniteBannerObserver) {
                    const lastBanner = container.lastElementChild;
                    if (lastBanner) {
                        infiniteBannerObserver.unobserve(lastBanner);
                        infiniteBannerObserver.observe(lastBanner);
                    }
                }
            }, 100);
        } else {
            hasMoreBanners = false;
        }
        isLoadingBanners = false;
        if (loadingTrigger) loadingTrigger.style.display = 'none';
    }, 300);
}

function initInfiniteBanners() {
    const container = document.getElementById('infiniteBannersContainer');
    if (!container) return;
    
    if (infiniteBannerObserver) {
        infiniteBannerObserver.disconnect();
    }
    
    infiniteBannerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoadingBanners && hasMoreBanners) {
                loadMoreBanners();
            }
        });
    }, { 
        threshold: 0.1,
        rootMargin: '200px'
    });
    
    // Observer le dernier élément
    const lastBanner = container.lastElementChild;
    if (lastBanner) {
        infiniteBannerObserver.observe(lastBanner);
    }
}

async function initInfiniteBannersSection() {
    const cached = sessionStorage.getItem('infinite_banners_cache');
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp < 30 * 60 * 1000) {
                allProductsList = data.products;
                hasMoreBanners = allProductsList.length > 0;
                const firstBanners = getRandomProducts(bannersPerLoad);
                renderBanners(firstBanners, false);
                initInfiniteBanners();
                return;
            }
        } catch (e) {}
    }
    
    await loadAllProductsForBanners();
    const firstBanners = getRandomProducts(bannersPerLoad);
    renderBanners(firstBanners, false);
    initInfiniteBanners();
}

// ============ BOUTON MISE À JOUR ============
async function refreshAllData() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.style.transform = 'rotate(180deg)';
        setTimeout(() => { refreshBtn.style.transform = ''; }, 500);
    }
    
    clearCache();
    
    const news = await loadNewsBanners();
    renderNewsBanners(news, true);
    
    // Recharger les bannières infinies
    await loadAllProductsForBanners();
    const firstBanners = getRandomProducts(bannersPerLoad);
    renderBanners(firstBanners, false);
    initInfiniteBanners();
    
    showToast('Actualités mises à jour', 'info');
}

function showToast(message, type = 'info') {
    let toast = document.getElementById('customToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'customToast';
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
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
    if (type === 'info') toast.style.background = '#5a9eff';
    if (type === 'success') toast.style.background = '#4ade80';
    
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}

// ============ INITIALISATION ============
async function init() {
    await showWelcome();
    
    let news = loadNewsFromSession();
    if (!news) {
        news = await loadNewsBanners();
        saveNewsToSession(news);
    }
    renderNewsBanners(news, false);
    
    const trendingProducts = await loadTrendingProducts();
    renderTrendingCarousel(trendingProducts);
    initTrendingCarousel();
    
    const markets = await loadMarkets();
    renderMarkets(markets);
    
    const topProducts = await loadTopProducts();
    renderTopProductsCarousel(topProducts);
    initTopCarousel();
    startTopCarousel();
    
    await renderFeaturedProduct();
    await initInfiniteBannersSection();
    
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshAllData);
    }
}

init();