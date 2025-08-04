document.addEventListener('DOMContentLoaded', () => {
    const initApp = async () => {
        // #############################################################################
        // # 1. DEFINE ALL FUNCTIONS
        // #############################################################################

        const appData = {
            restaurants: [],
            cart: [],
            orders: [],
            currentView: 'roleSelection',
            currentRestaurant: null,
            currentCategory: 'all',
            editingRestaurant: null,
            editingDish: null,
            selectedRestaurantForDish: null,
            user: null,
            profile: null
        };
        window.appData = appData;

        const SUPABASE_URL = 'https://ozpduwxtxtcirxcixrhd.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cGR1d3h0eHRjaXJ4Y2l4cmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDk2NzgsImV4cCI6MjA2OTg4NTY3OH0.iSDnVd4WGV_H5OQfBkVNp5uxy-zynoE3UlEawakWaII';
        const { createClient } = supabase;
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const loadComponent = async (component, containerId) => {
            try {
                const response = await fetch(`components/${component}.html`);
                if (!response.ok) throw new Error(`Failed to load component: ${component}`);
                const text = await response.text();
                const container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML += text;
                } else {
                    console.error(`Container with id ${containerId} not found.`);
                }
            } catch (error) {
                console.error(error);
            }
        };

        const showView = (viewName) => {
            const role = appData.profile?.role;

            if ((viewName === 'owner' || viewName === 'admin') && !appData.user) return showView('signIn');
            if (viewName === 'owner' && !['admin', 'owner'].includes(role)) return showView('customer');
            if (viewName === 'admin' && role !== 'admin') return showView('customer');

            appData.currentView = viewName;
            ['roleSelectionView', 'customerView', 'menuView', 'ownerView', 'adminView', 'signInView', 'signUpView', 'profileView'].forEach(v => {
                const el = document.getElementById(v);
                if (el) el.classList.add('hidden');
            });

            const activeView = document.getElementById(`${viewName}View`);
            if (activeView) activeView.classList.remove('hidden');

            updateNavUI();

            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            const activeNavItem = document.querySelector(`[data-view="${viewName}"]`);
            if (activeNavItem) activeNavItem.classList.add('active');

            if (appData.restaurants.length === 0 && !['roleSelection', 'signIn', 'signUp'].includes(viewName)) {
                loadInitialData();
            }
        };
        window.showView = showView;

        const updateNavUI = () => {
            const bottomNav = document.querySelector('.bottom-nav');
            const ownerNav = document.getElementById('ownerNav');
            const adminNav = document.getElementById('adminNav');
            const role = appData.profile?.role;
            const user = appData.user;

            if (!user || !role || role === 'customer' || ['signIn', 'signUp', 'roleSelection'].includes(appData.currentView)) {
                bottomNav.classList.add('hidden');
            } else {
                bottomNav.classList.remove('hidden');
            }

            if (ownerNav) ownerNav.classList.toggle('hidden', !['admin', 'owner'].includes(role));
            if (adminNav) adminNav.classList.toggle('hidden', role !== 'admin');
        };

        const handleAuthChange = async (session) => {
            appData.user = session ? session.user : null;
            if (appData.user) {
                let { data: profile, error } = await supabaseClient.from('profiles').select(`role`).eq('id', appData.user.id).single();
                if (error) {
                    console.error("Error fetching profile:", error);
                    appData.profile = null;
                } else {
                    appData.profile = profile;
                }
            } else {
                appData.profile = null;
            }
            updateViewForAuth();
        };

        const updateViewForAuth = () => {
            const user = appData.user;
            const profile = appData.profile;
            const currentView = appData.currentView;

            if (user && profile) {
                if (['roleSelection', 'signIn', 'signUp'].includes(currentView)) {
                    if (profile.role === 'admin') showView('admin');
                    else if (profile.role === 'owner') showView('owner');
                    else showView('customer');
                }
            } else if (!user) {
                if (['owner', 'admin', 'profile'].includes(currentView)) {
                    showView('roleSelection');
                }
            }
            updateNavUI();
        };

        const attachEventListeners = () => {
            document.getElementById('customerBtn').addEventListener('click', () => showView('customer'));
            document.getElementById('ownerBtn').addEventListener('click', () => showView('signIn'));
            document.getElementById('adminBtn').addEventListener('click', () => showView('signIn'));

            const signUpLink = document.getElementById('showSignUpLink');
            if(signUpLink) signUpLink.addEventListener('click', (e) => { e.preventDefault(); showView('signUp'); });

            const signInLink = document.getElementById('showSignInLink');
            if(signInLink) signInLink.addEventListener('click', (e) => { e.preventDefault(); showView('signIn'); });

            const loginForm = document.getElementById('loginForm');
            if(loginForm) loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) showToast('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'danger');
            });

            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', () => {
                    const view = item.getAttribute('data-view');
                    if (view) showView(view);
                });
            });

            const logoutBtn = document.getElementById('logoutBtn');
            if(logoutBtn) logoutBtn.addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
            });

            window.showCheckoutModal = () => {
                document.getElementById('finalTotal').textContent = formatPrice(calculateCartTotal());
                showModal('checkoutModal');
            };

            const checkoutBtn = document.getElementById('checkoutBtn');
            if(checkoutBtn) checkoutBtn.addEventListener('click', () => {
                hideModal('cartModal');
                showCheckoutModal();
            });

            const closeCheckoutModal = document.getElementById('closeCheckoutModal');
            if(closeCheckoutModal) closeCheckoutModal.addEventListener('click', () => hideModal('checkoutModal'));

            const paymentMethod = document.getElementById('paymentMethod');
            if(paymentMethod) paymentMethod.addEventListener('change', (e) => {
                const proofSection = document.getElementById('paymentProofSection');
                if (e.target.value === 'electronic') {
                    proofSection.classList.remove('hidden');
                } else {
                    proofSection.classList.add('hidden');
                }
            });

            const checkoutForm = document.getElementById('checkoutForm');
            if(checkoutForm) checkoutForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('customerName').value;
                const phone = document.getElementById('customerPhone').value;
                const address = document.getElementById('customerAddress').value;
                const paymentMethod = document.getElementById('paymentMethod').value;

                try {
                    const { error } = await supabaseClient.functions.invoke('create-customer-and-order', {
                        body: { name, phone, address, cart: appData.cart, paymentMethod, paymentProofUrl: null },
                    });
                    if (error) throw error;
                    hideModal('checkoutModal');
                    showModal('successModal');
                    appData.cart = [];
                    updateCartCount();
                    renderCart();
                } catch (error) {
                    console.error('Error creating order:', error);
                    showToast('حدث خطأ أثناء إنشاء الطلب', 'danger');
                }
            });
        };

        const loadInitialData = async () => {
            let { data: restaurants, error } = await supabaseClient.from('restaurants').select(`*, dishes (*)`).order('id');
            if (error) return console.error('Error fetching restaurants:', error);
            appData.restaurants = restaurants.map(r => ({ ...r, menu: r.dishes || [] }));
            renderRestaurants();
        };

        const renderRestaurants = () => {
            const grid = document.getElementById('restaurantGrid');
            if (!grid) return;
            grid.innerHTML = appData.restaurants.map(restaurant => `
                <div class="card-compact" onclick="window.showRestaurantMenu(${restaurant.id})">
                    </div>
                </div>
            `).join('');
        };

        const formatPrice = (price) => `${price.toLocaleString()} أوقية`;
        const showToast = (message, type = 'success') => {
            const toast = document.createElement('div');
            toast.className = `fixed top-16 right-4 ${type === 'danger' ? 'bg-danger' : 'bg-accent'} text-white px-4 py-2 rounded-lg text-sm z-50 fade-in`;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        };
        const showModal = (modalId) => {
            const modal = document.getElementById(modalId);
            if(modal) modal.classList.remove('hidden');
        };
        const hideModal = (modalId) => {
            const modal = document.getElementById(modalId);
            if(modal) modal.classList.add('hidden');
        };
        const updateCartCount = () => {
            const count = appData.cart.reduce((sum, item) => sum + item.quantity, 0);
            if(document.getElementById('cartCount')) document.getElementById('cartCount').textContent = count;
        };
        const calculateCartTotal = () => appData.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const renderCart = () => {
            const cartItems = document.getElementById('cartItems');
            if(!cartItems) return;
            if (appData.cart.length === 0) {
                cartItems.innerHTML = `<div class="text-center py-8 text-gray-500">السلة فارغة</div>`;
                document.getElementById('cartTotal').textContent = '0 أوقية';
                return;
            }
            cartItems.innerHTML = appData.cart.map(item => `
                <div>${item.name} - ${item.quantity}</div>
            `).join('');
            document.getElementById('cartTotal').textContent = formatPrice(calculateCartTotal());
        };


        // #############################################################################
        // # 2. LOAD COMPONENTS
        // #############################################################################
        const componentsToLoad = [
            { name: 'header', container: 'header-container' },
            { name: 'role-selection-view', container: 'main-container' },
            { name: 'customer-view', container: 'main-container' },
            { name: 'restaurant-menu-view', container: 'main-container' },
            { name: 'owner-view', container: 'main-container' },
            { name: 'admin-view', container: 'main-container' },
            { name: 'sign-in-view', container: 'main-container' },
            { name: 'sign-up-view', container: 'main-container' },
            { name: 'profile-view', container: 'main-container' },
            { name: 'bottom-nav', container: 'bottom-nav-container' },
            { name: 'cart-modal', container: 'modals-container' },
            { name: 'checkout-modal', container: 'modals-container' },
            { name: 'success-modal', container: 'modals-container' },
            { name: 'restaurant-form-modal', container: 'modals-container' },
            { name: 'dish-form-modal', container: 'modals-container' },
            { name: 'confirm-delete-modal', container: 'modals-container' }
        ];
        await Promise.all(componentsToLoad.map(c => loadComponent(c.name, c.container)));


        // #############################################################################
        // # 3. ATTACH EVENT LISTENERS
        // #############################################################################
        attachEventListeners();


        // #############################################################################
        // # 4. INITIALIZE AUTH AND SHOW VIEW
        // #############################################################################
        const { data: { session } } = await supabaseClient.auth.getSession();
        await handleAuthChange(session);
        supabaseClient.auth.onAuthStateChange((_, session) => handleAuthChange(session));

        showView(appData.currentView);
    };

    initApp();
});
