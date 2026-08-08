// ==========================================
// Qlobal dəyişənlər - Sənin mövcud dəyişənlərin
// ==========================================
let directoryHandle = null;
let products = [];
let wishlist = []; // Gözləmə siyahısı üçün massiv
let selectedFiles = [];
let currentExistingPhotos = [];
let currentSellingId = null;
let currentActiveSection = 'home';

// Chart instances
let platformChartInstance = null;
let conditionChartInstance = null;
let profitChartInstance = null;
let categoryChartInstance = null;
let expenseChartInstance = null;

let currentWishPage = 1; // Hal-hazırda hansı səhifədəyik
const wishRowsPerPage = 10; // Hər səhifədə neçə sətir olsun

// --- YENİ ƏLAVƏ OLUNDU ---
let currentSalesPage = 1;
const salesRowsPerPage = 10;
// -------------------------

// --- BİZNES ÜÇÜN QLOBAL DƏYİŞƏN ---
let businesses = [];

// DOM Elementləri

const connectBtn = document.getElementById('connectBtn');
const dbStatus = document.getElementById('dbStatus');
const productGrid = document.getElementById('productGrid');
const searchInput = document.getElementById('searchInput');

// ==========================================
// 1. QOVLUĞA QOŞULMA VƏ MƏLUMATLARIN YÜKLƏNMƏSİ
// ==========================================
async function connectToDB() {
    try {
        directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const options = { mode: 'readwrite' };
        if ((await directoryHandle.queryPermission(options)) !== 'granted') {
            await directoryHandle.requestPermission(options);
        }

        dbStatus.innerText = "✅ Baza Aktivdir: " + directoryHandle.name;
        dbStatus.style.color = "#2ecc71";
        connectBtn.style.background = "#27ae60";

        await loadData();
    } catch (err) {
        console.error("Qoşulma xətası:", err);
        alert("Bazaya qoşulmaq mütləqdir!");
    }
}
connectBtn.addEventListener('click', connectToDB);

async function loadData() {
    if (!directoryHandle) return;

    // Məhsulları yüklə
    try {
        const fileHandle = await directoryHandle.getFileHandle('data.json', { create: true });
        const file = await fileHandle.getFile();
        const content = await file.text();
        products = content ? JSON.parse(content) : [];
        renderProducts(products);
    } catch (err) { products = []; renderProducts([]); }

    // Wishlist-i yüklə
    try {
        const wishHandle = await directoryHandle.getFileHandle('wishlist.json', { create: true });
        const wishFile = await wishHandle.getFile();
        const wishContent = await wishFile.text();
        wishlist = wishContent ? JSON.parse(wishContent) : [];
        renderWishlist();
    } catch (e) { wishlist = []; }

     // --- BİZNES BAZASINI YÜKLƏ ---
    try {
        const bizHandle = await directoryHandle.getFileHandle('biznes_baza.json', { create: true });
        const bizFile = await bizHandle.getFile();
        const bizContent = await bizFile.text();
        businesses = bizContent ? JSON.parse(bizContent) : [];
    } catch (e) { businesses = []; }
}

async function saveData() {
    if (!directoryHandle) return;
    try {
        // Məhsulları yadda saxla
        const fileHandle = await directoryHandle.getFileHandle('data.json', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(products, null, 2));
        await writable.close();

        // Wishlist-i yadda saxla
        const wishHandle = await directoryHandle.getFileHandle('wishlist.json', { create: true });
        const wishWritable = await wishHandle.createWritable();
        await wishWritable.write(JSON.stringify(wishlist, null, 2));
        await wishWritable.close();
        
        // --- BİZNES BAZASINI YADDA SAXLA ---
        const bizHandle = await directoryHandle.getFileHandle('biznes_baza.json', { create: true });
        const bizWritable = await bizHandle.createWritable();
        await bizWritable.write(JSON.stringify(businesses, null, 2));
        await bizWritable.close();

        console.log("Bütün məlumatlar E: diskinə yazıldı.");
    } catch (err) { console.error("Yadda saxlama xətası:", err); }
}

// ==========================================
// 2. WISH-LIST (GÖZLƏMƏ SİYAHISI) MƏNTİQİ
// ==========================================


// ==========================================
// WISH-LIST (GÖZLƏMƏ SİYAHISI) - UPDATE & DELETE
// ==========================================

function openWishlistModal() {
    document.getElementById('wishlistModal').style.display = 'block';
    document.getElementById('wishlistForm').reset();
    document.getElementById('editWishId').value = ""; // ID-ni sıfırla (yeni əlavə üçün)
}

function closeWishlistModal() {
    document.getElementById('wishlistModal').style.display = 'none';
}

// 1. REDAKTƏ ÜÇÜN MODALI AÇAN FUNKSİYA
function openEditWishlistModal(id) {
    const wish = wishlist.find(x => x.id === id);
    if (!wish) return;

    // Modalı aç və məlumatları doldur
    document.getElementById('wishlistModal').style.display = 'block';
    document.getElementById('editWishId').value = wish.id;
    document.getElementById('wishCustomer').value = wish.customer;
    document.getElementById('wishProduct').value = wish.product;
    document.getElementById('wishBudget').value = wish.budget;
    document.getElementById('wishPhone').value = wish.phone;
    document.getElementById('wishNote').value = wish.note;
}

// 2. FORM TƏQDİMİ (HƏM YENİ, HƏM UPDATE)
document.getElementById('wishlistForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!directoryHandle) { alert("Əvvəlcə bazaya qoşulun!"); return; }

    const editId = document.getElementById('editWishId').value;
    const wishProductName = document.getElementById('wishProduct').value; // Müştərinin yazdığı məhsul

    const wishData = {
        customer: document.getElementById('wishCustomer').value,
        product: wishProductName,
        budget: document.getElementById('wishBudget').value,
        phone: document.getElementById('wishPhone').value,
        note: document.getElementById('wishNote').value
    };

    if (editId) {
        // REDAKTƏ
        const index = wishlist.findIndex(x => x.id === editId);
        if (index !== -1) wishlist[index] = { ...wishlist[index], ...wishData };
    } else {
        // YENİ ƏLAVƏ
        const newWish = {
            id: "WISH-" + Date.now(),
            ...wishData,
            status: 'pending',
            date: new Date().toLocaleDateString('az-AZ')
        };
        wishlist.push(newWish);
    }

    // 1. ANBARDA MƏHSULUN OLUB-OLMADIĞINI YOXLAYIRIQ (Addım 2-dəki funksiya)
    // Redaktə yox, yalnız yeni əlavə ediləndə yoxlasın
    if (!editId) {
        checkInventoryMatch(wishProductName);
    }

    // 2. Məlumatı bazaya yazırıq
    await saveData();

    // 3. Səhifələmə ilə birgə cədvəli yeniləyirik
    renderWishlist();

    // 4. Modalı bağlayırıq (Formu sıfırlayır)
    closeWishlistModal();
};

// 3. RENDER FUNKSİYASI (YENİLƏNDİ: UPDATE ICON İLƏ)
function renderWishlist(dataToDisplay = wishlist) {
    const body = document.getElementById('wishlistBody');
    if (!body) return;

    // --- SƏHİFƏLƏMƏ (PAGINATION) MƏNTİQİ ---
    const totalItems = dataToDisplay.length;
    const totalPages = Math.ceil(totalItems / wishRowsPerPage);

    // Səhifə nömrəsi limitləri aşmasın
    if (currentWishPage > totalPages && totalPages > 0) currentWishPage = totalPages;
    if (currentWishPage < 1) currentWishPage = 1;

    // Siyahını kəsirik (məsələn, 0-dan 10-a qədər)
    const startIndex = (currentWishPage - 1) * wishRowsPerPage;
    const endIndex = startIndex + wishRowsPerPage;
    const paginatedData = dataToDisplay.slice(startIndex, endIndex);
    // ---------------------------------------

    body.innerHTML = ''; // Cədvəli təmizlə

    if (paginatedData.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;">Məlumat tapılmadı.</td></tr>';
    }

    paginatedData.forEach(w => {
        body.innerHTML += `
            <tr>
                <td><strong>${w.customer}</strong></td>
                <td>${w.product}</td>
                <td>${w.budget} ₼</td>
                <td>${w.phone}</td>
                <td><span class="status-badge ${w.status}">${w.status === 'pending' ? 'Gözləyir' : 'Tamamlandı'}</span></td>
                <td>
                    <button onclick="openEditWishlistModal('${w.id}')" style="color:#3498db; background:none; border:none; cursor:pointer;"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteWish('${w.id}')" style="color:#e74c3c; background:none; border:none; cursor:pointer; margin-left:10px;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    // Düymələri ekrana çıxarırıq
    renderWishPagination(totalItems, dataToDisplay);
}

// 4. SİLMƏ FUNKSİYASI
async function deleteWish(id) {
    if (confirm("Bu müştəri istəyini siyahıdan tamamilə silmək istəyirsiniz?")) {
        wishlist = wishlist.filter(x => x.id !== id);
        await saveData();
        renderWishlist(); // Səhifələmə daxildə avtomatik tənzimlənəcək
    }
}

// ==========================================
// 3. SƏHİFƏ İDARƏETMƏSİ (MODUL KEÇİDLƏRİ)
// ==========================================
function showSection(sectionId) {
    console.log("Keçid edilən bölmə:", sectionId);
    currentActiveSection = sectionId;

    // 1. Bütün bölmələri siyahı şəklində gizlədirik (businessSection bura əlavə olundu)
    const sections = ['productGrid', 'analyticsSection', 'wishlistSection', 'businessSection', 'productDetailView'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 2. Axtarış qutusunu təmizləyirik
    const sInput = document.getElementById('searchInput');
    if (sInput) sInput.value = '';

    // 3. Seçilən bölməyə uyğun məntiqi işə salırıq
    if (sectionId === 'home') {
        document.getElementById('productGrid').style.display = 'grid';
        renderProducts(products.filter(p => p.status !== 'sold'));
    }
    else if (sectionId === 'wishlist') {
        currentWishPage = 1; // Səhifələməni sıfırla
        document.getElementById('wishlistSection').style.display = 'block';
        renderWishlist(wishlist);
    }
    else if (sectionId === 'analytics') {
        currentSalesPage = 1; // Səhifələməni sıfırla
        document.getElementById('analyticsSection').style.display = 'block';
        populateYearFilter();
        updateAnalytics();
    }
    // --- YENİ BİZNES BÖLMƏSİNİN İNTEQRASİYASI ---
    else if (sectionId === 'business') {
        const bizSection = document.getElementById('businessSection');
        if (bizSection) {
            bizSection.style.display = 'block';
            renderBusinesses(); // Biznes kartlarını ekrana çıxarır
        }
    }

    // Sidebar-da aktivlik vizualını yeniləyirik (isteğe bağlı)
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
}

// Axtarış funksiyasını hər iki bölməyə uyğunlaşdırırıq handleSearch
function handleSearch() {
    const sInput = document.getElementById('searchInput');
    if (!sInput) return;

    const query = sInput.value.toLowerCase()
        .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o')
        .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c')
        .replace(/ş/g, 's').trim();

    if (currentActiveSection === 'wishlist') {
        currentWishPage = 1;
        const filteredWishes = wishlist.filter(item => {
            const customer = (item.customer || "").toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ş/g, 's');
            const product = (item.product || "").toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ş/g, 's');
            return customer.includes(query) || product.includes(query);
        });
        renderWishlist(filteredWishes);
    } 
    else if (currentActiveSection === 'home') {
        const filteredProducts = products.filter(p => {
            if (p.status === 'sold') return false;
            const title = (p.mehsulTitle || "").toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ş/g, 's');
            return title.includes(query);
        });
        renderProducts(filteredProducts);
    }
    else if (currentActiveSection === 'analytics') {
        currentSalesPage = 1; 
        updateAnalytics();
    }
    // --- YENİ ƏLAVƏ: SATILANLAR BÖLMƏSİNDƏ AXTARIŞ ---
    else if (currentActiveSection === 'sold') {
        const filteredSold = products.filter(p => {
            if (p.status !== 'sold') return false; // Yalnız satılanları axtar
            const title = (p.mehsulTitle || "").toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ş/g, 's');
            return title.includes(query);
        });
        renderProducts(filteredSold);
    }
}


// ==========================================
// 4. MƏHSUL ƏLAVƏ EDƏNDƏ WISH-LIST-LƏ YOXLAMA
// ==========================================
// Bu funksiyanı məhsul formunun sonunda çağırmalısan
function checkWishlistMatch(productTitle) {
    const normalizedProduct = productTitle.toLowerCase();
    const match = wishlist.find(w =>
        w.status === 'pending' && normalizedProduct.includes(w.product.toLowerCase())
    );

    if (match) {
        setTimeout(() => {
            alert(`🚀 MÜŞTƏRİ TAPILDI!\n\n"${productTitle}" məhsulunu gözləyən var:\n👤 Müştəri: ${match.customer}\n📞 Əlaqə: ${match.phone}`);
        }, 800);
    }
}

// Sənin mövcud productForm.onsubmit funksiyasının sonuna "checkWishlistMatch(currentTitle);" əlavə etməyi unutma!

// ==========================================
// KÖHNƏ FUNKSİYALARIN DAVAMI (Səndə olanlar)
// ==========================================
function toggleCategories() {
    const menu = document.getElementById('categoryMenu');
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

// Qeyd: Sənin digər funksiyaların  updateAnalytics
async function updateAnalytics() {
    if (!products || products.length === 0) return;

    // 1. Filtrləri Götür
    const selectedYear = document.getElementById('filterYear').value;
    const selectedMonth = document.getElementById('filterMonth').value;
    const sInput = document.getElementById('searchInput');
    
    const query = sInput ? sInput.value.toLowerCase()
        .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o')
        .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c')
        .replace(/ş/g, 's').trim() : "";

    // 2. Satılanları süz
    let filteredSold = products.filter(p => p.status === 'sold');

    if (selectedYear !== 'all') {
        filteredSold = filteredSold.filter(p => new Date(p.satildigiTarix).getFullYear().toString() === selectedYear);
    }
    if (selectedMonth !== 'all') {
        filteredSold = filteredSold.filter(p => new Date(p.satildigiTarix).getMonth().toString() === selectedMonth);
    }

    if (query !== "") {
        filteredSold = filteredSold.filter(p => {
            const title = (p.mehsulTitle || "").toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ş/g, 's');
            const owner = (p.malSahibi || "").toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ş/g, 's');
            return title.includes(query) || owner.includes(query);
        });
    }

    // 3. HESABLAMALAR
    let realRevenue = 0;      
    let ownProductsProfit = 0; 
    let commProfitSum = 0;    
    let totalExtraExpenses = 0; 
    let totalSaleDays = 0;
    const expenseGroups = {}; 

    filteredSold.forEach(p => {
        const salePrice = Number(p.mehsulQiymeti) || 0;
        const baseCost = Number(p.alisQiymeti) || 0;
        
        // Bu məhsula aid olan xərcləri cəmləyirik
        const itemExpenses = (p.mehsulXercleri || []).reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
        totalExtraExpenses += itemExpenses;

        // Xərcləri qruplaşdırırıq (Xərc detalları siyahısı üçün)
        (p.mehsulXercleri || []).forEach(ex => {
            const key = ex.title.trim().toLowerCase();
            if (!expenseGroups[key]) expenseGroups[key] = { name: ex.title.trim(), total: 0 };
            expenseGroups[key].total += Number(ex.amount);
        });

        // BİZNES MODELİNƏ GÖRƏ QAZANC HESABI
        if (p.biznesModeli === 'commission') {
            const kProfit = Number(p.komissiyaQazanci) || 0;
            commProfitSum += kProfit;
            realRevenue += kProfit; // Vasitəçidə dövriyyə yalnız qazancımızdır
        } else {
            const itemProfit = salePrice - (baseCost + itemExpenses);
            ownProductsProfit += itemProfit;
            realRevenue += salePrice; 
        }

        // Satış sürəti hesabı
        const diff = Math.ceil(Math.abs(new Date(p.satildigiTarix) - new Date(p.mehsulunYaradilmTarixi)) / (1000 * 60 * 60 * 24)) || 1;
        totalSaleDays += diff;
    });

    // Hal-hazırda anbarda olanların mayası (Yalnız mənə məxsus mallar)
    const stockValue = products
        .filter(p => p.status !== 'sold' && p.biznesModeli !== 'commission')
        .reduce((sum, p) => sum + (Number(p.alisQiymeti) || 0), 0);

    const finalNetProfit = ownProductsProfit + commProfitSum;
    const avgSaleTime = filteredSold.length > 0 ? Math.round(totalSaleDays / filteredSold.length) : 0;

    // 4. EKRANA ÇIXARIŞ (BÜTÜN KARTLAR)
    const setElText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };

    setElText('statFinalProfit', finalNetProfit.toLocaleString() + " ₼");
    setElText('statOwnProfit', ownProductsProfit.toLocaleString() + " ₼");
    setElText('statCommProfit', commProfitSum.toLocaleString() + " ₼");
    setElText('statTotalRevenue', realRevenue.toLocaleString() + " ₼");
    setElText('statTotalExpenses', totalExtraExpenses.toLocaleString() + " ₼");
    setElText('statStockValue', stockValue.toLocaleString() + " ₼");
    setElText('statSoldQuantity', filteredSold.length + " ədəd");
    setElText('statAvgSaleTime', avgSaleTime + " gün");

    // Xərc siyahısı renderi
    const expListDiv = document.getElementById('expenseBreakdownList');
    if(expListDiv) {
        expListDiv.innerHTML = Object.values(expenseGroups).sort((a,b) => b.total - a.total).map(ex => `
            <div class="expense-breakdown-item">
                <span class="exp-name">${ex.name}</span>
                <span class="exp-total">${ex.total.toLocaleString()} ₼</span>
            </div>`).join('') || '<p style="color:#999; text-align:center;">Xərc yoxdur.</p>';
    }

    // 5. CƏDVƏL RENDERİ
    const tableBody = document.getElementById('salesTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        const sortedSold = [...filteredSold].sort((a, b) => new Date(b.satildigiTarix) - new Date(a.satildigiTarix));

        // Səhifələmə
        const totalItems = sortedSold.length;
        const totalPages = Math.ceil(totalItems / salesRowsPerPage);
        if (currentSalesPage > totalPages && totalPages > 0) currentSalesPage = totalPages;
        const startIndex = (currentSalesPage - 1) * salesRowsPerPage;
        const paginatedSales = sortedSold.slice(startIndex, startIndex + salesRowsPerPage);

        paginatedSales.forEach(p => {
            const isComm = p.biznesModeli === 'commission';
            const profit = isComm 
                ? (Number(p.komissiyaQazanci) || 0) 
                : (Number(p.mehsulQiymeti) - (Number(p.alisQiymeti) + (p.mehsulXercleri || []).reduce((s, e) => s + Number(e.amount), 0)));
            
            const days = Math.ceil(Math.abs(new Date(p.satildigiTarix) - new Date(p.mehsulunYaradilmTarixi)) / (1000 * 60 * 60 * 24)) || 1;

            tableBody.innerHTML += `
                <tr>
                    <td><strong>${p.mehsulTitle}</strong>${isComm ? '<br><small style="color:#3498db; font-size:10px;">Vasitəçilik</small>' : ''}</td>
                    <td>${p.malSahibi || '-'}</td>
                    <td>${new Date(p.satildigiTarix).toLocaleDateString('az-AZ')}</td>
                    <td>${isComm ? '-' : p.alisQiymeti + ' ₼'}</td>
                    <td>${p.mehsulQiymeti} ₼</td>
                    <td class="profit-text">+${profit.toLocaleString()} ₼</td>
                    <td class="${days <= 10 ? 'speed-fast' : (days <= 30 ? 'speed-normal' : 'speed-slow')}">${days} gün</td>
                </tr>`;
        });
        renderSalesPagination(totalItems); 
    }
// updateAnalytics funksiyasının sonuna, initCharts-dan əvvəl bunu qoy:
try {
    drawGrowthVisuals(selectedYear, selectedMonth);
} catch (e) {
    console.error("Growth Graph Error:", e);
}
// Bu try-catch bloku imkan verməyəcək ki, hər hansı səhv digər qrafikləri silsin.
    initCharts(filteredSold, expenseGroups);
}




// 4. ŞƏKİLLƏRİ "images" QOVLUĞUNA KOPYALAMAQ
async function saveImagesLocally(files) {
    if (!directoryHandle) return [];

    const imgFolder = await directoryHandle.getDirectoryHandle('images', { create: true });
    const savedFileNames = [];

    for (let file of files) {
        const uniqueName = Date.now() + "-" + file.name.replace(/\s/g, "_");
        const fileHandle = await imgFolder.getFileHandle(uniqueName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        savedFileNames.push(uniqueName);
    }
    return savedFileNames;
}

// 5. ŞƏKİLLƏRİ EKRANDA GÖSTƏRMƏK ÜÇÜN URL YARATMAQ
async function getImgSrc(fileName) {
    try {
        const imgFolder = await directoryHandle.getDirectoryHandle('images');
        const fileHandle = await imgFolder.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        return URL.createObjectURL(file);
    } catch {
        return 'https://via.placeholder.com/250x180?text=Şəkil+Tapılmadı';
    }
}


// 6. FORM TƏQDİM EDİLDİKDƏ (YENİ MƏHSUL VƏ YA REDAKTƏ) - YENİLƏNDİ
document.getElementById('productForm').onsubmit = async (e) => {
    e.preventDefault();

    if (!directoryHandle) {
        alert("⚠️ DİQQƏT: Öncə sol aşağıdakı 'Bazaya Qoşul' düyməsini sıxmalısınız!");
        return;
    }

    const saveBtn = e.target.querySelector('.btn-save');
    saveBtn.innerText = "Yadda saxlanılır...";
    saveBtn.disabled = true;

    try {
        const editId = document.getElementById('editProductId').value;
        const currentTitle = document.getElementById('title').value;
        const newPrice = Number(document.getElementById('salePrice').value) || 0;

        // --- BİZNES MODELİ HESABLAMASI (3-CÜ ADDIM) ---
        const model = document.querySelector('input[name="biznesModeli"]:checked')?.value || 'own';
        let alisPrice = Number(document.getElementById('costPrice').value) || 0;
        let commProfit = 0;
        let owner = "";

        if (model === 'commission') {
            commProfit = Number(document.getElementById('commissionProfit').value) || 0;
            owner = document.getElementById('ownerName').value;
            // Senior Məntiqi: Əgər vasitəçiyəmsə, Alış Qiyməti = Satış - Mənim Qazancım
            alisPrice = newPrice - commProfit;
        }
        // ----------------------------------------------

        // 1. Şəkilləri yüklə
        const newUploadedPhotoNames = await saveImagesLocally(selectedFiles);
        const finalPhotoList = [...(currentExistingPhotos || []), ...newUploadedPhotoNames];

        // 2. Məlumat obyektini yaradırıq (YENİ SAHƏLƏR ƏLAVƏ EDİLDİ)
        const productInfo = {
            mehsulTitle: currentTitle,
            mehsulAciqlamasi: document.getElementById('description').value,
            mehsulQiymeti: newPrice,
            alisQiymeti: alisPrice, // Hesablanmış qiymət bura gedir
            biznesModeli: model,    // 'own' və ya 'commission'
            komissiyaQazanci: commProfit,
            malSahibi: owner,
            mehsulunKateqoriyasi: document.getElementById('category').value,
            mehsulunVeziyyeti: document.getElementById('condition').value,
            labels: document.getElementById('labels').value.split(',').map(l => l.trim()),
            mehsulResmleri: finalPhotoList,
            mehsulXercleri: typeof getExpensesFromForm === 'function' ? getExpensesFromForm() : []
        };

        if (editId) {
            // REDAKTƏ ETMƏ
            const index = products.findIndex(x => String(x.id) === String(editId));
            if (index !== -1) {
                const currentP = products[index];
                let updatedOldPrice = currentP.kohneQiymet;
                if (newPrice !== currentP.mehsulQiymeti) {
                    updatedOldPrice = currentP.mehsulQiymeti;
                }

                products[index] = {
                    ...currentP,
                    ...productInfo,
                    kohneQiymet: updatedOldPrice
                };
            }
        } else {
            // YENİ ƏLAVƏ ETMƏ
            const newProduct = {
                id: "DT-" + Date.now(),
                status: "active",
                satildigiTarix: null,
                mehsulunYaradilmTarixi: new Date().toISOString(),
                kohneQiymet: null,
                ...productInfo
            };
            products.push(newProduct);
        }

        // 3. Bazaya yazırıq
        await saveData();

        // Əgər bu redaktə deyil, YENİ məhsuldursa yoxlasın
        const newEditId = document.getElementById('editProductId').value;
        if (!newEditId) {
            checkWishlistForNewProduct(currentTitle);
        }

        // 3. Formu təmizlə və modalı bağla
        e.target.reset();
        closeModal();
        renderProducts(products.filter(p => p.status !== 'sold'));

        // 4. BİLDİRİŞ YOXLAMA
        if (typeof checkWishlistMatch === 'function') {
            checkWishlistMatch(currentTitle);
        }

        // 5. Formu təmizləyirik
        e.target.reset();
        document.getElementById('imagePreview').innerHTML = '';
        const expContainer = document.getElementById('expenseContainer');
        if (expContainer) expContainer.innerHTML = '';

        // Komissiya sahələrini də təmizləyək və gizlədək
        if (typeof toggleBiznesModel === 'function') {
            document.querySelector('input[value="own"]').checked = true;
            toggleBiznesModel();
        }

        selectedFiles = [];
        currentExistingPhotos = [];
        closeModal();

    } catch (err) {
        console.error("Xəta baş verdi:", err);
        alert("Xəta: " + err.message);
    } finally {
        saveBtn.innerText = "Yadda Saxla";
        saveBtn.disabled = false;
    }
};

// 7. MƏHSULLARI EKRANA RENDER ETMƏK (Təkmilləşdirilmiş və Sinxron Versiya)
async function renderProducts(data) {
    // Sənin istədiyin təhlükəsizlik yoxlaması və təmizləmə hissəsi
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    grid.innerHTML = ''; // Köhnə kartları tam təmizləyirik (Çoxalmanın qarşısını alır)

    // Əgər göstəriləcək məlumat yoxdursa
    if (!data || data.length === 0) {
        grid.innerHTML = '<div class="welcome-msg">Hələ heç bir məhsul yoxdur.</div>';
        return;
    }

    // Məhsulları tək-tək dövrə salırıq
    for (let p of data) {
        // 1. Satılıb-satılmadığını yoxlayırıq
        const isSold = p.status === 'sold';

        // 2. Stock Aging (Stok Yaşlanması) hesablaması
        const agingDays = getStockAgingDays(p.mehsulunYaradilmTarixi);
        const agingClass = getAgingClass(agingDays);

        // 3. Şəkil linkini götürürük
        const firstImg = (p.mehsulResmleri && p.mehsulResmleri.length > 0)
            ? await getImgSrc(p.mehsulResmleri[0])
            : 'https://via.placeholder.com/250x180?text=No+Image';

        const card = document.createElement('div');
        card.className = `card ${isSold ? 'is-sold' : ''}`;

        card.innerHTML = `
            <!-- Əgər satılıbsa "SATILDI" lenti, satılmayıbsa "Aging Badge" (Yaşıl/Sarı/Qırmızı gün) görsənir -->
            ${isSold ?
                '<div class="sold-banner">SATILDI</div>' :
                `<div class="aging-badge ${agingClass}">${agingDays} gün</div>`
            }

            <div onclick="showProductDetail('${p.id}')" style="cursor:pointer">
                <img src="${firstImg}" alt="">
                <div class="card-body">
                    <h3>${p.mehsulTitle}</h3>
                    <span class="price-tag">${p.mehsulQiymeti} ₼</span>
                    ${p.kohneQiymet ? `<span class="old-price">${p.kohneQiymet} ₼</span>` : ''}
                </div>
            </div>

            <div class="card-footer">
                <button onclick="openEditModal('${p.id}')" title="Düzəliş et"><i class="fas fa-edit"></i></button>
                
                <!-- Satış/Geri Qaytarma Düyməsi (isSold vəziyyətinə görə icon dəyişir) -->
                <button class="btn-sell-trigger" onclick="toggleSoldStatus('${p.id}')" title="${isSold ? 'Geri qaytar' : 'Satıldı kimi qeyd et'}">
                    <i class="fas ${isSold ? 'fa-undo' : 'fa-shopping-cart'}"></i>
                </button>

                <button onclick="deleteProduct('${p.id}')" style="color:red" title="Sil"><i class="fas fa-trash"></i></button>
            </div>
        `;
        grid.appendChild(card);
    }
}

async function deleteProduct(id) {
    // 1. İstifadəçidən təsdiq alırıq
    const confirmDelete = confirm("Bu məhsulu və ona aid bütün ŞƏKİLLƏRİ diskdən (E:\\ qovluğundan) tamamilə silmək istəyirsiniz?");
    if (!confirmDelete) return;

    try {
        // 2. Silinəcək məhsulu tapırıq ki, şəkillərinin adını öyrənək
        const productToDelete = products.find(p => String(p.id).trim() === String(id).trim());

        if (productToDelete) {
            console.log("Məhsul tapıldı, şəkillər silinir...");

            // 3. Şəkilləri fiziki olaraq "images" qovluğundan silirik
            try {
                const imgFolder = await directoryHandle.getDirectoryHandle('images');

                for (const imgName of productToDelete.mehsulResmleri) {
                    try {
                        // BU HİSSƏ FAYLI DİSKDƏN SİLİR
                        await imgFolder.removeEntry(imgName);
                        console.log(`${imgName} faylı diskdən silindi.`);
                    } catch (fileErr) {
                        console.warn(`${imgName} tapılmadı və ya artıq silinib.`);
                    }
                }
            } catch (folderErr) {
                console.error("Images qovluğu tapılmadı, şəkillər silinə bilmədi.");
            }

            // 4. İndi isə məhsulu JSON siyahısından (products massivindən) çıxarırıq
            products = products.filter(p => String(p.id).trim() !== String(id).trim());

            // 5. Yenilənmiş siyahını data.json faylına yazırıq
            await saveData();

            // Detal səhifəsi açıqdırsa bağlayırıq
            if (document.getElementById('productDetailView')) {
                document.getElementById('productDetailView').style.display = 'none';
            }

            alert("Məhsul və ona aid şəkillər qovluqdan tamamilə təmizləndi! ✅");
        } else {
            alert("Xəta: Məhsul bazada tapılmadı.");
        }
    } catch (err) {
        console.error("Kritik xəta:", err);
        alert("Silmə zamanı xəta baş verdi: " + err.message);
    }
}

async function editPrice(id) {
    const p = products.find(x => x.id === id);
    const newPrice = prompt(`${p.mehsulTitle} üçün yeni qiymət:`, p.mehsulQiymeti);
    if (newPrice && newPrice !== p.mehsulQiymeti) {
        p.kohneQiymet = p.mehsulQiymeti;
        p.mehsulQiymeti = newPrice;
        await saveData();
    }
}



// 10. DRAG & DROP İDARƏETMƏSİ
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.onclick = () => fileInput.click();
fileInput.onchange = (e) => processFiles(e.target.files);

dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = "#2ecc71"; };
dropZone.ondragleave = () => { dropZone.style.borderColor = "#3498db"; };
dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#3498db";
    processFiles(e.dataTransfer.files);
};

function processFiles(files) {
    for (let file of files) {
        selectedFiles.push(file);
    }
    renderImagePreviews();
}


// REDAKTƏ MODALINI AÇAN FUNKSİYA
async function openEditModal(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    document.getElementById('modalTitle').innerText = "Məhsulu Redaktə Et";
    document.getElementById('editProductId').value = p.id;
    document.getElementById('title').value = p.mehsulTitle;
    document.getElementById('description').value = p.mehsulAciqlamasi;
    document.getElementById('salePrice').value = p.mehsulQiymeti;
    document.getElementById('costPrice').value = p.alisQiymeti;
    document.getElementById('category').value = p.mehsulunKateqoriyasi;
    document.getElementById('condition').value = p.mehsulunVeziyyeti;
    document.getElementById('labels').value = p.labels.join(', ');

    // openEditModal daxilinə yapışdır:
    const container = document.getElementById('expenseContainer');
    if (container) {
        container.innerHTML = ''; // Təmizlə
        if (p.mehsulXercleri) {
            p.mehsulXercleri.forEach(ex => addExpenseRow(ex.title, ex.amount));
        }
    }

    currentExistingPhotos = [...p.mehsulResmleri]; // Mövcud şəkilləri kopyala
    selectedFiles = []; // Yeni seçimləri sıfırla
    renderImagePreviews();
    openModal();
}

// "YENİ ELAN" DÜYMƏSİNƏ BASANDA FORMU SIFIRLAMAQ ÜÇÜN (Köhnə məlumatlar qalmasın)
function openNewProductModal() {
    document.getElementById('modalTitle').innerText = "Yeni Məhsul";
    document.getElementById('editProductId').value = ""; // ID-ni təmizləyirik
    document.getElementById('productForm').reset();
    document.getElementById('imagePreview').innerHTML = '';
    selectedFiles = [];
    openModal();
}

async function renderImagePreviews() {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';

    // 1. Mövcud (bazada olan) şəkilləri göstər
    for (let i = 0; i < currentExistingPhotos.length; i++) {
        const url = await getImgSrc(currentExistingPhotos[i]);
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <img src="${url}">
            <button type="button" class="delete-img-btn" onclick="removeExistingImg(${i})">×</button>
        `;
        preview.appendChild(div);
    }

    // 2. Yeni seçilmiş (hələ yüklənməmiş) şəkilləri göstər
    for (let i = 0; i < selectedFiles.length; i++) {
        const div = document.createElement('div');
        div.className = 'preview-item';
        const reader = new FileReader();
        reader.onload = (e) => {
            div.innerHTML = `
                <img src="${e.target.result}">
                <button type="button" class="delete-img-btn" onclick="removeNewImg(${i})">×</button>
            `;
        };
        reader.readAsDataURL(selectedFiles[i]);
        preview.appendChild(div);
    }
}

// Şəkilləri massivdən silən funksiyalar
async function removeExistingImg(index) {
    // 1. Silinəcək şəklin adını götürürük
    const fileName = currentExistingPhotos[index];

    // 2. İstifadəçidən təsdiq alırıq (təhlükəsizlik üçün)
    const confirmImgDelete = confirm("Bu şəkil qovluqdan (diskdən) tamamilə silinsin?");
    if (!confirmImgDelete) return;

    try {
        // 3. Şəkli fiziki olaraq qovluqdan silirik
        const imgFolder = await directoryHandle.getDirectoryHandle('images');
        await imgFolder.removeEntry(fileName);
        console.log(`${fileName} diskdən fiziki olaraq silindi.`);

        // 4. İndi isə siyahıdan (massivdən) silirik
        currentExistingPhotos.splice(index, 1);

        // 5. Ekranı (önizləməni) yeniləyirik
        renderImagePreviews();

        alert("Şəkil uğurla silindi.");
    } catch (err) {
        console.error("Şəkil silinərkən xəta:", err);
        alert("Şəkil diskdən silinə bilmədi (ola bilsin artıq silinib və ya icazə yoxdur).");

        // Hətta diskdə tapılmasa belə, siyahıdan silək ki, istifadəçi xəta görməyə davam etməsin
        currentExistingPhotos.splice(index, 1);
        renderImagePreviews();
    }
}

function removeNewImg(index) {
    selectedFiles.splice(index, 1);
    renderImagePreviews();
}

// UI Köməkçiləri
function openModal() { document.getElementById('productModal').style.display = 'block'; }
function closeModal() { document.getElementById('productModal').style.display = 'none'; }
function toggleCategories() {
    const menu = document.getElementById('categoryMenu');
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}


function filterByCategory(cat) {
    console.log("Seçilən kateqoriya:", cat);
    
    // 1. UI Hazırlığı
    currentActiveSection = 'home';
    document.getElementById('analyticsSection').style.display = 'none';
    document.getElementById('wishlistSection').style.display = 'none';
    if (document.getElementById('productDetailView')) document.getElementById('productDetailView').style.display = 'none';
    
    const grid = document.getElementById('productGrid');
    grid.style.display = 'grid';

    // 2. Hamısını göstər
    if (cat === 'all' || cat === 'Bütün Məhsullar') {
        renderProducts(products.filter(p => p.status !== 'sold'));
        return;
    }

    // 3. Normalizasiya funksiyası
    const normalize = (txt) => {
        if (!txt) return "";
        return txt.toString().toLowerCase()
            .replace(/i̇/g, 'i').replace(/ı/g, 'i').replace(/ə/g, 'e')
            .replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ğ/g, 'g')
            .replace(/ç/g, 'c').replace(/ş/g, 's')
            .replace(/\s+/g, '');
    };

    // 4. Kliklənən menyunu sözlərə böl (Tokenize)
    const searchTokens = cat.toLowerCase()
        .replace(/ və /g, ' ')
        .split(/[\s,]+/)
        .filter(w => w.length > 2)
        .map(w => normalize(w));

    // 5. Məhsulları süz
    const filtered = products.filter(p => {
        if (p.status === 'sold') return false;

        const productCat = normalize(p.mehsulunKateqoriyasi);
        const productTitle = normalize(p.mehsulTitle);

        // Əgər kliklənən sözlərdən hər hansı biri kateqoriyada VƏ YA başlıqda varsa göstər
        return searchTokens.some(token => 
            productCat.includes(token) || 
            productTitle.includes(token) ||
            token.includes(productCat)
        );
    });

    console.log("Tapılan nəticə sayı:", filtered.length);
    renderProducts(filtered);

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="welcome-msg" style="grid-column:1/-1; text-align:center;">"${cat}" üçün uyğun aktiv məhsul tapılmadı.</div>`;
    }

    const menu = document.getElementById('categoryMenu');
    if (menu) menu.style.display = 'none';
}

async function showProductDetail(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    // Məlumatları doldur
    document.getElementById('detailTitle').innerText = p.mehsulTitle;
    document.getElementById('detailPrice').innerText = p.mehsulQiymeti + " ₼";
    document.getElementById('detailOldPrice').innerText = p.kohneQiymet ? p.kohneQiymet + " ₼" : "";
    document.getElementById('detailCategory').innerText = p.mehsulunKateqoriyasi;
    document.getElementById('detailCondition').innerText = p.mehsulunVeziyyeti;
    document.getElementById('detailCost').innerText = p.alisQiymeti;
    document.getElementById('detailDescText').innerText = p.mehsulAciqlamasi;

    // --- STOCK AGING MƏNTİQİ (YENİLƏNDİ) ---
    let agingInfo = document.getElementById('detailAgingInfo');
    if (!agingInfo) {
        agingInfo = document.createElement('div');
        agingInfo.id = 'detailAgingInfo';
        const priceBox = document.querySelector('.detail-price-box');
        if (priceBox) priceBox.after(agingInfo);
    }

    // Əgər məhsul satılıbsa gizlə, satılmayıbsa gün sayını göstər
    if (p.status === 'sold') {
        agingInfo.style.display = 'none';
    } else {
        agingInfo.style.display = 'block';
        const agingDays = getStockAgingDays(p.mehsulunYaradilmTarixi);
        const agingClass = getAgingClass(agingDays);
        agingInfo.className = `detail-aging-info ${agingClass}`;
        agingInfo.innerHTML = `<i class="fas fa-clock"></i> Stokda qalma müddəti: <strong>${agingDays} gün</strong>`;
    }
    // ---------------------------------------

    // Edit düyməsini detallar səhifəsində də aktiv edək
    document.getElementById('editFromDetail').onclick = () => {
        hideProductDetail();
        openEditModal(p.id);
    };

    // Etiketləri doldur
    const labelsDiv = document.getElementById('detailLabels');
    labelsDiv.innerHTML = p.labels.map(l => `<span>#${l}</span>`).join('');

    // Qalereyanı doldur
    const gallery = document.getElementById('detailGallery');
    gallery.innerHTML = '';
    for (let imgName of p.mehsulResmleri) {
        const url = await getImgSrc(imgName);
        gallery.innerHTML += `<img src="${url}" alt="">`;
    }

    // Səhifəni göstər
    document.getElementById('productDetailView').style.display = 'block';
}

function hideProductDetail() {
    document.getElementById('productDetailView').style.display = 'none';
}

// 1. Satıldı/Aktiv statusunu dəyişən funksiya
async function toggleSoldStatus(id) {
    const index = products.findIndex(x => x.id === id);
    if (index === -1) return;

    if (products[index].status === 'sold') {
        products[index].status = 'active';
        products[index].satildigiTarix = null;
        products[index].satildigiYer = null;

        await saveData();
        // Səhifəni təmiz şəkildə yenidən yükləyirik
        showSection(currentActiveSection);
    } else {
        currentSellingId = id;
        document.getElementById('platformModal').style.display = 'block';
    }
}

function closePlatformModal() {
    document.getElementById('platformModal').style.display = 'none';
    currentSellingId = null;
}

async function confirmSaleWithPlatform(platform) {
    if (!currentSellingId) return;

    const index = products.findIndex(x => x.id === currentSellingId);
    if (index !== -1) {
        products[index].status = 'sold';
        products[index].satildigiTarix = new Date().toISOString();
        products[index].satildigiYer = platform;

        await saveData();
        closePlatformModal();

        // Ekranda çoxalma olmasın deyə birbaşa bölməni yeniləyirik
        showSection(currentActiveSection);
    }
}

// 2. Satılanları süzmək üçün filtr funksiyası
function filterByStatus(status) {
    // --- YENİ ƏLAVƏ: Cari bölməni 'sold' olaraq qeyd edirik ---
    currentActiveSection = status; 
    
    // 1. Əgər analitika və ya detal bölməsi açıqdırsa, onları bağla
    document.getElementById('analyticsSection').style.display = 'none';
    if (document.getElementById('productDetailView')) document.getElementById('productDetailView').style.display = 'none';
    document.getElementById('productGrid').style.display = 'grid';

    // 2. Məhsulları süz (status 'sold' olanlar)
    const filtered = products.filter(p => p.status === status);
    renderProducts(filtered);

    // 3. Sidebar vizualı
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    // Axtarış qutusunu təmizləyirik ki, yeni axtarışa hazır olsun
    document.getElementById('searchInput').value = '';
}




// 1. Mövcud illəri tapıb dropdown-a dolduran funksiya
function populateYearFilter() {
    const yearSelect = document.getElementById('filterYear');
    if (!yearSelect) return;

    // Yalnız satılan və tarixi olan məhsulları götürürük
    const soldItems = products.filter(p => p.status === 'sold' && p.satildigiTarix);

    // İlləri çıxarırıq və xətalı tarixləri (NaN) təmizləyirik
    const years = [...new Set(soldItems.map(p => {
        const year = new Date(p.satildigiTarix).getFullYear();
        return isNaN(year) ? null : year;
    }).filter(y => y !== null))];

    console.log("Tapılan illər:", years); // Konsolda yoxlamaq üçün

    // Dropdown-u sıfırlayırıq
    yearSelect.innerHTML = '<option value="all">Bütün İllər</option>';

    // İlləri böyükdən kiçiyə düzüb əlavə edirik
    years.sort((a, b) => b - a).forEach(year => {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    });
}




// Qrafiki çəkmək üçün initCharts-a ötürürük
// initCharts(filteredSold, expenseGroups);

//     const netProfit = totalRevenue - totalCostOfSold;

//     // Ortalama satış müddəti
//     const avgSaleTime = filteredSold.length > 0 ? Math.round(totalSaleDays / filteredSold.length) : 0;

//     // Hal-hazırda anbarda olanların mayası
//     const stockValue = products
//         .filter(p => p.status !== 'sold')
//         .reduce((sum, p) => sum + (Number(p.alisQiymeti) || 0), 0);

//     // --- EKRANA ÇIXARIŞ ---
//     const setElText = (id, text) => {
//         const el = document.getElementById(id);
//         if (el) el.innerText = text;
//     };

//     setElText('statTotalRevenue', totalRevenue.toLocaleString() + " ₼");
//     setElText('statNetProfit', netProfit.toLocaleString() + " ₼");
//     setElText('statStockValue', stockValue.toLocaleString() + " ₼");
//     setElText('statTotalExpenses', totalExtraExpenses.toLocaleString() + " ₼");
//     setElText('statSoldQuantity', filteredSold.length + " ədəd");
//     setElText('statAvgSaleTime', avgSaleTime + " gün"); // YENİ KART

//     // --- CƏDVƏLİ DOLDURMAQ ---
//     const tableBody = document.getElementById('salesTableBody');
//     if (tableBody) {
//         tableBody.innerHTML = '';
//         const sortedItems = [...filteredSold].sort((a, b) => new Date(b.satildigiTarix) - new Date(a.satildigiTarix));

//         sortedItems.slice(0, 20).forEach(p => {
//             const itemAlis = Number(p.alisQiymeti) || 0;
//             const itemExpenses = (p.mehsulXercleri || []).reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
//             const realProfit = Number(p.mehsulQiymeti) - (itemAlis + itemExpenses);

//             // Məhsulun öz satış sürətini hesablayırıq
//             const entryDate = new Date(p.mehsulunYaradilmTarixi);
//             const saleDate = new Date(p.satildigiTarix);
//             const diffDays = Math.ceil(Math.abs(saleDate - entryDate) / (1000 * 60 * 60 * 24)) || 1;

//             // Sürətə görə rəng sinfi təyin edirik
//             let speedClass = diffDays <= 10 ? 'speed-fast' : (diffDays <= 30 ? 'speed-normal' : 'speed-slow');

//             tableBody.innerHTML += `
//                 <tr>
//                     <td>${p.mehsulTitle}</td>
//                     <td>${new Date(p.satildigiTarix).toLocaleDateString('az-AZ')}</td>
//                     <td>${itemAlis} ₼</td>
//                     <td>${p.mehsulQiymeti} ₼</td>
//                     <td class="profit-text">+${realProfit.toLocaleString()} ₼</td>
//                     <td class="${speedClass}">${diffDays} gün</td>
//                 </tr>
//             `;
//         });
//     }

//     // Qrafikləri yenilə
//     initCharts(filteredSold);





function initCharts(soldItems, expenseGroups = {}) {
    // 1. Köhnə qrafikləri tam silirik
    if (profitChartInstance) profitChartInstance.destroy();
    if (categoryChartInstance) categoryChartInstance.destroy();
    if (platformChartInstance) platformChartInstance.destroy();
    if (conditionChartInstance) conditionChartInstance.destroy();
    if (expenseChartInstance) expenseChartInstance.destroy();

    if (!soldItems || soldItems.length === 0) return;

    // Data hazırlığı
    const catData = {};
    const platData = {};
    const condData = { 'Yeni': 0, 'İşlənmiş': 0 };

    soldItems.forEach(p => {
        catData[p.mehsulunKateqoriyasi] = (catData[p.mehsulunKateqoriyasi] || 0) + 1;
        const place = p.satildigiYer || "Digər";
        platData[place] = (platData[place] || 0) + 1;
        condData[p.mehsulunVeziyyeti === 'yeni' ? 'Yeni' : 'İşlənmiş']++;
    });

    // Qrafik 1: Gəlir Bar Chart
    const ctx1 = document.getElementById('profitChart').getContext('2d');
    profitChartInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: soldItems.map(p => p.mehsulTitle).slice(-7),
            datasets: [{ label: 'Satış', data: soldItems.map(p => p.mehsulQiymeti).slice(-7), backgroundColor: '#3498db' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Qrafik 2: Kateqoriya
    const ctx2 = document.getElementById('categoryChart').getContext('2d');
    categoryChartInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: { labels: Object.keys(catData), datasets: [{ data: Object.values(catData), backgroundColor: ['#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#1abc9c'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Kateqoriyalar' } } }
    });

    // Qrafik 3: Platforma
    const ctx3 = document.getElementById('platformChart').getContext('2d');
    platformChartInstance = new Chart(ctx3, {
        type: 'doughnut',
        data: { labels: Object.keys(platData), datasets: [{ data: Object.values(platData), backgroundColor: ['#dc2743', '#1877F2', '#FF4F00', '#00C1B1', '#7f8c8d'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Kanallar' } } }
    });

    // Qrafik 4: Vəziyyət
    const ctx4 = document.getElementById('conditionChart').getContext('2d');
    conditionChartInstance = new Chart(ctx4, {
        type: 'pie',
        data: { labels: Object.keys(condData), datasets: [{ data: Object.values(condData), backgroundColor: ['#2ecc71', '#e67e22'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Yeni vs İşlənmiş' } } }
    });

    // Qrafik 5: Xərc Analizi (YENİ!)
    const ctx5 = document.getElementById('expenseDistributionChart').getContext('2d');
    const expLabels = Object.values(expenseGroups).map(g => g.name);
    const expVals = Object.values(expenseGroups).map(g => g.total);
    expenseChartInstance = new Chart(ctx5, {
        type: 'doughnut',
        data: { labels: expLabels, datasets: [{ data: expVals, backgroundColor: ['#e74c3c', '#34495e', '#f39c12', '#8e44ad', '#16a085'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Xərc Paylanması' } } }
    });
}


// gunleri hesablayan
function getStockAgingDays(dateString) {
    const createdDate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function getAgingClass(days) {
    if (days <= 15) return 'aging-new';
    if (days <= 30) return 'aging-warning';
    return 'aging-critical';
}




// Yeni xərc sətri yaradır
function addExpenseRow(title = "", amount = "") {
    const container = document.getElementById('expenseContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'expense-row';
    row.innerHTML = `
        <input type="text" class="exp-title" placeholder="Xərcin adı" value="${title}">
        <input type="number" class="exp-value" placeholder="₼" value="${amount}">
        <button type="button" class="btn-remove-expense" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
}

// Formdan xərcləri obyekt kimi toplayır
function getExpensesFromForm() {
    const rows = document.querySelectorAll('.expense-row');
    const expenses = [];
    rows.forEach(row => {
        const title = row.querySelector('.exp-title').value;
        const value = row.querySelector('.exp-value').value;
        if (title && value) {
            expenses.push({ title: title, amount: Number(value) });
        }
    });
    return expenses;
}






// 1. Yazıları standart hala gətirən (Normalize) funksiya (Azərbaycan hərfləri daxil)
function normalizeText(text) {
    if (!text) return "";
    return text.toString().toLowerCase()
        .trim()
        .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o')
        .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c')
        .replace(/ş/g, 's')
        .replace(/\s+/g, ''); // Boşluqları silir (iphone 11 -> iphone11)
}






// script.js sonuna yapışdır
function toggleBiznesModel() {
    const model = document.querySelector('input[name="biznesModeli"]:checked').value;
    const commFields = document.getElementById('commissionFields');
    const costInputGroup = document.getElementById('costPrice').parentElement;

    if (model === 'commission') {
        commFields.style.display = 'block';
        costInputGroup.style.display = 'none'; // Alış qiymətini gizlədirik
        document.getElementById('costPrice').value = 0; // Sıfırlayırıq
    } else {
        commFields.style.display = 'none';
        costInputGroup.style.display = 'block'; // Alış qiymətini geri gətiririk
    }
}



function checkInventoryMatch(wishName) {
    if (!products || products.length === 0) return;

    // 1. Yazını təmizləyən və standartlaşdıran daxili funksiya (Senior Version)
    const normalize = (txt) => {
        if (!txt) return "";
        return txt.toString().toLowerCase()
            .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o')
            .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c')
            .replace(/ş/g, 's')
            // Bütün durğu işarələrini və lazımsız simvolları silirik ki, bitişik sözlər də tapılsın
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
            .trim();
    };

    const wishClean = normalize(wishName);
    // Müştərinin yazdığı istəyi sözlərə bölürük (məs: "kafel", "kesen", "10sm")
    const wishWords = wishClean.split(/\s+/).filter(word => word.length > 1);

    if (wishWords.length === 0) return;

    // 2. AKTİV MƏHSULLAR ARASINDA DƏRİN AXTARIŞ
    const matches = products.filter(p => {
        if (p.status === 'sold') return false;

        // Məhsulun bütün məlumatlarını bir "Search Blob" (Axtarış Yığını) halına gətiririk
        // Başlıq + Kateqoriya + Açıqlama + Qiymət
        const searchBlob = normalize(`
            ${p.mehsulTitle} 
            ${p.mehsulunKateqoriyasi} 
            ${p.mehsulAciqlamasi || ""} 
            ${p.mehsulQiymeti}
        `);

        // ƏSAS STRATEGİYA: 
        // Müştərinin yazdığı sözlərdən HƏR HANSI BİRİ (və ya hamısı) bu yığının içində varmı?
        // Biz burada "Partial Matching" istifadə edirik.

        // Müştəri bir neçə söz yazıbsa (məs: "kafel kesen"), 
        // onların ən azı 1-i (əgər çoxdursa 50%-i) uyğun gəlməlidir
        const matchCount = wishWords.filter(word => searchBlob.includes(word)).length;

        // Əgər 1 söz yazıbsa, o mütləq tapılmalıdır. 
        // Əgər çox söz yazıbsa, ən azı əsas açar sözlər tapılmalıdır.
        return matchCount >= Math.ceil(wishWords.length * 0.5);
    });

    // 3. NƏTİCƏNİ EKRANA ÇIXARIRIQ
    if (matches.length > 0) {
        // Tapılanları qiymətə görə düzürük (büdcəyə ən yaxın olanlar yuxarı çıxa bilər)
        matches.sort((a, b) => a.mehsulQiymeti - b.mehsulQiymeti);

        let message = `🚀 MÜJDƏ! ANBARDA UYĞUNLUQ TAPILDI!\n\n`;
        message += `Siz yazdınız: "${wishName}"\n`;
        message += `==================================\n`;

        matches.forEach((m, index) => {
            // Əgər başlıqda Dostoyevski sözü yoxdursa, amma açıqlamada varsa, bunu vurğulayaq
            const isInTitle = normalize(m.mehsulTitle).includes(normalize(wishName).split(" ")[0]);

            message += `${index + 1}. ${m.mehsulTitle}\n`;
            message += `💰 Qiymət: ${m.mehsulQiymeti} ₼\n`;
            message += `📍 Kateqoriya: ${m.mehsulunKateqoriyasi}\n`;
            if (!isInTitle) {
                message += `📝 (Məlumat açıqlama hissəsində tapıldı)\n`;
            }
            message += `----------------------------------\n`;
        });

        message += `\nMüştəri üçün bu məhsulları dərhal təklif edə bilərsiniz!`;

        setTimeout(() => {
            alert(message);
        }, 600);
    }
}

function checkWishlistForNewProduct(newProductTitle) {
    if (!wishlist || wishlist.length === 0) return;

    // 1. Yeni yüklənən məhsulun bütün məlumatlarını tapırıq (products massivindən)
    // Çünki bizə qiymət, açıqlama və kateqoriya da lazımdır
    const newP = products.find(p => p.mehsulTitle === newProductTitle) || { mehsulTitle: newProductTitle };

    // 2. Standartlaşdırma funksiyası (Senior Version)
    const normalize = (txt) => {
        if (!txt) return "";
        return txt.toString().toLowerCase()
            .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o')
            .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c')
            .replace(/ş/g, 's')
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
            .trim();
    };

    // Yeni məhsulun bütün detallarını bir "Axtarış Yığını" halına salırıq
    const productBlob = normalize(`
        ${newP.mehsulTitle} 
        ${newP.mehsulunKateqoriyasi || ""} 
        ${newP.mehsulAciqlamasi || ""}
    `);

    const productPrice = Number(newP.mehsulQiymeti) || 0;

    // 3. Yalnız "pending" (Gözləyən) statusunda olan müştəriləri DƏRİN yoxlayırıq
    const potentialCustomers = wishlist.filter(wish => {
        if (wish.status !== 'pending') return false;

        const wishProductNameClean = normalize(wish.product);
        const wishWords = wishProductNameClean.split(/\s+/).filter(w => w.length > 1);
        const wishBudget = Number(wish.budget) || 0;

        // A. MƏTN UYĞUNLUĞU: Müştərinin istədiyi sözlər yeni məhsulun detallarında varmı?
        // (Söz-söz parçalayırıq ki, "Dostoyevski" yazan müştəri "Kitab paketi (Dostoyevski)" malını tapsın)
        const textMatch = wishWords.every(word => productBlob.includes(word));

        // B. QİYMƏT UYĞUNLUĞU: Yeni məhsulun qiyməti müştərinin büdcəsinə uyğundurmu?
        // (Burada 10% tolerans qoyuruq: müştəri 100₼ deyibsə, 110₼-lıq malı da göstərsin)
        const priceMatch = wishBudget === 0 || productPrice <= (wishBudget * 1.1);

        return textMatch && priceMatch;
    });

    // 4. Əgər müştəri tapılarsa, Alert veririk
    if (potentialCustomers.length > 0) {
        let alertMsg = `🚀 MÜJDƏ! BU MƏHSULU GÖZLƏYƏN MÜŞTƏRİLƏR VAR!\n`;
        alertMsg += `Yeni Məhsul: "${newProductTitle}"\n`;
        alertMsg += `Qiymət: ${productPrice} ₼\n`;
        alertMsg += `==================================\n\n`;

        potentialCustomers.forEach((c, index) => {
            alertMsg += `${index + 1}. 👤 Müştəri: ${c.customer}\n`;
            alertMsg += `   📞 Əlaqə: ${c.phone}\n`;
            alertMsg += `   💰 Büdcə: ${c.budget} ₼\n`;
            alertMsg += `   📝 Müştəri nə axtarırdı: "${c.product}"\n`;
            alertMsg += `----------------------------------\n`;
        });

        alertMsg += `\nHeç yerə elan qoymağa tələsməyin, dərhal bu müştərilərə zəng edin!`;

        setTimeout(() => {
            alert(alertMsg);
        }, 800);
    }
}

function renderWishPagination(totalItems, filteredData) {
    const section = document.getElementById('wishlistSection');
    if (!section) return;

    let paginationContainer = document.getElementById('wishPagination');
    if (paginationContainer) paginationContainer.remove();

    if (totalItems <= wishRowsPerPage) return;

    const totalPages = Math.ceil(totalItems / wishRowsPerPage);
    paginationContainer = document.createElement('div');
    paginationContainer.id = 'wishPagination';
    paginationContainer.style.cssText = "display:flex; justify-content:center; gap:10px; margin-top:20px; padding:20px 0;";

    // GERİ DÜYMƏSİ
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentWishPage === 1;
    prevBtn.className = "btn-page"; // Stil vermək üçün
    prevBtn.onclick = () => { currentWishPage--; renderWishlist(filteredData); };
    paginationContainer.appendChild(prevBtn);

    // SƏHİFƏ NÖMRƏLƏRİ
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.className = i === currentWishPage ? "btn-page active" : "btn-page";
        // Aktiv düymə stili
        if (i === currentWishPage) {
            btn.style.background = "#3498db";
            btn.style.color = "white";
        }
        btn.onclick = () => { currentWishPage = i; renderWishlist(filteredData); };
        paginationContainer.appendChild(btn);
    }

    // İRƏLİ DÜYMƏSİ
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentWishPage === totalPages;
    nextBtn.className = "btn-page";
    nextBtn.onclick = () => { currentWishPage++; renderWishlist(filteredData); };
    paginationContainer.appendChild(nextBtn);

    section.appendChild(paginationContainer);
}



// --- YENİ FUNKSİYA ---
function renderSalesPagination(totalItems) {
    const tableContainer = document.querySelector('.recent-sales'); // Cədvəlin olduğu qutu
    if (!tableContainer) return;

    let paginationContainer = document.getElementById('salesPagination');
    if (paginationContainer) paginationContainer.remove();

    if (totalItems <= salesRowsPerPage) return;

    const totalPages = Math.ceil(totalItems / salesRowsPerPage);
    paginationContainer = document.createElement('div');
    paginationContainer.id = 'salesPagination';
    paginationContainer.className = 'pagination-controls'; // Gözləmə siyahısı ilə eyni CSS istifadə edəcək

    // GERİ
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentSalesPage === 1;
    prevBtn.onclick = () => { currentSalesPage--; updateAnalytics(); };
    paginationContainer.appendChild(prevBtn);

    // NÖMRƏLƏR
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        if (i === currentSalesPage) btn.className = 'active';
        btn.onclick = () => { currentSalesPage = i; updateAnalytics(); };
        paginationContainer.appendChild(btn);
    }

    // İRƏLİ
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentSalesPage === totalPages;
    nextBtn.onclick = () => { currentSalesPage++; updateAnalytics(); };
    paginationContainer.appendChild(nextBtn);

    tableContainer.appendChild(paginationContainer);
}


// --- BİZNES ÜÇÜN QLOBAL FUNKSİYALAR ---

function openBusinessModal() {
    document.getElementById('businessModal').style.display = 'block';
    document.getElementById('businessForm').reset();
    document.getElementById('editIndex').value = '';
    document.getElementById('socialLinksContainer').innerHTML = '';
    document.getElementById('customCategory').style.display = 'none';
    document.getElementById('modalTitle').innerText = "Biznes Məlumatı";
}

function closeBusinessModal() {
    document.getElementById('businessModal').style.display = 'none';
}

// Kateqoriya "Əllə Yaz" seçiləndə inputu göstər
function toggleCustomCategory(val) {
    document.getElementById('customCategory').style.display = (val === 'custom') ? 'block' : 'none';
}

function addSocialRow(platform = 'instagram', link = '') {
    const container = document.getElementById('socialLinksContainer');
    const div = document.createElement('div');
    div.className = 'social-row';
    div.style.display = 'flex';
    div.style.gap = '5px';
    div.style.marginBottom = '8px';
    
    div.innerHTML = `
        <select class="social-platform" style="flex:1; padding:8px; border-radius:5px; border:1px solid #ddd;">
            <option value="instagram" ${platform==='instagram'?'selected':''}>Instagram</option>
            <option value="facebook" ${platform==='facebook'?'selected':''}>Facebook</option>
            <option value="tiktok" ${platform==='tiktok'?'selected':''}>TikTok</option>
            <option value="youtube" ${platform==='youtube'?'selected':''}>Youtube</option>
            <option value="globe" ${platform==='globe'?'selected':''}>Vebsayt</option>
        </select>
        <input type="text" class="social-link" placeholder="Link" value="${link}" style="flex:2; padding:8px; border-radius:5px; border:1px solid #ddd; margin:0;">
        <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:red; cursor:pointer; font-weight:bold; padding:0 5px;">×</button>
    `;
    container.appendChild(div);
}

document.getElementById('businessForm').onsubmit = async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('bizName').value;
    let category = document.getElementById('bizCategory').value;
    if(category === 'custom') category = document.getElementById('customCategory').value;
    
    const editIndex = document.getElementById('editIndex').value;
    const fileInput = document.getElementById('bizLogo');

    const socials = [];
    document.querySelectorAll('.social-row').forEach(row => {
        const link = row.querySelector('.social-link').value;
        if(link) {
            socials.push({
                platform: row.querySelector('.social-platform').value,
                link: link
            });
        }
    });

    const saveBizAction = async (logoData) => {
        const bizObj = {
            name,
            category,
            socials,
            logo: logoData || (editIndex !== "" ? businesses[editIndex].logo : 'https://via.placeholder.com/80?text=LOGO')
        };

        if (editIndex === "") {
            businesses.push(bizObj);
        } else {
            businesses[editIndex] = bizObj;
        }

        await saveData(); // E: diskindəki biznes_baza.json-a yazır
        renderBusinesses();
        closeBusinessModal();
    };

    if (fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => saveBizAction(ev.target.result);
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        saveBizAction(null);
    }
};

function renderBusinesses() {
    const grid = document.getElementById('businessGrid');
    if (!grid) return;
    grid.innerHTML = '';

    businesses.forEach((biz, index) => {
        const card = document.createElement('div');
        card.className = 'card biz-card'; // Sənin Dashboard stilinə uyğun
        
        let socialIcons = biz.socials.map(s => {
            let iconClass = s.platform === 'globe' ? 'fas fa-globe' : `fab fa-${s.platform}`;
            return `<a href="${s.link}" target="_blank" style="margin:0 8px; font-size:20px; color:#555;"><i class="${iconClass}"></i></a>`;
        }).join('');

        card.innerHTML = `
            <div style="position:absolute; top:10px; right:10px; display:flex; gap:12px; font-size: 16px;">
                <i class="fas fa-edit" onclick="editBiz(${index})" style="color:#3498db; cursor:pointer;" title="Redaktə"></i>
                <i class="fas fa-trash" onclick="deleteBiz(${index})" style="color:#e74c3c; cursor:pointer;" title="Sil"></i>
            </div>
            <img src="${biz.logo}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; margin: 15px auto; display:block; border:3px solid #f8f9fa;">
            <div style="font-size:11px; color:#999; font-weight:bold; text-transform:uppercase; text-align:center;">${biz.category}</div>
            <h3 style="margin:10px 0; text-align:center; color:#2c3e50;">${biz.name}</h3>
            <div style="margin-top:15px; padding-top:10px; border-top:1px solid #eee; text-align:center;">
                ${socialIcons || '<span style="color:#ddd; font-size:12px;">Link yoxdur</span>'}
            </div>
        `;
        grid.appendChild(card);
    });
}

function editBiz(index) {
    const biz = businesses[index];
    openBusinessModal();
    document.getElementById('modalTitle').innerText = "Biznesi Redaktə Et";
    document.getElementById('editIndex').value = index;
    document.getElementById('bizName').value = biz.name;
    document.getElementById('bizCategory').value = biz.category;
    
    // Əgər kateqoriya standart siyahıda yoxdursa, custom-ı aktiv et
    const select = document.getElementById('bizCategory');
    const isStandard = Array.from(select.options).some(opt => opt.value === biz.category);
    if (!isStandard) {
        select.value = 'custom';
        document.getElementById('customCategory').style.display = 'block';
        document.getElementById('customCategory').value = biz.category;
    } else {
        select.value = biz.category;
    }

    document.getElementById('socialLinksContainer').innerHTML = '';
    biz.socials.forEach(s => addSocialRow(s.platform, s.link));
}

async function deleteBiz(index) {
    if(confirm('Bu biznes səhifəsini bazadan tamamilə silmək istəyirsiniz?')) {
        businesses.splice(index, 1);
        await saveData();
        renderBusinesses();
    }
}


// ==========================================
// DARK / LIGHT MODE MƏNTİQİ
// ==========================================

// Səhifə yüklənəndə yaddaşdakı temanı yoxla
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('dashboard-theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    }
});

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    
    // Seçimi yaddaşda saxla
    localStorage.setItem('dashboard-theme', isDark ? 'dark' : 'light');
    
    // İkonu dəyiş
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const icon = document.querySelector('#themeToggle i');
    if (isDark) {
        icon.className = 'fas fa-sun'; // Qaranlıqdadırsa günəş göstər
        icon.style.color = '#f1c40f';
    } else {
        icon.className = 'fas fa-moon'; // İşıqlıdırsa ay göstər
        icon.style.color = '#2c3e50';
    }
}


// 1. DƏQİQ MƏNFƏƏT HESABLAYICI (Xətasız Versiya)
function getProfitForPeriod(y, m, d = null) {
    try {
        return products.filter(p => {
            if (p.status !== 'sold' || !p.satildigiTarix) return false;
            const date = new Date(p.satildigiTarix);
            const matchYear = date.getFullYear() === parseInt(y);
            const matchMonth = m === 'all' ? true : date.getMonth() === parseInt(m);
            const matchDay = d === null ? true : date.getDate() === parseInt(d);
            return matchYear && matchMonth && matchDay;
        }).reduce((sum, p) => {
            const sale = Number(p.mehsulQiymeti) || 0;
            const cost = Number(p.alisQiymeti) || 0;
            const comm = Number(p.komissiyaQazanci) || 0;
            const exps = (p.mehsulXercleri || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
            return sum + (p.biznesModeli === 'commission' ? comm : (sale - (cost + exps)));
        }, 0);
    } catch (err) {
        return 0;
    }
}

// 2. ƏSAS QRAFİK RENDERİ
function drawGrowthVisuals(year, month) {
    const barsContainer = document.getElementById('growthBarsWrapper');
    const labelsContainer = document.getElementById('growthXLabels');
    const statusPill = document.getElementById('growthStatus');
    if (!barsContainer || !labelsContainer) return;

    barsContainer.innerHTML = '';
    labelsContainer.innerHTML = '';

    // Azərbaycan dilində aylar
    const monthNamesAZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

    let dataPoints = [];
    
    if (year === 'all') {
        const years = [...new Set(products.map(p => p.satildigiTarix ? new Date(p.satildigiTarix).getFullYear() : new Date().getFullYear()))].sort();
        dataPoints = years.map(y => ({ label: y, y: y, m: 'all' }));
    } else if (month === 'all') {
        // Ayları M01 yox, tam adla düzürük
        for(let i=0; i<12; i++) dataPoints.push({ label: monthNamesAZ[i], y: year, m: i });
    } else {
        const days = [...new Set(products.filter(p => p.status === 'sold').map(p => new Date(p.satildigiTarix).getDate()))].sort((a,b)=>a-b);
        dataPoints = days.map(d => ({ label: d, y: year, m: month, d: d }));
    }

    const profits = dataPoints.map(dp => getProfitForPeriod(dp.y, dp.m, dp.d || null));
    const maxProfit = Math.max(...profits, 10); // Minimum 10 manatlıq hündürlük bazası

    profits.forEach((val, i) => {
        // Hündürlük hesabı (Əgər qazanc varsa kubik görünsün)
        const heightPercent = (val / maxProfit) * 100;
        
        const barUnit = document.createElement('div');
        barUnit.className = 'growth-bar-unit';
        
        // Faiz artımı (Yalnız mənfəət olan aylar arasında)
        let pctHtml = "";
        if (i > 0 && profits[i-1] > 0 && val > profits[i-1]) {
            const grow = ((val - profits[i-1]) / profits[i-1]) * 100;
            pctHtml = `<div class="growth-pct-tag" style="position:absolute; top:-35px; background:#2ecc71; color:white; padding:2px 6px; border-radius:4px; font-size:9px;">+${grow.toFixed(0)}%</div>`;
        }

        barUnit.innerHTML = `
            ${val > 0 ? `<span class="growth-bar-value">${val}₼</span>` : ''}
            <div class="growth-bar-pillar" style="height:${val > 0 ? Math.max(heightPercent, 8) : 0}%">
                ${pctHtml}
            </div>
        `;
        barsContainer.appendChild(barUnit);

        const lbl = document.createElement('span');
        lbl.className = 'growth-label-text';
        lbl.innerText = dataPoints[i].label;
        labelsContainer.appendChild(lbl);
    });

    // Oxun rəngini və qalınlığını dinamik tənzimləyən kiçik toxunuş
    const arrowPath = document.getElementById('dynamicArrowPath');
    if (arrowPath) {
        arrowPath.setAttribute('stroke-width', '8');
        arrowPath.setAttribute('stroke', profits[profits.length-1] >= profits[0] ? 'rgba(46, 204, 113, 0.4)' : 'rgba(231, 76, 60, 0.4)');
    }

    const totalCurrent = profits.reduce((a,b)=>a+b, 0);
    statusPill.innerHTML = totalCurrent > 0 ? `Trend: Aktiv Yüksəliş <i class="fas fa-rocket"></i>` : `Trend: Gözləmədə`;
}