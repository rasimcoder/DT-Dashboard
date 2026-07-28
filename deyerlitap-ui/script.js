// Qlobal dəyişənlər - Proqramın beyni
let directoryHandle = null;
let selectedFiles = [];
let currentExistingPhotos = []; // Redaktə edilən məhsulun mövcud şəkilləri
let currentSellingId = null; // Satılacaq məhsulu müvəqqəti saxlamaq üçün
let platformChartInstance = null; 
let conditionChartInstance = null;
let currentActiveSection = 'home'; // Hansı səhifədəyik? 
let wishlist = [];
let products = [];
let expenseChartInstance = null;


// DOM Elementləri
const connectBtn = document.getElementById('connectBtn');
const dbStatus = document.getElementById('dbStatus');
const productForm = document.getElementById('productForm');
const productGrid = document.getElementById('productGrid');
const searchInput = document.getElementById('searchInput');

// 1. QOVLUĞA QOŞULMA FUNKSİYASI
async function connectToDB() {
    try {
        // İstifadəçidən qovluq seçməsini istəyirik
        directoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });

        // Yazma və oxuma icazəsini rəsmiləşdiririk
        const options = { mode: 'readwrite' };
        if ((await directoryHandle.queryPermission(options)) !== 'granted') {
            await directoryHandle.requestPermission(options);
        }

        // Uğurlu qoşulma vizualları
        dbStatus.innerText = "✅ Baza Aktivdir: " + directoryHandle.name;
        dbStatus.style.color = "#2ecc71";
        connectBtn.style.background = "#27ae60";
        connectBtn.innerHTML = '<i class="fas fa-check-circle"></i> Qoşuldu';

        // Məlumatları yüklə
        await loadData();

    } catch (err) {
        console.error("Qoşulma xətası:", err);
        alert("Baza seçilmədi. İşləmək üçün 'Bazaya Qoşul' düyməsini sıxın.");
    }
}

// Düyməyə klik edəndə qoşulma funksiyasını çağırırıq
connectBtn.addEventListener('click', connectToDB);


// 2. Məlumatları Oxumaq (Məhsullar və Gözləmə Siyahısı)
async function loadData() {
    if (!directoryHandle) return;

    // --- Məhsulları (data.json) yükləyirik ---
    try {
        const fileHandle = await directoryHandle.getFileHandle('data.json', { create: true });
        const file = await fileHandle.getFile();
        const content = await file.text();
        products = content ? JSON.parse(content) : [];
        renderProducts(products);
    } catch (err) {
        console.log("data.json hələ boşdur və ya yaradılmayıb.");
        products = [];
        renderProducts([]);
    }

    // --- Gözləmə Siyahısını (wishlist.json) yükləyirik (B Bəndi) ---
    try {
        const wishHandle = await directoryHandle.getFileHandle('wishlist.json', { create: true });
        const wishFile = await wishHandle.getFile();
        const wishContent = await wishFile.text();
        wishlist = wishContent ? JSON.parse(wishContent) : [];
        console.log("Gözləmə siyahısı uğurla yükləndi.");
    } catch (e) {
        console.log("wishlist.json hələ boşdur və ya yaradılmayıb.");
        wishlist = [];
    }
}

// 3. MƏLUMATLARI YADDA SAXLAMAQ (Məhsullar və Gözləmə Siyahısı)
async function saveData() {
    if (!directoryHandle) {
        alert("Xəta: Bazaya qoşulmayıb!");
        return;
    }

    try {
        const fileHandle = await directoryHandle.getFileHandle('data.json', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.truncate(0);
        const content = JSON.stringify(products, null, 2);
        await writable.write(content);
        await writable.close();

        // Wishlist üçün də yadda saxla
        const wishHandle = await directoryHandle.getFileHandle('wishlist.json', { create: true });
        const wishWritable = await wishHandle.createWritable();
        await wishWritable.truncate(0);
        await wishWritable.write(JSON.stringify(wishlist, null, 2));
        await wishWritable.close();

        console.log("Məlumatlar diskə həkk olundu.");
        // BURADAN renderProducts ÇAĞIRIŞINI SİLDİK!
    } catch (err) {
        console.error("Yadda saxlama xətası:", err);
    }
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

// 6. FORM TƏQDİM EDİLDİKDƏ (YENİ MƏHSUL VƏ YA REDAKTƏ)
// 6. FORM TƏQDİM EDİLDİKDƏ (YENİ MƏHSUL VƏ YA REDAKTƏ)
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
        const currentTitle = document.getElementById('title').value; // Bildiriş üçün başlığı götürürük
        const newPrice = document.getElementById('salePrice').value;

        // 1. Şəkilləri yüklə
        const newUploadedPhotoNames = await saveImagesLocally(selectedFiles);
        const finalPhotoList = [...(currentExistingPhotos || []), ...newUploadedPhotoNames];

        // 2. Məlumat obyektini yaradırıq (Burada bütün sahələr dəqiq qeyd olunub)
        const productInfo = {
            mehsulTitle: currentTitle,
            mehsulAciqlamasi: document.getElementById('description').value,
            mehsulQiymeti: newPrice,
            alisQiymeti: document.getElementById('costPrice').value,
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

        // 4. BİLDİRİŞ YOXLAMA (Yalnız yeni məhsul əlavə edəndə və ya adı dəyişəndə)
        if (typeof checkWishlistMatch === 'function') {
            checkWishlistMatch(currentTitle);
        }

        // 5. Formu təmizləyirik
        e.target.reset();
        document.getElementById('imagePreview').innerHTML = '';
        const expContainer = document.getElementById('expenseContainer');
        if (expContainer) expContainer.innerHTML = '';
        
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

// 9. AXTARIŞ SİSTEMİ
function handleSearch() {
    const q = searchInput.value.toLowerCase();
    const filtered = products.filter(p =>
        p.mehsulTitle.toLowerCase().includes(q) ||
        p.mehsulunKateqoriyasi.toLowerCase().includes(q) ||
        p.labels.some(l => l.toLowerCase().includes(q))
    );
    renderProducts(filtered);
}
searchInput.oninput = handleSearch;

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
    if (cat === 'all') renderProducts(products);
    else renderProducts(products.filter(p => p.mehsulunKateqoriyasi === cat));
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
    // 1. Əgər analitika və ya detal bölməsi açıqdırsa, onları bağla və ana səhifəni aç
    document.getElementById('analyticsSection').style.display = 'none';
    if (document.getElementById('productDetailView')) document.getElementById('productDetailView').style.display = 'none';
    document.getElementById('productGrid').style.display = 'grid';

    // 2. Məhsulları süz
    const filtered = products.filter(p => p.status === status);
    renderProducts(filtered);

    // 3. Sidebar-dakı aktivlik vizualını idarə et
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Kliklənən düyməni (Satılanlar) aktiv rəngə boya (isteğe bağlı)
    // Əgər event-dən gələn elementi tapa bilsək daha yaxşı olar, amma hələlik belə bəsdir.
}





// Analitika üçün Qrafik dəyişənləri (Yenidən yüklədikdə köhnəsini silmək üçün)
let profitChartInstance = null;
let categoryChartInstance = null;

// 1. Mövcud illəri tapıb dropdown-a dolduran funksiya
function populateYearFilter() {
    const yearSelect = document.getElementById('filterYear');
    const soldItems = products.filter(p => p.status === 'sold' && p.satildigiTarix);

    // Satılan məhsulların illərini götürürük
    const years = [...new Set(soldItems.map(p => new Date(p.satildigiTarix).getFullYear()))];

    // Köhnə illəri təmizləyirik (Bütün İllər-dən başqa)
    yearSelect.innerHTML = '<option value="all">Bütün İllər</option>';

    years.sort((a, b) => b - a).forEach(year => {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    });
}

// 2. Yenilənmiş Əsas Analitika Funksiyası (Əlavə Xərclər və Yeni/İşlənmiş Analizi ilə)
async function updateAnalytics() {
    if (!products || products.length === 0) return;

    const selectedYear = document.getElementById('filterYear').value;
    const selectedMonth = document.getElementById('filterMonth').value;

    let filteredSold = products.filter(p => p.status === 'sold');

    if (selectedYear !== 'all') {
        filteredSold = filteredSold.filter(p => new Date(p.satildigiTarix).getFullYear().toString() === selectedYear);
    }
    if (selectedMonth !== 'all') {
        filteredSold = filteredSold.filter(p => new Date(p.satildigiTarix).getMonth().toString() === selectedMonth);
    }

    // --- HESABLAMA HİSSƏSİ ---
    let totalRevenue = 0;
    let totalCostOfSold = 0;
    let totalExtraExpenses = 0;
    let totalSaleDays = 0;
    const expenseGroups = {}; // Xərcləri qruplaşdırmaq üçün obyekt

    filteredSold.forEach(p => {
        const salePrice = Number(p.mehsulQiymeti) || 0;
        const baseCost = Number(p.alisQiymeti) || 0;
        
        // Məhsulun xərclərini dövrə salırıq
        let itemTotalExtras = 0;
        (p.mehsulXercleri || []).forEach(ex => {
            const amt = Number(ex.amount) || 0;
            itemTotalExtras += amt;
            totalExtraExpenses += amt;

            // Qruplaşdırma məntiqi (böyük-kiçik hərf fərqini silirik)
            const key = ex.title.trim().toLowerCase();
            if (!expenseGroups[key]) {
                expenseGroups[key] = { name: ex.title.trim(), total: 0 };
            }
            expenseGroups[key].total += amt;
        });

        totalRevenue += salePrice;
        totalCostOfSold += (baseCost + itemTotalExtras);

        const entryDate = new Date(p.mehsulunYaradilmTarixi);
        const saleDate = new Date(p.satildigiTarix);
        const diffDays = Math.ceil(Math.abs(saleDate - entryDate) / (1000 * 60 * 60 * 24)) || 1;
        totalSaleDays += diffDays;
    });

    const netProfit = totalRevenue - totalCostOfSold;
    const avgSaleTime = filteredSold.length > 0 ? Math.round(totalSaleDays / filteredSold.length) : 0;
    const stockValue = products.filter(p => p.status !== 'sold').reduce((sum, p) => sum + (Number(p.alisQiymeti) || 0), 0);

    // --- EKRANA ÇIXARIŞ (Stats) ---
    const setElText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
    setElText('statTotalRevenue', totalRevenue.toLocaleString() + " ₼");
    setElText('statNetProfit', netProfit.toLocaleString() + " ₼");
    setElText('statStockValue', stockValue.toLocaleString() + " ₼");
    setElText('statTotalExpenses', totalExtraExpenses.toLocaleString() + " ₼");
    setElText('statSoldQuantity', filteredSold.length + " ədəd");
    setElText('statAvgSaleTime', avgSaleTime + " gün");

    // --- XƏRC DETALLARI SİYAHISINI DOLDURMAQ ---
    const expListDiv = document.getElementById('expenseBreakdownList');
    if(expListDiv) {
        const sortedExpenses = Object.values(expenseGroups).sort((a,b) => b.total - a.total);
        expListDiv.innerHTML = sortedExpenses.length > 0 
            ? sortedExpenses.map(ex => `
                <div class="expense-breakdown-item">
                    <span class="exp-name">${ex.name}</span>
                    <span class="exp-total">${ex.total.toLocaleString()} ₼</span>
                </div>`).join('')
            : '<p style="color:#999; text-align:center;">Heç bir əlavə xərc yoxdur.</p>';
    }

    // --- CƏDVƏLİ DOLDURMAQ ---
    const tableBody = document.getElementById('salesTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        const sortedItems = [...filteredSold].sort((a, b) => new Date(b.satildigiTarix) - new Date(a.satildigiTarix));
        sortedItems.slice(0, 20).forEach(p => {
            const alis = Number(p.alisQiymeti) || 0;
            const itemXerc = (p.mehsulXercleri || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
            const qazanc = Number(p.mehsulQiymeti) - (alis + itemXerc);
            const entryDate = new Date(p.mehsulunYaradilmTarixi);
            const saleDate = new Date(p.satildigiTarix);
            const days = Math.ceil(Math.abs(saleDate - entryDate) / (1000 * 60 * 60 * 24)) || 1;
            const speedClass = days <= 10 ? 'speed-fast' : (days <= 30 ? 'speed-normal' : 'speed-slow');

            tableBody.innerHTML += `
                <tr>
                    <td>${p.mehsulTitle}</td>
                    <td>${new Date(p.satildigiTarix).toLocaleDateString('az-AZ')}</td>
                    <td>${alis} ₼</td>
                    <td>${p.mehsulQiymeti} ₼</td>
                    <td class="profit-text">+${qazanc.toLocaleString()} ₼</td>
                    <td class="${speedClass}">${days} gün</td>
                </tr>`;
        });
    }

    // Qrafikləri yeniləyirik (expenseGroups artıq hazırdır!)
    initCharts(filteredSold, expenseGroups);
}

// Cədvəli/Listi doldurmaq üçün funksiyanın sonuna doğru bunu əlavə et:
const expenseListDiv = document.getElementById('expenseBreakdownList');
if(expenseListDiv) {
    expenseListDiv.innerHTML = Object.values(expenseGroups).length > 0 
        ? Object.values(expenseGroups)
            .sort((a,b) => b.total - a.total)
            .map(ex => `
                <div class="expense-item">
                    <span class="expense-name">${ex.name}</span>
                    <span class="expense-amount">${ex.total.toLocaleString()} ₼</span>
                </div>
            `).join('')
        : '<p style="color:#999; padding:10px;">Heç bir əlavə xərc yoxdur.</p>';
}

// Qrafiki çəkmək üçün initCharts-a ötürürük
initCharts(filteredSold, expenseGroups);

    const netProfit = totalRevenue - totalCostOfSold;
    
    // Ortalama satış müddəti
    const avgSaleTime = filteredSold.length > 0 ? Math.round(totalSaleDays / filteredSold.length) : 0;

    // Hal-hazırda anbarda olanların mayası
    const stockValue = products
        .filter(p => p.status !== 'sold')
        .reduce((sum, p) => sum + (Number(p.alisQiymeti) || 0), 0);

    // --- EKRANA ÇIXARIŞ ---
    const setElText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    setElText('statTotalRevenue', totalRevenue.toLocaleString() + " ₼");
    setElText('statNetProfit', netProfit.toLocaleString() + " ₼");
    setElText('statStockValue', stockValue.toLocaleString() + " ₼");
    setElText('statTotalExpenses', totalExtraExpenses.toLocaleString() + " ₼");
    setElText('statSoldQuantity', filteredSold.length + " ədəd");
    setElText('statAvgSaleTime', avgSaleTime + " gün"); // YENİ KART

    // --- CƏDVƏLİ DOLDURMAQ ---
    const tableBody = document.getElementById('salesTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        const sortedItems = [...filteredSold].sort((a, b) => new Date(b.satildigiTarix) - new Date(a.satildigiTarix));

        sortedItems.slice(0, 20).forEach(p => {
            const itemAlis = Number(p.alisQiymeti) || 0;
            const itemExpenses = (p.mehsulXercleri || []).reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
            const realProfit = Number(p.mehsulQiymeti) - (itemAlis + itemExpenses);

            // Məhsulun öz satış sürətini hesablayırıq
            const entryDate = new Date(p.mehsulunYaradilmTarixi);
            const saleDate = new Date(p.satildigiTarix);
            const diffDays = Math.ceil(Math.abs(saleDate - entryDate) / (1000 * 60 * 60 * 24)) || 1;
            
            // Sürətə görə rəng sinfi təyin edirik
            let speedClass = diffDays <= 10 ? 'speed-fast' : (diffDays <= 30 ? 'speed-normal' : 'speed-slow');

            tableBody.innerHTML += `
                <tr>
                    <td>${p.mehsulTitle}</td>
                    <td>${new Date(p.satildigiTarix).toLocaleDateString('az-AZ')}</td>
                    <td>${itemAlis} ₼</td>
                    <td>${p.mehsulQiymeti} ₼</td>
                    <td class="profit-text">+${realProfit.toLocaleString()} ₼</td>
                    <td class="${speedClass}">${diffDays} gün</td>
                </tr>
            `;
        });
    }

    // Qrafikləri yenilə
    initCharts(filteredSold);



function showSection(sectionId) {
    console.log("Səhifə keçidi:", sectionId);
    currentActiveSection = sectionId;

    // 1. Axtarış qutusunu təmizlə
    const sInput = document.getElementById('searchInput');
    if (sInput) sInput.value = '';

    // 2. Bütün bölmələrin ID-lərini siyahı halında gizlət
    const sectionList = ['productGrid', 'analyticsSection', 'wishlistSection', 'productDetailView'];
    sectionList.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });

    // 3. Seçilən bölməni göstər
    if (sectionId === 'analytics') {
        const target = document.getElementById('analyticsSection');
        if (target) {
            target.style.setProperty('display', 'block', 'important');
            setTimeout(() => {
                populateYearFilter();
                updateAnalytics();
            }, 100);
        }
    } 
    else if (sectionId === 'wishlist') {
        const target = document.getElementById('wishlistSection');
        if (target) {
            target.style.setProperty('display', 'block', 'important');
            renderWishlist(); // wishlist massivini göstər
        }
    } 
    // script.js - showSection funksiyasının daxilindəki 'else' (home) hissəsini dəyiş:
else {
    const grid = document.getElementById('productGrid');
    if (grid) {
        grid.style.setProperty('display', 'grid', 'important');
        
        // MÜHÜM: Yalnız statusu 'sold' OLMAYANLARI süzürük
        const activeProducts = products.filter(p => p.status !== 'sold');
        renderProducts(activeProducts);
    }
}

    // Sidebar aktivlik vizualı
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
}

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



// Wishlist idarəetmə funksiyaları
function openWishlistModal() { document.getElementById('wishlistModal').style.display = 'block'; }
function closeWishlistModal() { document.getElementById('wishlistModal').style.display = 'none'; }

document.getElementById('wishlistForm').onsubmit = async (e) => {
    e.preventDefault();
    const newWish = {
        id: "WISH-" + Date.now(),
        customer: document.getElementById('wishCustomer').value,
        product: document.getElementById('wishProduct').value,
        budget: document.getElementById('wishBudget').value,
        phone: document.getElementById('wishPhone').value,
        note: document.getElementById('wishNote').value,
        status: 'pending'
    };
    wishlist.push(newWish);
    await saveData(); // Həm məhsulları həm wishlist-i yadda saxlayır
    e.target.reset();
    closeWishlistModal();
    renderWishlist();
};

// 1. Render funksiyasını filtrləməyə uyğunlaşdırırıq
function renderWishlist(dataToRender = wishlist) {
    const body = document.getElementById('wishlistBody');
    if (!body) return;
    
    body.innerHTML = '';
    dataToRender.forEach(w => {
        const isPending = w.status === 'pending';
        body.innerHTML += `
            <tr>
                <td>${w.customer}</td>
                <td><strong>${w.product}</strong></td>
                <td>${w.budget} ₼</td>
                <td>${w.phone}</td>
                <td><span class="status-${w.status}">${isPending ? 'Gözləyir' : 'Tamamlandı'}</span></td>
                <td>
                    <button class="btn-action" onclick="toggleWishStatus('${w.id}')" style="color:#2ecc71"><i class="fas fa-check-circle"></i></button>
                    <button class="btn-action" onclick="deleteWish('${w.id}')" style="color:#e74c3c"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

// 2. Canlı axtarış funksiyası
function handleWishlistSearch() {
    const query = normalizeText(document.getElementById('wishlistSearchInput').value);
    
    const filtered = wishlist.filter(w => {
        return normalizeText(w.customer).includes(query) ||
               normalizeText(w.product).includes(query) ||
               normalizeText(w.budget).includes(query) ||
               normalizeText(w.phone).includes(query) ||
               normalizeText(w.status === 'pending' ? 'gozleyir' : 'tamamlandi').includes(query);
    });

    renderWishlist(filtered);
}

async function toggleWishStatus(id) {
    const item = wishlist.find(x => x.id === id);
    if(item) {
        item.status = item.status === 'pending' ? 'done' : 'pending';
        await saveData();
        renderWishlist();
    }
}

async function deleteWish(id) {
    if(confirm("Silmək istəyirsiniz?")) {
        wishlist = wishlist.filter(x => x.id !== id);
        await saveData();
        renderWishlist();
    }
}



// Yeni məhsulla gözləmə siyahısını müqayisə edən funksiya
function checkWishlistMatch(productTitle) {
    if (!wishlist || wishlist.length === 0) return;

    const normalizedProduct = normalizeText(productTitle);

    const match = wishlist.find(w => {
        const normalizedWish = normalizeText(w.product);
        return w.status === 'pending' && 
               (normalizedProduct.includes(normalizedWish) || normalizedWish.includes(normalizedProduct));
    });

    if (match) {
        setTimeout(() => {
            alert(`🚀 MÜŞTƏRİ TAPILDI!\n\n"${productTitle}" məhsulunu gözləyən var:\n\n👤 Müştəri: ${match.customer}\n📞 Əlaqə: ${match.phone}\n💰 Büdcə: ${match.budget} ₼`);
        }, 600);
    }
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





// 1. Yazıları təmizləyən funksiya
function normalizeText(text) {
    if (!text) return "";
    return text.toString().toLowerCase().trim()
        .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o')
        .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c')
        .replace(/ş/g, 's');
}

// 2. Qlobal Axtarış (Bütün səhifələr üçün tək beyin)
function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = normalizeText(searchInput.value);

    if (currentActiveSection === 'wishlist') {
        // Gözləmə siyahısında axtar
        const filtered = wishlist.filter(w => 
            normalizeText(w.customer).includes(query) ||
            normalizeText(w.product).includes(query) ||
            normalizeText(w.phone).includes(query)
        );
        renderWishlist(filtered);
    } // script.js - handleSearch içindəki home hissəsi:
else if (currentActiveSection === 'home') {
    const normalizedQuery = normalizeText(query);
    
    // ƏVVƏLCƏ yalnız aktivləri götürürük
    const activeOnly = products.filter(p => p.status !== 'sold');
    
    // SONRA onlar arasında axtarış edirik
    const filtered = activeOnly.filter(p => 
        normalizeText(p.mehsulTitle).includes(normalizedQuery) ||
        normalizeText(p.mehsulunKateqoriyasi).includes(normalizedQuery)
    );
    renderProducts(filtered);
}
}