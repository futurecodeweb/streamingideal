document.addEventListener('DOMContentLoaded', () => {
    let dollarRate = 0;
    let products = [];
    const whatsappNumber = '584129386149';
    let cart = [];
    let selectedPaymentMethod = '';
    let selectedGiftcardPrice = null;

    let currentSlide = 0;
    const tmdbApiKey = '65aa5b7946592f4674d9d2115569d584';

    const searchInput = document.getElementById('search-input');
    const searchSuggestionsList = document.getElementById('search-suggestions');

    // ** Lógica para obtener la tasa BCV **
    const fetchDollarRate = async () => {
        try {
            const version = new Date().getTime();
            const tasaUrl = `https://streamingideal.github.io/tasabcv/?v=${version}`;
            const response = await fetch(tasaUrl);
            const htmlText = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const rateElement = doc.getElementById('tasa-bcv-valor');
            if (rateElement) {
                const rate = parseFloat(rateElement.innerText.replace(',', '.'));
                if (!isNaN(rate)) {
                    dollarRate = rate;
                    document.getElementById('dollar-rate-display').innerText = dollarRate.toFixed(2);
                    updatePrices();
                } else {
                    console.error('El valor de la tasa no es un número válido.');
                    document.getElementById('dollar-rate-display').innerText = 'Error al cargar';
                }
            } else {
                console.error('No se encontró el elemento con el ID "tasa-bcv-valor".');
                document.getElementById('dollar-rate-display').innerText = 'No disponible';
            }
        } catch (error) {
            console.error('Error al obtener la tasa del dólar:', error);
            document.getElementById('dollar-rate-display').innerText = 'Error de conexión';
        }
    };

    // ** Lógica para cargar productos **
    const fetchProducts = async () => {
        try {
            const version = new Date().getTime();
            // LA RUTA CORREGIDA: Asumiendo que 'data' está en la misma carpeta que 'index.html'.
            // Si el archivo 'index.html' está en la raíz, esta ruta funcionará.
            const response = await fetch(`./data/productos.json?v=${version}`);
            if (!response.ok) {
                throw new Error(`Error al cargar productos: ${response.status}`);
            }
            products = await response.json();
            renderProducts();
            fetchDollarRate();
        } catch (error) {
            console.error('No se pudo cargar el archivo de productos:', error);
            document.getElementById('product-container').innerHTML = '<p style="text-align:center;">Error al cargar los productos. Por favor, inténtelo de nuevo más tarde.</p>';
        }
    };

    const renderProducts = () => {
        const productContainer = document.getElementById('product-container');
        productContainer.innerHTML = '';
        products.forEach(product => {
            const productDiv = document.createElement('div');
            productDiv.classList.add('product');
            if (product.stock === false) {
                productDiv.classList.add('out-of-stock');
            }
            productDiv.setAttribute('data-product-name', product.name);
            productDiv.innerHTML = `
                <img src="${product.imgUrl}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <p class="price" data-usd-price="${product.usdPrice}">${product.stock ? `$${product.usdPrice}` : 'SIN STOCK'}</p>
                <p class="price-bs">Bs <span id="price-bs-${product.id}">0.00</span></p>
                <div class="product-buttons">
                    <button class="add-to-cart-button" onclick="handleAddToCartClick(${product.id})" ${product.stock ? '' : 'disabled'}>Añadir al carrito</button>
                    ${product.type === 'streaming' ?
                        `<button class="view-details-button" onclick="showSuggestionsModal('${product.name}')" ${product.stock ? '' : 'disabled'}>Sugerencias</button>` :
                        `<button class="view-details-button" onclick="showDetailsModal(${product.id})" ${product.stock ? '' : 'disabled'}>Detalles</button>`
                    }
                </div>
            `;
            productContainer.appendChild(productDiv);
        });
    };

    const handleAddToCartClick = (productId) => {
        const product = products.find(p => p.id === productId);
        if (product.type === 'streaming') {
            addToCart(productId);
        }
    };

    const updatePrices = () => {
        products.forEach(product => {
            const priceElement = document.getElementById(`price-bs-${product.id}`);
            if (priceElement && product.usdPrice > 0) {
                const bsPrice = (product.usdPrice * dollarRate).toFixed(2);
                priceElement.innerText = bsPrice;
            }
        });
        updateCartUI();
        if (document.getElementById('details-modal').style.display === 'block' && selectedGiftcardPrice) {
            updateDetailsModalPrice(selectedGiftcardPrice.realPrice);
        }
    };

    const filterProducts = (event) => {
        const searchTerm = searchInput.value.toLowerCase();
        const productElements = document.querySelectorAll('.product');
        const exchangeRateInfo = document.querySelector('.exchange-rate-info');

        if (searchTerm.length > 0) {
            exchangeRateInfo.style.display = 'none';
        } else {
            exchangeRateInfo.style.display = 'block';
        }

        productElements.forEach(productEl => {
            const productName = productEl.getAttribute('data-product-name').toLowerCase();
            if (productName.includes(searchTerm)) {
                productEl.style.display = 'flex';
            } else {
                productEl.style.display = 'none';
            }
        });
    };

    const addToCart = (productId, selectedPrice = null) => {
        const product = products.find(p => p.id === productId);
        if (product && product.stock) {
            let itemToAdd = { ...product };
            let itemName = product.name;
            let itemPrice = product.usdPrice;

            if (selectedPrice) {
                itemToAdd.usdPrice = selectedPrice.realPrice;
                itemToAdd.denomination = selectedPrice.denomination;
                itemName = `${product.name} (${selectedPrice.denomination}$)`;
                itemPrice = selectedPrice.realPrice;
            }

            const existingItem = cart.find(item => item.id === itemToAdd.id && item.denomination === itemToAdd.denomination);
            if (existingItem) {
                existingItem.quantity++;
            } else {
                cart.push({ ...itemToAdd, quantity: 1, name: itemName, usdPrice: itemPrice });
            }
            saveCartToStorage();
            updateCartUI();
            showNotification(`${itemName} ha sido añadido al carrito.`);
            launchConfetti();
        } else if (product && !product.stock) {
            showNotification(`${product.name} no está disponible actualmente.`);
        }
    };

    const updateCartItemQuantity = (itemId, change) => {
        const item = cart.find(p => p.id === itemId);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                cart = cart.filter(p => p.id !== itemId);
            }
            saveCartToStorage();
            updateCartUI();
        }
    };

    const clearCart = () => {
        cart = [];
        selectedPaymentMethod = '';
        saveCartToStorage();
        updateCartUI();
        showNotification('El carrito ha sido vaciado.');
    };

    const updateCartUI = () => {
        const cartItemsList = document.getElementById('cart-items');
        const whatsappButton = document.getElementById('whatsapp-button');
        const clearCartButton = document.getElementById('clear-cart-button');
        const selectPaymentButton = document.getElementById('select-payment-button');

        cartItemsList.innerHTML = '';
        let totalUSD = 0;
        let totalItems = 0;

        if (cart.length === 0) {
            cartItemsList.innerHTML = '<li>El carrito está vacío.</li>';
            whatsappButton.classList.add('disabled');
            clearCartButton.disabled = true;
            selectPaymentButton.disabled = true;
        } else {
            whatsappButton.classList.remove('disabled');
            clearCartButton.disabled = false;
            selectPaymentButton.disabled = false;
            cart.forEach(item => {
                const subtotalUSD = item.usdPrice * item.quantity;
                const subtotalBS = (subtotalUSD * dollarRate).toFixed(2);
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="cart-item-info">
                        <span>${item.name} (${item.quantity})</span>
                        <span class="item-price">$${subtotalUSD.toFixed(2)} (Bs ${subtotalBS})</span>
                    </div>
                    <div class="quantity-control">
                        <button onclick="updateCartItemQuantity(${item.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="updateCartItemQuantity(${item.id}, 1)">+</button>
                    </div>
                `;
                cartItemsList.appendChild(li);
                totalUSD += subtotalUSD;
                totalItems += item.quantity;
            });
        }
        const totalBS = (totalUSD * dollarRate).toFixed(2);
        document.getElementById('cart-total-usd').innerText = totalUSD.toFixed(2);
        document.getElementById('cart-total-bs').innerText = totalBS;
        document.getElementById('cart-count').innerText = totalItems;
        prepareWhatsappLink();
    };

    const saveCartToStorage = () => {
        sessionStorage.setItem('shoppingCart', JSON.stringify(cart));
    };

    const loadCartFromStorage = () => {
        const storedCart = sessionStorage.getItem('shoppingCart');
        if (storedCart) {
            cart = JSON.parse(storedCart);
            updateCartUI();
        }
    };

    const showCart = () => {
        document.getElementById('cart-modal').style.display = 'block';
    };

    const closeCart = () => {
        document.getElementById('cart-modal').style.display = 'none';
    };

    const prepareWhatsappLink = () => {
        const whatsappButton = document.getElementById('whatsapp-button');
        if (cart.length > 0 && selectedPaymentMethod) {
            const message = generateWhatsappMessage();
            const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
            whatsappButton.href = url;
            whatsappButton.classList.remove('disabled');
        } else {
            whatsappButton.href = '#';
            whatsappButton.classList.add('disabled');
        }
    };

    const generateWhatsappMessage = () => {
        let message = '¡Hola! Me gustaría hacer un pedido.\n\n';
        let totalUSD = 0;
        message += 'Productos:\n';
        cart.forEach(item => {
            const subtotalUSD = item.usdPrice * item.quantity;
            const subtotalBS = (subtotalUSD * dollarRate).toFixed(2);
            message += `- ${item.name} (${item.quantity}) - $${subtotalUSD.toFixed(2)} / Bs ${subtotalBS}\n`;
            totalUSD += subtotalUSD;
        });
        const totalBS = (totalUSD * dollarRate).toFixed(2);
        message += `\nTotal: $${totalUSD.toFixed(2)} (Bs ${totalBS})`;
        message += `\n\nMétodo de pago: ${selectedPaymentMethod}`;
        message += `\n\nPor favor, indícame los pasos para completar la compra.`;
        return message;
    };

    const selectPaymentMethod = (card) => {
        const allCards = document.querySelectorAll('.payment-method-card');
        allCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedPaymentMethod = card.getAttribute('data-method');
        closePaymentMethods();
        prepareWhatsappLink();
        showNotification(`Método de pago seleccionado: ${selectedPaymentMethod}`);
    };

    const closeSplashScreen = () => {
        document.getElementById('splash-screen').style.display = 'none';
    };

    const showNotification = (message) => {
        const notification = document.getElementById('notification-message');
        notification.innerText = message;
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    };

    const toggleFixedButtons = (show) => {
        const buttons = document.querySelectorAll('.fixed-button');
        buttons.forEach(button => {
            if (show) {
                button.classList.remove('hidden');
            } else {
                button.classList.add('hidden');
            }
        });
    };

    const toggleSocialMenu = () => {
        const socialMenu = document.getElementById('social-menu');
        socialMenu.style.display = socialMenu.style.display === 'block' ? 'none' : 'block';
    };

    const closeSocialMenu = () => {
        document.getElementById('social-menu').style.display = 'none';
    };

    const togglePaymentMethods = () => {
        const paymentModal = document.getElementById('payment-methods-modal');
        paymentModal.style.display = paymentModal.style.display === 'block' ? 'none' : 'block';
    };

    const closePaymentMethods = () => {
        document.getElementById('payment-methods-modal').style.display = 'none';
    };

    const showSuggestionsModal = (serviceName) => {
        const modal = document.getElementById('suggestions-modal');
        const title = document.getElementById('suggestions-title');
        const product = products.find(p => p.name === serviceName);
        if (!product || !product.suggestions || product.type !== 'streaming') {
            console.error("No se encontraron sugerencias para este servicio.");
            return;
        }
        title.innerText = `Sugerencias para ${serviceName}`;
        renderSuggestionsSlides(product.suggestions);
        modal.style.display = 'block';
        toggleFixedButtons(false);
    };

    const closeSuggestionsModal = () => {
        document.getElementById('suggestions-modal').style.display = 'none';
        toggleFixedButtons(true);
        currentSlide = 0;
    };

    const renderSuggestionsSlides = (movieList) => {
        const carouselContainer = document.getElementById('suggestions-carousel-slides');
        carouselContainer.innerHTML = '';
        movieList.forEach(movie => {
            const slide = document.createElement('div');
            slide.classList.add('carousel-slide');
            slide.innerHTML = `
                <div class="movie-image-container">
                    <img src="${movie.imageUrl}" alt="${movie.title}">
                </div>
                <div class="synopsis-buttons">
                    <button class="synopsis-button" onclick="showSynopsis(${movie.id}, '${movie.title}', '${movie.trailerUrl}')">Sinopsis</button>
                    <button class="trailer-button" onclick="showTrailer('${movie.title}', '${movie.trailerUrl}')">Tráiler</button>
                </div>
            `;
            carouselContainer.appendChild(slide);
        });
    };

    const changeSlide = (direction) => {
        const slides = document.querySelectorAll('#suggestions-carousel-slides .carousel-slide');
        currentSlide = (currentSlide + direction + slides.length) % slides.length;
        document.getElementById('suggestions-carousel-slides').style.transform = `translateX(-${currentSlide * 100}%)`;
    };

    const showSynopsis = async (movieId, movieTitle) => {
        const synopsisModal = document.getElementById('synopsis-modal');
        const synopsisTitle = document.getElementById('synopsis-title');
        const synopsisText = document.getElementById('synopsis-text');

        synopsisTitle.innerText = `Cargando...`;
        synopsisText.innerText = '';
        synopsisModal.style.display = 'block';

        const movieData = await getMovieSynopsis(movieId);
        if (movieData) {
            synopsisTitle.innerText = movieTitle;
            synopsisText.innerText = movieData.overview;
        } else {
            synopsisTitle.innerText = 'Error';
            synopsisText.innerText = 'No se pudo cargar la sinopsis. Intente de nuevo más tarde.';
        }
    };

    const getMovieSynopsis = async (movieId) => {
        const url = `https://api.themoviedb.org/3/movie/${tmdbApiKey}?api_key=${movieId}&language=es-MX`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error al obtener la sinopsis:", error);
            return null;
        }
    };

    const closeSynopsis = () => {
        document.getElementById('synopsis-modal').style.display = 'none';
    };

    const showTrailer = (movieTitle, trailerUrl) => {
        const trailerModal = document.getElementById('trailer-modal');
        const trailerTitle = document.getElementById('trailer-title');
        const youtubePlayer = document.getElementById('youtube-player');
        trailerTitle.innerText = `Tráiler de ${movieTitle}`;
        youtubePlayer.src = trailerUrl + '?autoplay=1'; 
        trailerModal.style.display = 'block';
    };

    const closeTrailer = () => {
        const trailerModal = document.getElementById('trailer-modal');
        const youtubePlayer = document.getElementById('youtube-player');
        youtubePlayer.src = ''; 
        trailerModal.style.display = 'none';
    };

    const showDetailsModal = (productId) => {
        const product = products.find(p => p.id === productId);
        if (!product || product.type !== 'giftcard') return;

        const detailsModal = document.getElementById('details-modal');
        document.getElementById('details-product-img').src = product.imgUrl;
        document.getElementById('details-product-img').alt = product.name;
        document.getElementById('details-product-name').innerText = product.name;
        document.getElementById('details-product-description').innerText = product.details;
        
        const priceOptionsContainer = document.getElementById('price-options-container');
        priceOptionsContainer.innerHTML = '';
        product.prices.forEach(priceOption => {
            const button = document.createElement('button');
            button.classList.add('price-option-button');
            button.innerText = `$${priceOption.denomination}`;
            button.onclick = () => selectGiftcardPrice(priceOption, productId);
            priceOptionsContainer.appendChild(button);
        });

        document.getElementById('details-price-usd').innerText = '0.00';
        document.getElementById('details-price-bs').innerText = '0.00';
        document.getElementById('add-to-cart-details-button').disabled = true;

        detailsModal.style.display = 'block';
        toggleFixedButtons(false);
    };

    const closeDetailsModal = () => {
        document.getElementById('details-modal').style.display = 'none';
        selectedGiftcardPrice = null;
        toggleFixedButtons(true);
    };

    const selectGiftcardPrice = (priceOption, productId) => {
        selectedGiftcardPrice = priceOption;
        const allPriceButtons = document.querySelectorAll('.price-option-button');
        allPriceButtons.forEach(btn => btn.classList.remove('selected'));
        const selectedButton = Array.from(allPriceButtons).find(btn => btn.innerText.includes(`${priceOption.denomination}`));
        if (selectedButton) {
            selectedButton.classList.add('selected');
        }
        
        updateDetailsModalPrice(priceOption.realPrice);
        document.getElementById('add-to-cart-details-button').disabled = false;
        document.getElementById('add-to-cart-details-button').onclick = () => {
            addToCart(productId, selectedGiftcardPrice);
            closeDetailsModal();
        };
    };

    const updateDetailsModalPrice = (usdPrice) => {
        const bsPrice = (usdPrice * dollarRate).toFixed(2);
        document.getElementById('details-price-usd').innerText = usdPrice.toFixed(2);
        document.getElementById('details-price-bs').innerText = bsPrice;
    };

    const launchConfetti = () => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    };
    
    // ** Asignación de funciones al objeto window para que el HTML pueda llamarlas **
    window.closeSplashScreen = closeSplashScreen;
    window.showCart = showCart;
    window.closeCart = closeCart;
    window.toggleSocialMenu = toggleSocialMenu;
    window.closeSocialMenu = closeSocialMenu;
    window.togglePaymentMethods = togglePaymentMethods;
    window.closePaymentMethods = closePaymentMethods;
    window.addToCart = addToCart;
    window.handleAddToCartClick = handleAddToCartClick;
    window.updateCartItemQuantity = updateCartItemQuantity;
    window.clearCart = clearCart;
    window.filterProducts = filterProducts;
    window.showSuggestionsModal = showSuggestionsModal;
    window.closeSuggestionsModal = closeSuggestionsModal;
    window.changeSlide = changeSlide;
    window.showSynopsis = showSynopsis;
    window.closeSynopsis = closeSynopsis;
    window.showTrailer = showTrailer;
    window.closeTrailer = closeTrailer;
    window.selectPaymentMethod = selectPaymentMethod;
    window.showDetailsModal = showDetailsModal;
    window.closeDetailsModal = closeDetailsModal;
    window.selectGiftcardPrice = selectGiftcardPrice;

    // ** Event Listeners **
    loadCartFromStorage();
    fetchProducts();

    document.getElementById('close-cart-modal').addEventListener('click', closeCart);
    document.getElementById('cart-modal').addEventListener('click', (e) => {
        if (e.target.id === 'cart-modal') {
            closeCart();
        }
    });
    document.getElementById('social-menu').addEventListener('click', (e) => {
        if (e.target.id === 'social-menu') {
            closeSocialMenu();
        }
    });
    document.getElementById('payment-methods-modal').addEventListener('click', (e) => {
        if (e.target.id === 'payment-methods-modal') {
            closePaymentMethods();
        }
    });
    document.getElementById('suggestions-modal').addEventListener('click', (e) => {
        if (e.target.id === 'suggestions-modal') {
            closeSuggestionsModal();
        }
    });
    document.getElementById('synopsis-modal').addEventListener('click', (e) => {
        if (e.target.id === 'synopsis-modal') {
            closeSynopsis();
        }
    });
    document.getElementById('trailer-modal').addEventListener('click', (e) => {
        if (e.target.id === 'trailer-modal') {
            closeTrailer();
        }
    });
    document.getElementById('details-modal').addEventListener('click', (e) => {
        if (e.target.id === 'details-modal') {
            closeDetailsModal();
        }
    });
});
