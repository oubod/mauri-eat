document.addEventListener('DOMContentLoaded', () => {
    const loadComponent = async (component, container) => {
        try {
            const response = await fetch(`components/${component}.html`);
            if (!response.ok) throw new Error(`Failed to load component: ${component}`);
            const text = await response.text();
            document.getElementById(container).innerHTML += text;
        } catch (error) {
            console.error(error);
        }
    };

    const initApp = async () => {
        const components = [
            { name: 'header', container: 'header-container' },
            { name: 'role-selection-view', container: 'main-container' },
            { name: 'customer-view', container: 'main-container' },
            { name: 'restaurant-menu-view', container: 'main-container' },
            { name: 'owner-view', container: 'main-container' },
            { name: 'admin-view', container: 'main-container' },
            { name: 'sign-in-view', container: 'main-container' },
            { name: 'sign-up-view', container: 'main-container' },
            { name: 'bottom-nav', container: 'bottom-nav-container' },
            { name: 'cart-modal', container: 'modals-container' },
            { name: 'checkout-modal', container: 'modals-container' },
            { name: 'success-modal', container: 'modals-container' },
            { name: 'restaurant-form-modal', container: 'modals-container' },
            { name: 'dish-form-modal', container: 'modals-container' },
            { name: 'confirm-delete-modal', container: 'modals-container' }
        ];

        for (const { name, container } of components) {
            await loadComponent(name, container);
        }

        const SUPABASE_URL = 'https://ozpduwxtxtcirxcixrhd.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cGR1d3h0eHRjaXJ4Y2l4cmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDk2NzgsImV4cCI6MjA2OTg4NTY3OH0.iSDnVd4WGV_H5OQfBkVNp5uxy-zynoE3UlEawakWaII';
        const { createClient } = supabase;
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const appData = {
            restaurants: [], cart: [], orders: [], currentView: 'roleSelection',
            currentRestaurant: null, currentCategory: 'all', editingRestaurant: null,
            editingDish: null, selectedRestaurantForDish: null, user: null, profile: null
        };

        window.appData = appData;

        const formatPrice = (price) => `${price.toLocaleString()} أوقية`;
        const generateStars = (rating) => {
            let stars = '';
            for (let i = 0; i < 5; i++) stars += `<span class="text-yellow-400">${i < Math.floor(rating) ? '★' : '☆'}</span>`;
            return stars;
        };
        const updateCartCount = () => {
            const count = appData.cart.reduce((sum, item) => sum + item.quantity, 0);
            if(document.getElementById('cartCount')) document.getElementById('cartCount').textContent = count;
        };
        const calculateCartTotal = () => appData.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const getImageSource = (item) => item.image_url || item.photo_url || null;
        const showToast = (message, type = 'success') => {
            const toast = document.createElement('div');
            toast.className = `fixed top-16 right-4 ${type === 'danger' ? 'bg-danger' : 'bg-accent'} text-white px-4 py-2 rounded-lg text-sm z-50 fade-in`;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        };
        const showModal = (modalId) => {
            const modal = document.getElementById(modalId);
            if(modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        };
        const hideModal = (modalId) => {
            const modal = document.getElementById(modalId);
            if(modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        };
        const renderRestaurants = (restaurants = appData.restaurants) => {
            const grid = document.getElementById('restaurantGrid');
            if(!grid) return;
            grid.innerHTML = restaurants.map(restaurant => `
                <div class="card-compact rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 ${!restaurant.is_open ? 'grayscale' : ''}" onclick="window.showRestaurantMenu(${restaurant.id})">
                    <div class="h-32 bg-gray-200 relative">
                        <img src="${getImageSource(restaurant) || 'https://placehold.co/600x400/e2e8f0/e2e8f0'}" alt="${restaurant.name}" class="w-full h-full object-cover">
                        ${!restaurant.is_open ? `<div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"><span class="text-white font-bold text-lg">مغلق</span></div>` : ''}
                    </div>
                    <div class="p-4">
                        <div class="flex justify-between items-start">
                            <h3 class="font-semibold text-lg text-gray-900 truncate">${restaurant.name}</h3>
                            <span class="status-badge ${restaurant.is_open ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${restaurant.is_open ? 'مفتوح' : 'مغلق'}</span>
                        </div>
                        <div class="flex items-center gap-2 mt-1 text-sm">
                            <div class="flex items-center gap-1">${generateStars(restaurant.rating)}<span class="text-gray-600">${restaurant.rating}</span></div>
                            <span class="text-gray-500">•</span>
                            <span class="text-gray-500">${restaurant.delivery_time}</span>
                        </div>
                        <p class="text-sm text-gray-500 mt-2 truncate">${restaurant.description}</p>
                    </div>
                </div>
            `).join('');
        };
        const renderPopularDishes = () => {
            const allDishes = appData.restaurants.flatMap(restaurant =>
                restaurant.menu.map(item => ({...item, restaurantName: restaurant.name, restaurantId: restaurant.id}))
            );
            const popularDishes = allDishes.sort(() => 0.5 - Math.random()).slice(0, 6);
            const container = document.getElementById('popularDishes')?.querySelector('.grid');
            if(!container) return;
            container.innerHTML = popularDishes.map(dish => `
                <div class="card-compact rounded-xl overflow-hidden shadow-sm">
                    <div class="flex items-center gap-4 p-3">
                        <div class="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <img src="${getImageSource(dish) || 'https://placehold.co/400x400/e2e8f0/e2e8f0'}" alt="${dish.name}" class="w-full h-full object-cover">
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-semibold text-base text-gray-900">${dish.name}</h4>
                            <p class="text-sm text-gray-500 truncate mt-1">${dish.description}</p>
                            <div class="flex items-center justify-between mt-2">
                                <span class="font-bold text-lg text-secondary">${formatPrice(dish.price)}</span>
                                <button onclick="window.addToCart(${dish.id})" class="btn btn-primary text-sm">
                                    إضافة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        };
        const renderMenuItems = (restaurant) => {
            document.getElementById('restaurantHeader').innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="w-24 h-24 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                         <img src="${getImageSource(restaurant) || 'https://placehold.co/600x400/e2e8f0/e2e8f0'}" alt="${restaurant.name}" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1">
                        <h2 class="font-bold text-2xl text-gray-900">${restaurant.name}</h2>
                        <p class="text-sm text-gray-600 mt-1">${restaurant.description}</p>
                        <div class="flex items-center gap-3 mt-2 text-sm">
                            <div class="flex items-center gap-1">${generateStars(restaurant.rating)}<span class="text-gray-600">${restaurant.rating}</span></div>
                            <span class="text-gray-500">🕐 ${restaurant.delivery_time}</span>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('menuItems').innerHTML = restaurant.menu.map(item => `
                <div class="card-compact rounded-xl overflow-hidden shadow-sm">
                    <div class="flex items-center gap-4 p-3">
                        <div class="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <img src="${getImageSource(item) || 'https://placehold.co/400x400/e2e8f0/e2e8f0'}" alt="${item.name}" class="w-full h-full object-cover">
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-semibold text-base text-gray-900">${item.name}</h4>
                            <p class="text-sm text-gray-500 truncate mt-1">${item.description}</p>
                            <div class="flex items-center justify-between mt-2">
                                <span class="font-bold text-lg text-secondary">${formatPrice(item.price)}</span>
                                <button onclick="window.addToCart(${item.id})" class="btn btn-primary text-sm">
                                    إضافة للسلة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        };
        const renderCart = () => {
            const cartItems = document.getElementById('cartItems');
            if (appData.cart.length === 0) {
                cartItems.innerHTML = `<div class="text-center py-8 text-gray-500"><span class="text-4xl block mb-3">🛒</span><p class="text-sm">السلة فارغة</p></div>`;
                document.getElementById('cartTotal').textContent = '0 أوقية';
                return;
            }
            cartItems.innerHTML = appData.cart.map(item => `
                <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded overflow-hidden bg-gray-100 flex items-center justify-center">${getImageDisplay(item, 'small')}</div>
                        <div>
                            <h5 class="font-medium text-sm text-gray-900">${item.name}</h5>
                            <p class="text-xs text-secondary">${formatPrice(item.price)}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="window.updateCartItemQuantity(${item.id}, ${item.quantity - 1})" class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs">-</button>
                        <span class="w-6 text-center text-sm font-medium">${item.quantity}</span>
                        <button onclick="window.updateCartItemQuantity(${item.id}, ${item.quantity + 1})" class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs">+</button>
                    </div>
                </div>
            `).join('');
            document.getElementById('cartTotal').textContent = formatPrice(calculateCartTotal());
        };
        const loadInitialData = async () => {
            console.log("Fetching data from Supabase...");
            let { data: restaurants, error } = await supabaseClient.from('restaurants').select(`*, dishes (*)`).order('id');
            if (error) return console.error('Error fetching restaurants:', error);
            appData.restaurants = restaurants.map(r => ({ ...r, menu: r.dishes || [] }));
            renderRestaurants();
            renderPopularDishes();
            populateRestaurantSelect();
            console.log("Data loaded and rendered.");
        };
        const showView = (viewName) => {
            const role = appData.profile?.role;
            const bottomNav = document.querySelector('.bottom-nav');
            if ((viewName === 'owner' || viewName === 'admin') && !appData.user) return showView('signIn');
            if (viewName === 'owner' && !['admin', 'owner'].includes(role)) return showView('customer');
            if (viewName === 'admin' && role !== 'admin') return showView('customer');
            appData.currentView = viewName;
            ['roleSelectionView', 'customerView', 'menuView', 'ownerView', 'adminView', 'signInView', 'signUpView'].forEach(v => {
                const el = document.getElementById(v);
                if(el) el.classList.add('hidden');
            });
            if (['roleSelection', 'signIn', 'signUp'].includes(viewName)) bottomNav.classList.add('hidden');
            else bottomNav.classList.remove('hidden');
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            const activeView = document.getElementById(`${viewName}View`);
            if(activeView) activeView.classList.remove('hidden');
            const activeNavItem = document.querySelector(`[data-view="${viewName}"]`);
            if(activeNavItem) activeNavItem.classList.add('active');
            if (viewName === 'customer' && appData.restaurants.length === 0) loadInitialData();
            else if (viewName === 'owner') renderOwnerRestaurantStatus();
            else if (viewName === 'admin') renderRestaurantsManagement();
        };
        window.showView = showView;
        window.showRestaurantMenu = (id) => {
            const restaurant = appData.restaurants.find(r => r.id === id);
            if (!restaurant) return;
            appData.currentRestaurant = restaurant;
            showView('menu');
            renderMenuItems(restaurant);
        };
        window.addToCart = (itemId) => {
            let item = null;
            for (const restaurant of appData.restaurants) {
                item = restaurant.menu.find(menuItem => menuItem.id === itemId);
                if (item) break;
            }
            if (!item) return;
            const existingItem = appData.cart.find(cartItem => cartItem.id === itemId);
            if (existingItem) existingItem.quantity += 1;
            else appData.cart.push({ ...item, quantity: 1 });
            updateCartCount();
            showToast('تم إضافة الطبق للسلة');
        };
        window.updateCartItemQuantity = (itemId, newQuantity) => {
            if (newQuantity <= 0) appData.cart = appData.cart.filter(item => item.id !== itemId);
            else {
                const item = appData.cart.find(item => item.id === itemId);
                if (item) item.quantity = newQuantity;
            }
            updateCartCount();
            renderCart();
        };

        const handleAuthChange = async (session) => {
            appData.user = session ? session.user : null;
            if (appData.user) {
                let { data, error } = await supabaseClient.from('profiles').select(`role`).eq('id', appData.user.id).single();
                if (error) {
                    console.error("Error fetching profile:", error);
                    appData.profile = null;
                } else {
                    appData.profile = data;
                }
            } else {
                appData.profile = null;
            }
            updateNavUI(appData.user, appData.profile);
        };

        const updateNavUI = (user, profile) => {
            const ownerNav = document.getElementById('ownerNav');
            const adminNav = document.getElementById('adminNav');
            if (user) {
                ownerNav.classList.toggle('hidden', !['admin', 'owner'].includes(profile?.role));
                adminNav.classList.toggle('hidden', profile?.role !== 'admin');
            } else {
                ownerNav.classList.add('hidden');
                adminNav.classList.add('hidden');
            }
        };

        updateCartCount();
        const { data: { session } } = await supabaseClient.auth.getSession();
        await handleAuthChange(session);
        supabaseClient.auth.onAuthStateChange((event, session) => handleAuthChange(session));

        document.getElementById('customerBtn').addEventListener('click', () => showView('customer'));
        document.getElementById('ownerBtn').addEventListener('click', () => showView('signIn'));
        document.getElementById('adminBtn').addEventListener('click', () => showView('signIn'));
        document.getElementById('showSignUpLink').addEventListener('click', (e) => { e.preventDefault(); showView('signUp'); });
        document.getElementById('showSignInLink').addEventListener('click', (e) => { e.preventDefault(); showView('signIn'); });
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) showToast('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'danger');
            else {
                await handleAuthChange(data.session);
                if (appData.profile?.role === 'admin') showView('admin');
                else if (appData.profile?.role === 'owner') showView('owner');
                else showView('customer');
            }
        });
    };

    initApp();
});
